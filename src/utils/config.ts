import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import ini from 'ini';

import { KnownError } from './error.js';
import { fileExists } from './fs.js';

import type { TiktokenModel } from '@dqbd/tiktoken';

const commitTypes = ['', 'conventional', 'gitmoji'] as const;
export type CommitType = (typeof commitTypes)[number];

export const DEFAULT_OLLMA_HOST = 'http://localhost:11434';

const { hasOwnProperty } = Object.prototype;

export const hasOwn = (object: unknown, key: PropertyKey) => hasOwnProperty.call(object, key);

export const modelNames = ['OPENAI', 'OLLAMA', 'HUGGINGFACE', 'GEMINI', 'ANTHROPIC', 'MISTRAL', 'CODESTRAL', 'COHERE', 'GROQ', 'PERPLEXITY'] as const;
export type ModelName = (typeof modelNames)[number];

const parseAssert = (name: string, condition: any, message: string) => {
    if (!condition) {
        throw new KnownError(`Invalid config property ${name}: ${message}`);
    }
};

const generalConfigParsers = {
    systemPrompt(systemPrompt?: string) {
        if (!systemPrompt) {
            return '';
        }
        return systemPrompt;
    },
    systemPromptPath(systemPromptPath?: string) {
        if (!systemPromptPath) {
            return '';
        }
        return systemPromptPath;
    },
    timeout(timeout?: string) {
        if (!timeout) {
            return 10_000;
        }

        parseAssert('timeout', /^\d+$/.test(timeout), 'Must be an integer');

        const parsed = Number(timeout);
        parseAssert('timeout', parsed >= 500, 'Must be greater than 500ms');

        return parsed;
    },
    temperature(temperature?: string) {
        if (!temperature) {
            return 0.7;
        }

        parseAssert('temperature', /^(2|\d)(\.\d{1,2})?$/.test(temperature), 'Must be decimal between 0 and 2');

        const parsed = Number(temperature);
        parseAssert('temperature', parsed > 0.0, 'Must be greater than 0');
        parseAssert('temperature', parsed <= 2.0, 'Must be less than or equal to 2');

        return parsed;
    },
    maxTokens(maxTokens?: string) {
        if (!maxTokens) {
            return 1024;
        }

        parseAssert('maxTokens', /^\d+$/.test(maxTokens), 'Must be an integer');
        return Number(maxTokens);
    },
    logging(enable?: string | boolean) {
        if (!enable) {
            return true;
        }
        if (typeof enable === 'boolean') {
            return enable;
        }
        parseAssert('logging', /^(?:true|false)$/.test(enable), 'Must be a boolean(true or false)');
        return enable === 'true';
    },
    confirm(confirm?: string | boolean) {
        if (!confirm) {
            return false;
        }

        if (typeof confirm === 'boolean') {
            return confirm;
        }

        parseAssert('confirm', /^(?:true|false)$/.test(confirm), 'Must be a boolean');
        return confirm === 'true';
    },
    locale(locale?: string) {
        if (!locale) {
            return 'en';
        }

        parseAssert('locale', locale, 'Cannot be empty');
        parseAssert(
            'locale',
            /^[a-z-]+$/i.test(locale),
            'Must be a valid locale (letters and dashes/underscores). You can consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639-1_codes'
        );
        return locale;
    },
    generate(count?: string) {
        if (!count) {
            return 1;
        }

        parseAssert('generate', /^\d+$/.test(count), 'Must be an integer');

        const parsed = Number(count);
        parseAssert('generate', parsed > 0, 'Must be greater than 0');
        parseAssert('generate', parsed <= 5, 'Must be less or equal to 5');

        return parsed;
    },
    type(type?: CommitType) {
        if (!type) {
            return 'conventional';
        }

        parseAssert('type', commitTypes.includes(type as CommitType), 'Invalid commit type');

        return type as CommitType;
    },
    maxLength(maxLength?: string) {
        if (!maxLength) {
            return 50;
        }

        parseAssert('maxLength', /^\d+$/.test(maxLength), 'Must be an integer');

        const parsed = Number(maxLength);
        parseAssert('maxLength', parsed >= 20, 'Must be greater than 20 characters');

        return parsed;
    },
    ignoreBody(ignore?: string | boolean) {
        if (!ignore) {
            return true;
        }
        if (typeof ignore === 'boolean') {
            return ignore;
        }

        parseAssert('ignoreBody', /^(?:true|false)$/.test(ignore), 'Must be a boolean(true or false)');
        return ignore === 'true';
    },
} as const;

