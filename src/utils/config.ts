import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import ini from 'ini';

import { KnownError } from './error.js';
import { fileExists } from './fs.js';
import { flattenDeep } from './utils.js';

export const resolvePromptPath = (promptPath: string): string => {
    if (!promptPath || typeof promptPath !== 'string') {
        return '';
    }
    // Check if it's an absolute path
    if (path.isAbsolute(promptPath)) {
        return path.resolve(promptPath);
    } else if (loadedConfigPath) {
        // If not absolute, try combining with the config file directory
        const configDir = path.dirname(loadedConfigPath);
        const absolutePath = path.join(configDir, promptPath);
        return path.resolve(absolutePath);
    } else {
        return ''; // If no config file loaded and path is relative, ignore
    }
};

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
    'GITHUB_MODELS',
    'BEDROCK',
] as const;
export type BuiltinService = (typeof BUILTIN_SERVICES)[number];

const getXdgBaseDirectory = (type: 'config' | 'data' | 'cache' | 'state'): string => {
    const platform = os.platform();
    const homeDir = os.homedir();

    let xdgVar: string | undefined;
    let platformFallback: string;

    // Determine the XDG environment variable
    switch (type) {
        case 'config':
            xdgVar = process.env.XDG_CONFIG_HOME;
            break;
        case 'data':
            xdgVar = process.env.XDG_DATA_HOME;
            break;
        case 'cache':
            xdgVar = process.env.XDG_CACHE_HOME;
            break;
        case 'state':
            xdgVar = process.env.XDG_STATE_HOME;
            break;
        default:
            xdgVar = undefined; // Should not happen with strict type
    }

    // Determine platform-specific fallback
    if (platform === 'darwin') {
        // macOS
        if (type === 'cache') {
            platformFallback = path.join(homeDir, 'Library', 'Caches');
        } else {
            platformFallback = path.join(homeDir, 'Library', 'Application Support');
        }
    } else if (platform === 'win32') {
        // Windows
        platformFallback = process.env.LOCALAPPDATA || homeDir;
    } else {
        // Linux and others (default XDG fallbacks)
        switch (type) {
            case 'config':
                platformFallback = path.join(homeDir, '.config');
                break;
            case 'data':
                platformFallback = path.join(homeDir, '.local', 'share');
                break;
            case 'cache':
                platformFallback = path.join(homeDir, '.cache');
                break;
            case 'state':
                platformFallback = path.join(homeDir, '.local', 'state');
                break;
            default:
                platformFallback = homeDir; // Should not happen
        }
    }

    return xdgVar || platformFallback;
};

export const AICOMMIT_CONFIG_DIR = path.join(getXdgBaseDirectory('config'), 'aicommit2');
export const AICOMMIT_LOGS_DIR = path.join(getXdgBaseDirectory('state'), 'aicommit2', 'logs');
export const AICOMMIT_CONFIG_FILE_PATH = path.join(AICOMMIT_CONFIG_DIR, 'config.ini');
export const AICOMMIT_MAIN_LOG_FILE_PATH = path.join(AICOMMIT_LOGS_DIR, 'aicommit2-%DATE%.log');
export const AICOMMIT_EXCEPTION_LOG_FILE_PATH = path.join(AICOMMIT_LOGS_DIR, 'exceptions-%DATE%.log');

