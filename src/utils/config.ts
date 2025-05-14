import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import ini from 'ini';

import { KnownError } from './error.js';
import { fileExists } from './fs.js';
import { flattenDeep } from './utils.js';

import type { TiktokenModel } from '@dqbd/tiktoken';

const commitTypes = ['', 'conventional', 'gitmoji'] as const;
export type CommitType = (typeof commitTypes)[number];

export const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';

const { hasOwnProperty } = Object.prototype;

export const hasOwn = (object: unknown, key: PropertyKey) => hasOwnProperty.call(object, key);

export const BUILTIN_SERVICES = [
    'OPENAI',
    'OLLAMA',
    'HUGGINGFACE',
    'GEMINI',
    'ANTHROPIC',
    'MISTRAL',
    'CODESTRAL',
    'COHERE',
    'GROQ',
    'PERPLEXITY',
    'DEEPSEEK',
] as const;
export type BuiltinService = (typeof BUILTIN_SERVICES)[number];

const findAllServices = (config: RawConfig): string[] => {
    const sections = Object.keys(config);

    // 내장 서비스와 추가된 섹션들을 모두 포함
    const allServices = new Set([
        ...BUILTIN_SERVICES,
        ...sections.filter(section =>
            // 설정 섹션 이름 규칙 검증 (대문자와 언더스코어만 허용)
            /^[A-Z][A-Z0-9_]*$/.test(section)
        ),
    ]);

    return Array.from(allServices);
};

// @ts-ignore ignore
export const modelNames = (config: RawConfig) => findAllServices(config) as const;
export type ModelName = ReturnType<typeof modelNames>[number];

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
    codeReviewPromptPath(codeReviewPromptPath?: string) {
        if (!codeReviewPromptPath) {
            return '';
        }
        return codeReviewPromptPath;
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
        if (typeof enable === 'boolean') {
            return enable;
        }
        if (enable === undefined || enable === null) {
            return true;
        }

        parseAssert('logging', /^(?:true|false)$/.test(enable), 'Must be a boolean(true or false)');
        return enable === 'true';
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
    includeBody(includeBody?: string | boolean) {
        if (typeof includeBody === 'boolean') {
            return includeBody;
        }

        if (includeBody === undefined || includeBody === null) {
            return false;
        }

        parseAssert('includeBody', /^(?:true|false)$/.test(includeBody), 'Must be a boolean(true or false)');
        return includeBody === 'true';
    },
    exclude: (exclude?: string | string[]): string[] => {
        if (!exclude) {
            return [];
        }
        const excludeFiles = typeof exclude === 'string' ? exclude?.split(',') : exclude;
        return excludeFiles.map(file => file.trim()).filter(file => !!file && file.length > 0);
    },
    topP: (topP?: string) => {
        if (!topP) {
            return 0.9;
        }
        parseAssert('topP', /^(1|\d)(\.\d{1,2})?$/.test(topP), 'Must be decimal between 0 and 1');
        const parsed = Number(topP);
        parseAssert('topP', parsed > 0.0, 'Must be greater than 0');
        parseAssert('topP', parsed <= 1.0, 'Must be less than or equal to 1');
        return parsed;
    },
    codeReview(codeReview?: string | boolean) {
        if (typeof codeReview === 'boolean') {
            return codeReview;
        }

        if (codeReview === undefined || codeReview === null) {
            return false;
        }

        parseAssert('codeReview', /^(?:true|false)$/.test(codeReview), 'Must be a boolean(true or false)');
        return codeReview === 'true';
    },
    disabled(disabled?: string | boolean) {
        if (typeof disabled === 'boolean') {
            return disabled;
        }

        if (disabled === undefined || disabled === null) {
            return false;
        }

        parseAssert('disabled', /^(?:true|false)$/.test(disabled), 'Must be a boolean(true or false)');
        return disabled === 'true';
    },
    watchMode(watchMode?: string | boolean) {
        if (typeof watchMode === 'boolean') {
            return watchMode;
        }

        if (watchMode === undefined || watchMode === null) {
            return false;
        }

        parseAssert('watchMode', /^(?:true|false)$/.test(watchMode), 'Must be a boolean(true or false)');
        return watchMode === 'true';
    },
} as const;