const modelConfigParsers: Record<ModelName, Record<string, (value: any) => any>> = {
    OPENAI: {
        key: (key?: string) => key || '',
        model: (model?: string): TiktokenModel => (model || 'gpt-3.5-turbo') as TiktokenModel,
        url: (host?: string) => {
            if (!host) {
                return 'https://api.openai.com';
            }
            parseAssert('OPENAI.url', /^https?:\/\//.test(host), 'Must be a valid URL');
            return host;
        },
        path: (path?: string) => path || '/v1/chat/completions',
        proxy: (proxy?: string) => proxy || '',
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    HUGGINGFACE: {
        cookie: (cookie?: string) => cookie || '',
        model: (model?: string): string => {
            if (!model) {
                return `CohereForAI/c4ai-command-r-plus`;
            }
            const supportModels = [
                `CohereForAI/c4ai-command-r-plus`,
                `meta-llama/Meta-Llama-3-70B-Instruct`,
                `HuggingFaceH4/zephyr-orpo-141b-A35b-v0.1`,
                `mistralai/Mixtral-8x7B-Instruct-v0.1`,
                `NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO`,
                `01-ai/Yi-1.5-34B-Chat`,
                `mistralai/Mistral-7B-Instruct-v0.2`,
                `microsoft/Phi-3-mini-4k-instruct`,
            ];

            parseAssert('HUGGINGFACE.model', supportModels.includes(model), 'Invalid model type of HuggingFace chat');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    GEMINI: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'gemini-1.5-pro';
            }
            const supportModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.5-pro-exp-0801'];
            parseAssert('GEMINI.model', supportModels.includes(model), 'Invalid model type of Gemini');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    ANTHROPIC: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'claude-3-haiku-20240307';
            }
            const supportModels = [
                'claude-2.1',
                'claude-2.0',
                'claude-instant-1.2',
                'claude-3-haiku-20240307',
                'claude-3-sonnet-20240229',
                'claude-3-opus-20240229',
            ];
            parseAssert('ANTHROPIC.model', supportModels.includes(model), 'Invalid model type of Anthropic');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    MISTRAL: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'mistral-tiny';
            }
            const supportModels = [
                'open-mistral-7b',
                'mistral-tiny-2312',
                'mistral-tiny',
                'open-mixtral-8x7b',
                'mistral-small-2312',
                'mistral-small',
                'mistral-small-2402',
                'mistral-small-latest',
                'mistral-medium-latest',
                'mistral-medium-2312',
                'mistral-medium',
                'mistral-large-latest',
                'mistral-large-2402',
                'mistral-embed',
            ];

            parseAssert('MISTRAL.model', supportModels.includes(model), 'Invalid model type of Mistral AI');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    CODESTRAL: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'codestral-latest';
            }
            const supportModels = ['codestral-latest', 'codestral-2405'];

            parseAssert('CODESTRAL.model', supportModels.includes(model), 'Invalid model type of Codestral');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    OLLAMA: {
        model: (models?: string | string[]): string[] => {
            if (!models) {
                return [];
            }
            const modelList = typeof models === 'string' ? models?.split(',') : models;
            return modelList.map(model => model.trim()).filter(model => !!model && model.length > 0);
        },
        host: (host?: string) => {
            if (!host) {
                return DEFAULT_OLLMA_HOST;
            }
            parseAssert('OLLAMA.host', /^https?:\/\//.test(host), 'Must be a valid URL');
            return host;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: (timeout?: string) => {
            if (!timeout) {
                return 100_000;
            }

            parseAssert('OLLAMA.timeout', /^\d+$/.test(timeout), 'Must be an integer');

            const parsed = Number(timeout);
            parseAssert('OLLAMA.timeout', parsed >= 500, 'Must be greater than 500ms');
            return parsed;
        },
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    COHERE: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'command';
            }
            const supportModels = ['command', `command-nightly`, `command-light`, `command-light-nightly`];
            parseAssert('COHERE.model', supportModels.includes(model), 'Invalid model type of Cohere');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    GROQ: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'gemma2-9b-it';
            }
            const supportModels = [
                `gemma2-9b-it`,
                `gemma-7b-it`,
                `llama-3.1-70b-versatile`,
                `llama-3.1-8b-instant`,
                `llama3-70b-8192`,
                `llama3-8b-8192`,
                `llama3-groq-70b-8192-tool-use-preview`,
                `llama3-groq-8b-8192-tool-use-preview`,
            ];
            parseAssert('GROQ.model', supportModels.includes(model), 'Invalid model type of Groq');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
    PERPLEXITY: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'llama-3.1-sonar-small-128k-chat';
            }

            // https://docs.perplexity.ai/docs/model-cards
            const supportModels = [
                'llama-3.1-sonar-small-128k-online',
                'llama-3.1-sonar-small-128k-chat',
                'llama-3.1-sonar-large-128k-online',
                'llama-3.1-sonar-large-128k-chat',
                'llama-3.1-8b-instruct',
                'llama-3.1-70b-instruct',
            ];

            parseAssert('PERPLEXITY.model', supportModels.includes(model), 'Invalid model type of Perplexity');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        ignoreBody: generalConfigParsers.ignoreBody,
    },
};