const findAllServices = (config: RawConfig): string[] => {
    const sections = Object.keys(config);

    // Include all built-in services and added sections
    const allServices = new Set([
        ...BUILTIN_SERVICES,
        ...sections.filter(section =>
            // Validate configuration section name rules (only uppercase letters and underscores allowed)
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

const createBoolParser =
    (name: string, defaultValue = false) =>
    (value?: string | boolean): boolean => {
        if (typeof value === 'boolean') {
            return value;
        }
        if (value === undefined || value === null) {
            return defaultValue;
        }
        parseAssert(name, /^(?:true|false)$/.test(value), 'Must be a boolean(true or false)');
        return value === 'true';
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
    logLevel(logLevel?: string) {
        if (!logLevel) {
            return 'info';
        }
        parseAssert(
            'logLevel',
            /^(?:error|warn|info|http|verbose|debug|silly)$/.test(logLevel),
            'Must be a valid log level (error, warn, info, http, verbose, debug, silly)'
        );
        return logLevel;
    },
    logFilePath(logFilePath?: string) {
        if (!logFilePath) {
            return AICOMMIT_MAIN_LOG_FILE_PATH;
        }
        return logFilePath;
    },
    exceptionLogFilePath(exceptionLogFilePath?: string) {
        if (!exceptionLogFilePath) {
            return AICOMMIT_EXCEPTION_LOG_FILE_PATH;
        }
        return exceptionLogFilePath;
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
    logging: createBoolParser('logging', true),
    includeBody: createBoolParser('includeBody'),
    codeReview: createBoolParser('codeReview'),
    disabled: createBoolParser('disabled'),
    watchMode: createBoolParser('watchMode'),
    forceGit: createBoolParser('forceGit'),
    disableLowerCase: createBoolParser('disableLowerCase'),
} as const;

const modelConfigParsers: Record<ModelName, Record<string, (value: any) => any>> = {
    OPENAI: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['gpt-4o-mini'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
        },
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    HUGGINGFACE: {
        cookie: (cookie?: string) => cookie || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return [`CohereForAI/c4ai-command-r-plus`];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
        },
        systemPrompt: generalConfigParsers.systemPrompt,
        systemPromptPath: generalConfigParsers.systemPromptPath,
        codeReviewPromptPath: generalConfigParsers.codeReviewPromptPath,
        timeout: generalConfigParsers.timeout,
        temperature: generalConfigParsers.temperature,
        maxTokens: generalConfigParsers.maxTokens,
        topP: generalConfigParsers.topP,
        logging: generalConfigParsers.logging,
        locale: generalConfigParsers.locale,
        generate: generalConfigParsers.generate,
        type: generalConfigParsers.type,
        maxLength: generalConfigParsers.maxLength,
        includeBody: generalConfigParsers.includeBody,
        codeReview: generalConfigParsers.codeReview,
        disabled: generalConfigParsers.disabled,
        watchMode: generalConfigParsers.watchMode,
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    GEMINI: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['gemini-2.0-flash'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    ANTHROPIC: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['claude-3-5-haiku-20241022'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    MISTRAL: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['mistral-small-latest'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    CODESTRAL: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['codestral-latest'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    COHERE: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['command-r'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    GROQ: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['llama-3.3-70b-versatile'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    PERPLEXITY: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['sonar'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    DEEPSEEK: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return [`deepseek-coder`];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;

            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    GITHUB_MODELS: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => envKey || '',
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['gpt-4o-mini'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
    },
    BEDROCK: {
        key: (key?: string) => key || '',
        envKey: (envKey?: string) => (envKey && envKey.length > 0 ? envKey : 'BEDROCK_API_KEY'),
        model: (model?: string | string[]): string[] => {
            if (!model) {
                return ['anthropic.claude-haiku-4-5-20251001-v1:0'];
            }
            const modelList = typeof model === 'string' ? model?.split(',') : model;
            return modelList
                .map(m => {
                    const trimmed = m.trim();
                    // Validate Bedrock model ID format: should contain a dot or be an ARN
                    if (trimmed && !trimmed.includes('.') && !trimmed.includes(':')) {
                        console.warn(
                            `[Bedrock] Model ID "${trimmed}" may be invalid. Expected format: "provider.model-name-version" or ARN`
                        );
                    }
                    return trimmed;
                })
                .filter(m => !!m && m.length > 0);
        },
        runtimeMode: (runtimeMode?: string, context?: { model?: string | string[] }) => {
            // If explicitly set, validate and use it
            if (runtimeMode) {
                const normalized = runtimeMode.toString().trim().toLowerCase();
                parseAssert(
                    'BEDROCK.runtimeMode',
                    ['foundation', 'application'].includes(normalized),
                    'Must be either "foundation" or "application"'
                );
                return normalized;
            }

            // Auto-detect from model string if not specified
            const modelValue = context?.model;
            if (modelValue) {
                const modelList = typeof modelValue === 'string' ? [modelValue] : modelValue;
                // Check if any model contains "application-inference-profile"
                const hasApplicationProfile = modelList.some(m => m.includes('application-inference-profile'));
                if (hasApplicationProfile) {
                    return 'application';
                }
            }

            // Default to foundation mode
            return 'foundation';
        },
        region: (region?: string) => region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '',
        profile: (profile?: string) => profile || process.env.AWS_PROFILE || '',
        accessKeyId: (value?: string) => value || process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: (value?: string) => value || process.env.AWS_SECRET_ACCESS_KEY || '',
        sessionToken: (value?: string) => value || process.env.AWS_SESSION_TOKEN || '',
        applicationEndpointId: (value?: string) => value || process.env.BEDROCK_APPLICATION_ENDPOINT_ID || '',
        applicationInferenceProfileArn: (value?: string) =>
            value || process.env.BEDROCK_APPLICATION_INFERENCE_PROFILE_ARN || process.env.BEDROCK_INFERENCE_PROFILE_ARN || '',
        applicationBaseUrl: (value?: string) => value || process.env.BEDROCK_APPLICATION_BASE_URL || '',
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
        disableLowerCase: generalConfigParsers.disableLowerCase,
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

let loadedConfigPath: string | undefined;

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
const getGlobalConfigPaths = (): string[] => {
    const homeDir = os.homedir();
    const configPath = process.env.AICOMMIT_CONFIG_PATH;
    const xdgConfigPath = AICOMMIT_CONFIG_FILE_PATH;
    const oldConfigPath = path.join(homeDir, '.aicommit2');

    // Order of precedence for config file locations
    return [
        configPath, // Highest priority: explicitly set via environment variable
        xdgConfigPath, // Second priority: XDG-compliant location
        oldConfigPath, // Third priority: old default location
    ].filter((p): p is string => !!p);
};

export const getConfigPath = async (): Promise<string> => {
    const configPaths = getGlobalConfigPaths();
    for (const p of configPaths) {
        if (await fileExists(p)) {
            return p;
        }
    }
    // If no existing config file is found, return the XDG-compliant path as the default for writing
    return AICOMMIT_CONFIG_FILE_PATH;
};

export const readConfigFile = async (): Promise<RawConfig> => {
    const configPath = await getConfigPath(); // Use the shared function to get the path

    loadedConfigPath = configPath;
    try {
        const configContent = await fs.readFile(configPath, 'utf8');
        return ini.parse(configContent);
    } catch (error) {
        // If the file doesn't exist or can't be read, return an empty config
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            loadedConfigPath = undefined;
            return {};
        }
        console.error(`Error reading config file ${configPath}:`, error);
        loadedConfigPath = undefined;
        return {};
    }
};

export const getConfig = async (cliConfig: RawConfig, rawArgv: string[] = []): Promise<ValidConfig> => {
    const config = await readConfigFile();
    const parsedCliArgs = parseCliArgs(rawArgv);
    const mergedCliConfig = { ...cliConfig, ...parsedCliArgs };
    const parsedConfig: Record<string, unknown> = {};

    const services = findAllServices(config);

    const envConfig: RawConfig = {};

    for (const service of services) {
        const configuredEnvKey = (config[service] as Record<string, any>)?.envKey;
        let envKeys: (string | undefined)[];

        if (configuredEnvKey) {
            envKeys = [configuredEnvKey];
            if (service === 'BEDROCK' && configuredEnvKey !== 'BEDROCK_APPLICATION_API_KEY') {
                envKeys.push('BEDROCK_APPLICATION_API_KEY');
            }
        } else if (service === 'BEDROCK') {
            envKeys = ['BEDROCK_API_KEY', 'BEDROCK_APPLICATION_API_KEY'];
        } else {
            envKeys = [`${service}_API_KEY`];
        }

        const apiKey = envKeys
            .map(key => (key ? process.env[key] : undefined))
            .find((value): value is string => typeof value === 'string' && value.length > 0);

        if (apiKey) {
            envConfig[service] = { key: apiKey };
        }
    }

    const getValueWithPriority = (modelName: string, key: string) => {
        const cliValue = mergedCliConfig[`${modelName}.${key}`] ?? (mergedCliConfig[modelName] as Record<string, any>)?.[key];
        const envValue = (envConfig[modelName] as Record<string, any>)?.[key];
        const modelValue = (config[modelName] as Record<string, any>)?.[key];
        const generalValue = mergedCliConfig[key] ?? config[key];

        return cliValue !== undefined ? cliValue : envValue !== undefined ? envValue : modelValue !== undefined ? modelValue : generalValue;
    };

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

            // Special handling for BEDROCK runtimeMode: pass model as context for auto-detection
            if (modelName === 'BEDROCK' && key === 'runtimeMode') {
                const modelValue = getValueWithPriority(modelName, 'model');
                (parsedConfig[modelName] as Record<string, any>)[key] = (parser as any)(value, { model: modelValue });
            } else {
                (parsedConfig[modelName] as Record<string, any>)[key] = (parser as any)(value);
            }
        }
    }

    return parsedConfig as ValidConfig;
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

            // Special handling for BEDROCK runtimeMode: pass model as context for auto-detection
            if (modelName === 'BEDROCK' && modelKey === 'runtimeMode') {
                const modelValue = (config[modelName] as Record<string, any>)?.model;
                (config[modelName] as Record<string, any>)[modelKey] = (parser as any)(value, { model: modelValue });
            } else {
                (config[modelName] as Record<string, any>)[modelKey] = (parser as any)(value);
            }
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

    const writePath = await getConfigPath();
    const writeDir = path.dirname(writePath); // Get the directory path
    await fs.mkdir(writeDir, { recursive: true }); // Create the directory if it doesn't exist
    await fs.writeFile(writePath, ini.stringify(config), 'utf8');
};

export const addConfigs = async (keyValues: [key: string, value: any][]) => {
    const config = await readConfigFile(); // Load existing config from any supported path

    for (const [key, value] of keyValues) {
        const [modelName, modelKey] = key.split('.');
        const modelConfig = config[modelName];

        // Handle model property as array for all services
        if (modelKey === 'model') {
            if (!modelConfig) {
                config[modelName] = {};
            }
            const originModels = (config[modelName] as Record<string, any>)[modelKey] || [];
            // Ensure the value being added is also treated as an array if it's a string
            const valueToAdd =
                typeof value === 'string'
                    ? value
                          .split(',')
                          .map(v => v.trim())
                          .filter(v => !!v)
                    : value;
            (config[modelName] as Record<string, any>)[modelKey] = flattenDeep([...originModels, ...valueToAdd]);
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

    const writePath = await getConfigPath();
    const writeDir = path.dirname(writePath); // Get the directory path
    await fs.mkdir(writeDir, { recursive: true }); // Create the directory if it doesn't exist
    await fs.writeFile(writePath, ini.stringify(config), 'utf8');
};

export const listConfigs = async () => {
    const config = await readConfigFile(); // Load config from any supported path
    console.log(ini.stringify(config));
};

export const printConfigPath = async () => {
    console.log(await getConfigPath());
};

const createConfigParser = (serviceName: string) => ({
    compatible: createBoolParser('compatible'),
    stream: createBoolParser('stream'),
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
    model: (model?: string | string[]): string[] => {
        if (!model) {
            return [];
        }
        const modelList = typeof model === 'string' ? model?.split(',') : model;
        return modelList.map(m => m.trim()).filter(m => !!m && m.length > 0);
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
    disableLowerCase: generalConfigParsers.disableLowerCase,
});