const modelConfigParsers: Record<ModelName, Record<string, (value: any) => any>> = {
    OPENAI: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string): TiktokenModel => (model || 'gpt-4o-mini') as TiktokenModel,
        url: (host?: string) => {
            if (!host) {
                return 'https://api.openai.com';
            }
            parseAssert('OPENAI.url', /^https?:\/\//.test(host), 'Must be a valid URL');
            return host;
        },
        path: (path?: string) => path || '/v1/chat/completions',
        proxy: (proxy?: string) => proxy || '',
        topP: generalConfigParsers.topP,
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
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
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    GEMINI: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'gemini-2.0-flash';
            }
            const supportModels = [
                `gemini-2.5-flash-preview-04-17`,
                `gemini-2.5-pro-preview-05-06`,
                `gemini-2.0-flash`,
                `gemini-2.0-flash-lite`,
                `gemini-2.0-flash-preview-image-generation`,
                `gemini-1.5-pro`,
                `gemini-1.5-flash`,
                `gemini-1.5-flash-8b`,
            ];
            parseAssert('GEMINI.model', supportModels.includes(model), 'Invalid model type of Gemini');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        topP: generalConfigParsers.topP,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    ANTHROPIC: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'claude-3-5-haiku-20241022';
            }
            const supportModels = [
                `claude-3-7-sonnet-20250219`,
                `claude-3-5-sonnet-20241022`,
                `claude-3-5-haiku-20241022`,
                `claude-3-opus-20240229`,
                `claude-3-sonnet-20240229`,
                `claude-3-haiku-20240307`,
            ];
            parseAssert('ANTHROPIC.model', supportModels.includes(model), 'Invalid model type of Anthropic');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        topP: generalConfigParsers.topP,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    MISTRAL: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'pixtral-12b-2409';
            }
            const supportModels = [
                `codestral-latest`,
                `mistral-large-latest`,
                `pixtral-large-latest`,
                `ministral-8b-latest`,
                `mistral-small-latest`,
                `mistral-embed`,
                `mistral-moderation-latest`,
            ];

            parseAssert('MISTRAL.model', supportModels.includes(model), 'Invalid model type of Mistral AI');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        topP: generalConfigParsers.topP,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    CODESTRAL: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'codestral-latest';
            }
            const supportModels = ['codestral-latest', 'codestral-2501'];

            parseAssert('CODESTRAL.model', supportModels.includes(model), 'Invalid model type of Codestral');
            return model;
        },
        topP: generalConfigParsers.topP,
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
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
                return DEFAULT_OLLAMA_HOST;
            }
            parseAssert('OLLAMA.host', /^https?:\/\//.test(host), 'Must be a valid URL');
            return host;
        },
        timeout: (timeout?: string) => {
            if (!timeout) {
                return 100_000;
            }

            parseAssert('OLLAMA.timeout', /^\d+$/.test(timeout), 'Must be an integer');

            const parsed = Number(timeout);
            parseAssert('OLLAMA.timeout', parsed >= 500, 'Must be greater than 500ms');
            return parsed;
        },
        auth: (auth?: string) => auth || '',
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        numCtx: (numCtx?: string) => {
            if (!numCtx) {
                return 2048;
            }

            parseAssert('OLLAMA.numCtx', /^\d+$/.test(numCtx), 'Must be an integer');

            const parsed = Number(numCtx);
            parseAssert('OLLAMA.numCtx', parsed >= 2048, 'Must be greater than 2048');
            return parsed;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        temperature: generalConfigParsers.temperature,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        topP: generalConfigParsers.topP,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    COHERE: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'command';
            }
            const supportModels = [
                `command-r7b-12-2024`,
                `command-r-plus-08-2024`,
                `command-r-plus-04-2024`,
                `command-r-plus`,
                `command-r-08-2024`,
                `command-r-03-2024`,
                `command-r`,
                `command`,
                `command-nightly`,
                `command-light`,
                `command-light-nightly`,
                `c4ai-aya-expanse-8b`,
                `c4ai-aya-expanse-32b`,
            ];
            parseAssert('COHERE.model', supportModels.includes(model), 'Invalid model type of Cohere');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        topP: generalConfigParsers.topP,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    GROQ: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'llama-3.3-70b-versatile';
            }
            const supportModels = [
                `allam-2-7b`,
                `compound-beta`,
                `compound-beta-mini`,
                `deepseek-r1-distill-llama-70b`,
                `distil-whisper-large-v3-en`,
                `gemma2-9b-it`,
                `llama-3.1-8b-instant`,
                `llama-3.3-70b-versatile`,
                `llama-guard-3-8b`,
                `llama3-70b-8192`,
                `llama3-8b-8192`,
                `meta-llama/llama-4-maverick-17b-128e-instruct`,
                `meta-llama/llama-4-scout-17b-16e-instruct`,
                `mistral-saba-24b`,
                `playai-tts`,
                `playai-tts-arabic`,
                `qwen-qwq-32b`,
                `whisper-large-v3`,
                `whisper-large-v3-turbo`,
            ];

            parseAssert('GROQ.model', supportModels.includes(model), 'Invalid model type of Groq');
            return model;
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        topP: generalConfigParsers.topP,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    PERPLEXITY: {
        key: (key?: string) => key || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return 'sonar';
            }

            // https://docs.perplexity.ai/guides/model-cards
            const supportModels = [
                `sonar-pro`,
                `sonar`,
                `llama-3.1-sonar-small-128k-online`,
                `llama-3.1-sonar-large-128k-online`,
                `llama-3.1-sonar-huge-128k-online`,
            ];

            parseAssert('PERPLEXITY.model', supportModels.includes(model), 'Invalid model type of Perplexity');
            return model;
        },
        topP: generalConfigParsers.topP,
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
    DEEPSEEK: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string) => {
            if (!model || model.length === 0) {
                return `deepseek-chat`;
            }
            console.log(model);
            const supportModels = [`deepseek-reasoner`, `deepseek-chat`];

            parseAssert('DEEPSEEK.model', supportModels.includes(model), 'Invalid model type of DeepSeek');
            return model;
        },
        topP: generalConfigParsers.topP,
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
    },
};

