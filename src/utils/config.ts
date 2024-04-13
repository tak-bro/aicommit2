import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import ini from 'ini';

import { KnownError } from './error.js';
import { fileExists } from './fs.js';

import type { TiktokenModel } from '@dqbd/tiktoken';

const commitTypes = ['', 'conventional', 'gitmoji'] as const;
export type CommitType = (typeof commitTypes)[number];

const { hasOwnProperty } = Object.prototype;
export const hasOwn = (object: unknown, key: PropertyKey) => hasOwnProperty.call(object, key);

const parseAssert = (name: string, condition: any, message: string) => {
    if (!condition) {
        throw new KnownError(`Invalid config property ${name}: ${message}`);
    }
};

const configParsers = {
    OPENAI_KEY(key?: string) {
        if (!key) {
            return '';
        }
        return key;
    },
    OPENAI_MODEL(model?: string) {
        if (!model || model.length === 0) {
            return 'gpt-3.5-turbo';
        }

        return model as TiktokenModel;
    },
    OPENAI_URL(host?: string) {
        if (!host) {
            return 'https://api.openai.com';
        }
        parseAssert('OPENAI_URL', /^https?:\/\//.test(host), 'Must be a valid URL');
        return host;
    },
    OPENAI_PATH(path?: string) {
        if (!path) {
            return '/v1/chat/completions';
        }
        return path;
    },
    HUGGING_COOKIE(cookie?: string) {
        if (!cookie) {
            return '';
        }
        return cookie;
    },
    HUGGING_MODEL(model?: string) {
        if (!model || model.length === 0) {
            return `mistralai/Mixtral-8x7B-Instruct-v0.1`;
        }
        const supportModels = [
            'mistralai/Mixtral-8x7B-Instruct-v0.1',
            'meta-llama/Llama-2-70b-chat-hf',
            'NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO',
            'codellama/CodeLlama-70b-Instruct-hf',
            'mistralai/Mistral-7B-Instruct-v0.2',
            'openchat/openchat-3.5-0106',
        ];

        parseAssert('HUGGING_MODEL', supportModels.includes(model), 'Invalid model type of hugging');
        return model;
    },
    CLOVAX_COOKIE(cookie?: string) {
        if (!cookie) {
            return '';
        }
        return cookie;
    },
    GEMINI_KEY(key?: string) {
        if (!key) {
            return '';
        }
        return key;
    },
    GEMINI_MODEL(model?: string) {
        if (!model || model.length === 0) {
            return 'gemini-pro';
        }
        const supportModels = ['gemini-pro'];
        parseAssert('GEMINI_MODEL', supportModels.includes(model), 'Invalid model type of Gemini');
        return model;
    },
    ANTHROPIC_MODEL(model?: string) {
        if (!model || model.length === 0) {
            return 'claude-2.1';
        }
        const supportModels = ['claude-2.1', 'claude-2.0', 'claude-instant-1.2'];

        parseAssert('ANTHROPIC_MODEL', supportModels.includes(model), 'Invalid model type of Anthropic');
        return model;
    },
    ANTHROPIC_KEY(key?: string) {
        if (!key) {
            return '';
        }
        return key;
    },
    MISTRAL_KEY(key?: string) {
        if (!key) {
            return '';
        }
        return key;
    },
    MISTRAL_MODEL(model?: string) {
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

        parseAssert('MISTRAL_MODEL', supportModels.includes(model), 'Invalid model type of Mistral AI');
        return model;
    },
    OLLAMA_MODEL(model?: string) {
        if (!model) {
            return '';
        }
        return model;
    },
    OLLAMA_HOST(host?: string) {
        if (!host) {
            return 'http://localhost:11434';
        }
        parseAssert('OLLAMA_HOST', /^https?:\/\//.test(host), 'Must be a valid URL');
        return host;
    },
    OLLAMA_TIMEOUT(timeout?: string) {
        if (!timeout) {
            return 100_000;
        }

        parseAssert('OLLAMA_TIMEOUT', /^\d+$/.test(timeout), 'Must be an integer');

        const parsed = Number(timeout);
        parseAssert('OLLAMA_TIMEOUT', parsed >= 500, 'Must be greater than 500ms');

        return parsed;
    },
    // NOTE: it's experimental features
    OLLAMA_STREAM(stream?: string | boolean) {
        if (!stream) {
            return false;
        }
        if (typeof stream === 'boolean') {
            return stream;
        }

        parseAssert('OLLAMA_STREAM', /^(?:true|false)$/.test(stream), 'Must be a boolean');
        return stream === 'true';
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
    prompt(prompt?: string) {
        if (!prompt) {
            return '';
        }
        return prompt;
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
    proxy(url?: string) {
        if (!url || url.length === 0) {
            return undefined;
        }

        parseAssert('proxy', /^https?:\/\//.test(url), 'Must be a valid URL');

        return url;
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
    'max-length'(maxLength?: string) {
        if (!maxLength) {
            return 50;
        }

        parseAssert('max-length', /^\d+$/.test(maxLength), 'Must be an integer');

        const parsed = Number(maxLength);
        parseAssert('max-length', parsed >= 20, 'Must be greater than 20 characters');

        return parsed;
    },
    'max-tokens'(maxTokens?: string) {
        if (!maxTokens) {
            return 200;
        }

        parseAssert('max-tokens', /^\d+$/.test(maxTokens), 'Must be an integer');
        const parsed = Number(maxTokens);
        return parsed;
    },
} as const;

type ConfigKeys = keyof typeof configParsers;

type RawConfig = {
    [key in ConfigKeys]?: string;
};

export type ValidConfig = {
    [Key in ConfigKeys]: ReturnType<(typeof configParsers)[Key]>;
};

const configPath = path.join(os.homedir(), '.aicommit2');

const readConfigFile = async (): Promise<RawConfig> => {
    const configExists = await fileExists(configPath);
    if (!configExists) {
        return Object.create(null);
    }

    const configString = await fs.readFile(configPath, 'utf8');
    return ini.parse(configString);
};

export const getConfig = async (cliConfig?: RawConfig, suppressErrors?: boolean): Promise<ValidConfig> => {
    const config = await readConfigFile();
    const parsedConfig: Record<string, unknown> = {};

    for (const key of Object.keys(configParsers) as ConfigKeys[]) {
        const parser = configParsers[key];
        const value: any = cliConfig?.[key] ?? config[key];

        if (suppressErrors) {
            try {
                parsedConfig[key] = parser(value);
            } catch {
                /* empty */
            }
        } else {
            parsedConfig[key] = parser(value);
        }
    }

    return parsedConfig as ValidConfig;
};

export const setConfigs = async (keyValues: [key: string, value: any][]) => {
    const config = await readConfigFile();

    for (const [key, value] of keyValues) {
        if (!hasOwn(configParsers, key)) {
            throw new KnownError(`Invalid config property: ${key}`);
        }

        const parsed = configParsers[key as ConfigKeys](value);
        config[key as ConfigKeys] = parsed as any;
    }

    await fs.writeFile(configPath, ini.stringify(config), 'utf8');
};