export type RawConfig = {
    [key: string]: string | string[] | Record<string, string | string[]> | number;
};

export type ValidConfig = {
    [Key in keyof typeof generalConfigParsers]: ReturnType<(typeof generalConfigParsers)[Key]>;
} & {
    [Model in ModelName]: ModelConfig<Model>;
};

export type ModelConfig<Model extends keyof typeof modelConfigParsers> = {
    [Key in keyof (typeof modelConfigParsers)[Model]]: ReturnType<(typeof modelConfigParsers)[Model][Key]>;
};

const configPath = path.join(os.homedir(), '.aicommit2');

const parseCliArgs = (rawArgv: string[] = []): RawConfig => {
    const cliConfig: RawConfig = {};
    for (const arg of rawArgv) {
        if (arg.startsWith('--')) {
            const [key, value] = arg.slice(2).split('=');
            const [modelName, modelKey] = key.split('.');
            if (modelName && modelKey && modelName in modelConfigParsers) {
                if (!cliConfig[modelName]) {
                    cliConfig[modelName] = {};
                }
                (cliConfig[modelName] as Record<string, string>)[modelKey] = value;
            } else {
                cliConfig[key] = value;
            }
        }
    }
    return cliConfig;
};

const readConfigFile = async (): Promise<RawConfig> => {
    const configExists = await fileExists(configPath);
    if (!configExists) {
        return Object.create(null);
    }

    const configString = await fs.readFile(configPath, 'utf8');
    let config = ini.parse(configString);
    const hasOllmaModel = hasOwn(config, 'OLLAMA') && hasOwn(config['OLLAMA'], 'model');
    if (hasOllmaModel) {
        config = {
            ...config,
            OLLAMA: {
                ...config.OLLAMA,
                model: typeof config['OLLAMA'].model === 'string' ? [config['OLLAMA'].model] : config['OLLAMA'].model,
            },
        };
    }
    return config;
};

export const getConfig = async (cliConfig: RawConfig, rawArgv: string[] = []): Promise<ValidConfig> => {
    const config = await readConfigFile();
    const parsedCliArgs = parseCliArgs(rawArgv);
    const mergedCliConfig = { ...cliConfig, ...parsedCliArgs };
    const parsedConfig: Record<string, unknown> = {};

    // Helper function to get the value with priority
    const getValueWithPriority = (modelName: string, key: string) => {
        const cliValue = mergedCliConfig[`${modelName}.${key}`] ?? (mergedCliConfig[modelName] as Record<string, any>)?.[key];
        const modelValue = (config[modelName] as Record<string, any>)?.[key];
        const generalValue = mergedCliConfig[key] ?? config[key];
        return cliValue !== undefined ? cliValue : modelValue !== undefined ? modelValue : generalValue;
    };

    // Parse general configs
    for (const [key, parser] of Object.entries(generalConfigParsers)) {
        const value = mergedCliConfig[key] ?? config[key];
        parsedConfig[key] = parser(value as any);
    }

    // Parse model-specific configs
    for (const [modelName, modelParsers] of Object.entries(modelConfigParsers)) {
        parsedConfig[modelName] = {};
        for (const [key, parser] of Object.entries(modelParsers)) {
            const value = getValueWithPriority(modelName, key);
            (parsedConfig[modelName] as Record<string, any>)[key] = parser(value);
        }
    }

    return parsedConfig as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: any][]) => {
    const config = await readConfigFile();

    for (const [key, value] of keyValues) {
        const [modelName, modelKey] = key.split('.');
        if (modelName in modelConfigParsers) {
            if (!config[modelName]) {
                config[modelName] = {};
            }
            const parser = modelConfigParsers[modelName as ModelName][modelKey];
            if (!parser) {
                throw new KnownError(`Invalid config property: ${key}`);
            }
            (config[modelName] as Record<string, any>)[modelKey] = parser(value);
        } else {
            const parser = generalConfigParsers[key as keyof typeof generalConfigParsers];
            if (!parser) {
                throw new KnownError(`Invalid config property: ${key}`);
            }
            // @ts-ignore ignore
            config[key] = parser(value);
        }
    }

    await fs.writeFile(configPath, ini.stringify(config), 'utf8');
};