export type RawConfig = {
    [key: string]: string | string[] | Record<string, string | string[]> | number | boolean;
};

export type ValidConfig = {
    [Key in keyof typeof generalConfigParsers]: ReturnType<(typeof generalConfigParsers)[Key]>;
} & {
    [Model in ModelName]: ModelConfig<Model>;
};

export type ModelConfig<Model extends keyof typeof modelConfigParsers> = {
    [Key in keyof (typeof modelConfigParsers)[Model]]: ReturnType<(typeof modelConfigParsers)[Model][Key]>;
};

let loadedConfigPath: string | null = null;

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

// Read config file from multiple locations with precedence
export const readConfigFile = async (): Promise<RawConfig> => {
    const homeDir = os.homedir();
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');

    const potentialConfigPaths = [
        path.join(xdgConfigHome, 'aicommit2', 'config.ini'),
        path.join(homeDir, '.config', 'aicommit2', 'config.ini'),
        path.join(homeDir, '.aicommit2'),
    ];

    for (const configPath of potentialConfigPaths) {
        const configExists = await fileExists(configPath);
        if (configExists) {
            const configString = await fs.readFile(configPath, 'utf8');
            loadedConfigPath = configPath; // Store the path of the loaded config
            let config = ini.parse(configString);

            // Handle specific config types that are expected to be arrays
            const hasOllamaModel = hasOwn(config, 'OLLAMA') && hasOwn(config['OLLAMA'], 'model');
            if (hasOllamaModel && typeof config['OLLAMA'].model === 'string') {
                config = {
                    ...config,
                    OLLAMA: {
                        ...config.OLLAMA,
                        model: [config['OLLAMA'].model],
                    },
                };
            }

            const hasExclude = hasOwn(config, 'exclude');
            if (hasExclude && typeof config.exclude === 'string') {
                config = {
                    ...config,
                    exclude: [config.exclude],
                };
            }

            return config;
        }
    }

    // If no config file is found, return an empty object and set loadedConfigPath to null
    loadedConfigPath = null;
    return Object.create(null);
};

export const getConfig = async (cliConfig: RawConfig, rawArgv: string[] = []): Promise<ValidConfig> => {
    const config = await readConfigFile(); // This will now load from multiple paths
    const parsedCliArgs = parseCliArgs(rawArgv);
    const mergedCliConfig = { ...cliConfig, ...parsedCliArgs };
    const parsedConfig: Record<string, unknown> = {};

    const services = findAllServices(config);

    // Check environment variables for API keys
    const envConfig: RawConfig = {};

    for (const service of services) {
        // Get the envKey from config if available, otherwise use the default pattern
        const configuredEnvKey = (config[service] as Record<string, any>)?.envKey;
        const envKey = configuredEnvKey || `${service}_API_KEY`;

        const apiKey = process.env[envKey];
        if (apiKey) {
            envConfig[service] = { key: apiKey };
        }
    }

    // Helper function to get the value with priority
    const getValueWithPriority = (modelName: string, key: string) => {
        // Priority: CLI > Environment Variables > Model-specific > General
        const cliValue = mergedCliConfig[`${modelName}.${key}`] ?? (mergedCliConfig[modelName] as Record<string, any>)?.[key];
        const envValue = (envConfig[modelName] as Record<string, any>)?.[key];
        const modelValue = (config[modelName] as Record<string, any>)?.[key];
        const generalValue = mergedCliConfig[key] ?? config[key];

        return cliValue !== undefined ? cliValue : envValue !== undefined ? envValue : modelValue !== undefined ? modelValue : generalValue;
    };

    // Parse general configs
    for (const [key, parser] of Object.entries(generalConfigParsers)) {
        const value = mergedCliConfig[key] ?? config[key];
        parsedConfig[key] = parser(value as any);
    }

    // Parse model-specific configs for all services
    for (const modelName of services) {
        parsedConfig[modelName] = {};
        const modelParsers = modelConfigParsers[modelName as BuiltinService] || createConfigParser(modelName);

        for (const [key, parser] of Object.entries(modelParsers)) {
            const value = getValueWithPriority(modelName, key);
            (parsedConfig[modelName] as Record<string, any>)[key] = (parser as any)(value); // Add type assertion
        }
    }

    return parsedConfig as ValidConfig;
};

export const getWriteConfigPath = (): string => {
    if (loadedConfigPath) {
        return loadedConfigPath;
    }

    // If no config was loaded, determine the preferred write path based on XDG
    const homeDir = os.homedir();
    const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
    return path.join(xdgConfigHome, 'aicommit2', 'config.ini');
};

export const setConfigs = async (keyValues: [key: string, value: any][]) => {
    const config = await readConfigFile(); // Load existing config from any supported path

    for (const [key, value] of keyValues) {
        const [modelName, modelKey] = key.split('.');

        // General config keys
        if (!modelKey) {
            const parser = generalConfigParsers[key as keyof typeof generalConfigParsers];
            if (!parser) {
                throw new KnownError(`Invalid config property: ${key}`);
            }
            config[key] = parser(value);
            continue;
        }

        // Model-related config
        if (!config[modelName]) {
            config[modelName] = {};
        }

        // Built-in services
        if (BUILTIN_SERVICES.includes(modelName as BuiltinService)) {
            const parser = modelConfigParsers[modelName as BuiltinService][modelKey];
            if (!parser) {
                throw new KnownError(`Invalid config property: ${key}`);
            }
            (config[modelName] as Record<string, any>)[modelKey] = (parser as any)(value);
            continue;
        }

        // Custom services
        const isValidServiceName = /^[A-Z][A-Z0-9_]*$/.test(modelName);
        if (!isValidServiceName) {
            throw new KnownError(`Invalid service name: ${modelName}. Service names must be uppercase letters, numbers, and underscores.`);
        }

        // Get parser for custom service
        const customParser = createConfigParser(modelName);
        if (!(customParser as any)[modelKey]) {
            throw new KnownError(`Invalid config property for custom service: ${key}`);
        }

        try {
            (config[modelName] as Record<string, any>)[modelKey] = (customParser as any)[modelKey](value);
        } catch (error: unknown) {
            if (error instanceof KnownError) {
                throw error;
            }
            throw new KnownError(`Invalid value for ${key}: ${(error as Error).message}`);
        }
    }

    const writePath = getWriteConfigPath();
    await fs.writeFile(writePath, ini.stringify(config), 'utf8');
};

export const addConfigs = async (keyValues: [key: string, value: any][]) => {
    const config = await readConfigFile(); // Load existing config from any supported path

    for (const [key, value] of keyValues) {
        const [modelName, modelKey] = key.split('.');
        const modelConfig = config[modelName];

        // Special handling for OLLAMA.model (array)
        if (modelName === 'OLLAMA' && modelKey === 'model') {
            if (!modelConfig) {
                config[modelName] = {};
            }
            const originModels = (config[modelName] as Record<string, any>)[modelKey] || [];
            (config[modelName] as Record<string, any>)[modelKey] = flattenDeep([...originModels, value]);
            continue;
        }

        // Handling for compatible=true services
        const isCompatible = modelConfig && (modelConfig as any).compatible === true;
        if (isCompatible) {
            if (!modelConfig) {
                config[modelName] = {};
            }

            // Validate value with parser
            const parser = createConfigParser(modelName);
            if (!(parser as any)[modelKey]) {
                throw new KnownError(`Invalid config property: ${key}`);
            }

            try {
                (config[modelName] as Record<string, any>)[modelKey] = (parser as any)[modelKey](value);
            } catch (error: unknown) {
                if (error instanceof KnownError) {
                    throw error;
                }
                throw new KnownError(`Invalid value for ${key}: ${(error as Error).message}`);
            }
            continue;
        }

        // Existing logic for built-in services
        if (modelName in modelConfigParsers) {
            if (!modelConfig) {
                config[modelName] = {};
            }
            const parser = modelConfigParsers[modelName as keyof typeof modelConfigParsers][modelKey];
            if (!parser) {
                throw new KnownError(`Invalid config property: ${key}`);
            }
            (config[modelName] as Record<string, any>)[modelKey] = (parser as any)(value);
        } else {
            // Default parser for new services
            const parser = createConfigParser(modelName);
            if (!(parser as any)[modelKey]) {
                throw new KnownError(`Invalid config property: ${key}`);
            }
            if (!config[modelName]) {
                config[modelName] = {};
            }
            (config[modelName] as Record<string, any>)[modelKey] = (parser as any)[modelKey](value);
        }
    }

    const writePath = getWriteConfigPath();
    await fs.writeFile(writePath, ini.stringify(config), 'utf8');
};

export const listConfigs = async () => {
    const config = await readConfigFile(); // Load config from any supported path
    console.log(ini.stringify(config));
};

export const printConfigPath = async () => {
    await readConfigFile(); // Ensure loadedConfigPath is populated
    console.log(loadedConfigPath || 'No configuration file loaded.');
};

const createConfigParser = (serviceName: string) => ({
    compatible: (compatible?: string | boolean) => {
        if (typeof compatible === 'boolean') {
            return compatible;
        }
        if (compatible === undefined || compatible === null) {
            return false;
        }
        parseAssert('compatible', /^(?:true|false)$/.test(compatible), 'Must be a boolean(true or false)');
        return compatible === 'true';
    },
    stream: (stream?: boolean) => {
        if (typeof stream === 'boolean') {
            return stream;
        }
        if (stream === undefined || stream === null) {
            return false;
        }
        parseAssert('stream', /^(?:true|false)$/.test(stream), 'Must be a boolean(true or false)');
        return stream === 'true';
    },
    url: (url?: string) => {
        if (!url) {
            return '';
        }
        parseAssert(`${serviceName}.url`, /^https?:\/\//.test(url), 'Must be a valid URL');
        return url;
    },
    path: (path?: string) => path || '',
    key: (key?: string) => key || '',
    envKey: (envKey?: string) => envKey || '',
    model: (model?: string) => model || '',
    systemPrompt: generalConfigParsers.systemPrompt,
    systemPromptPath: generalConfigParsers.systemPromptPath,
    codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
    timeout: generalConfigParsers.timeout,
    temperature: generalConfigParsers.temperature,
    maxTokens: generalConfigParsers.maxTokens,
    logging: generalConfigParsers.logging,
    locale: generalConfigParsers.locale,
    generate: generalConfigParsers.generate,
    type: generalConfigParsers.type,
    maxLength: generalConfigParsers.maxLength,
    includeBody: generalConfigParsers.includeBody,
    topP: generalConfigParsers.topP,
    codeReview: generalConfigParsers.codeReview,
    disabled: generalConfigParsers.disabled,
    watchMode: generalConfigParsers.watchMode,
});
