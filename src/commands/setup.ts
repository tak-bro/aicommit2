import { command } from 'cleye';
import inquirer from 'inquirer';

import { ConsoleManager } from '../managers/console.manager.js';
import { BUILTIN_SERVICES, DEFAULT_OLLAMA_HOST, setConfigs } from '../utils/config.js';
import { handleCliError } from '../utils/error.js';

const consoleManager = new ConsoleManager();

interface ProviderInfo {
    displayName: string;
    authType: 'api-key' | 'cookie' | 'none' | 'complex';
    envKeyHint?: string;
    defaultModel?: string;
    setupNotes?: string;
}

const PROVIDER_INFO: Record<string, ProviderInfo> = {
    OPENAI: {
        displayName: 'OpenAI (ChatGPT)',
        authType: 'api-key',
        envKeyHint: 'OPENAI_API_KEY',
        defaultModel: 'gpt-4o-mini',
    },
    OPENROUTER: {
        displayName: 'OpenRouter',
        authType: 'api-key',
        envKeyHint: 'OPENROUTER_API_KEY',
        defaultModel: 'openrouter/auto',
        setupNotes: 'OpenRouter supports many upstream models. You can keep openrouter/auto or choose a specific model slug.',
    },
    ANTHROPIC: {
        displayName: 'Anthropic (Claude)',
        authType: 'api-key',
        envKeyHint: 'ANTHROPIC_API_KEY',
        defaultModel: 'claude-sonnet-4-20250514',
    },
    GEMINI: {
        displayName: 'Google Gemini',
        authType: 'api-key',
        envKeyHint: 'GEMINI_API_KEY',
        defaultModel: 'gemini-1.5-flash',
    },
    OLLAMA: {
        displayName: 'Ollama (Local)',
        authType: 'none',
        defaultModel: 'llama3.2',
        setupNotes: 'Ollama runs locally — no API key needed. Make sure Ollama is running.',
    },
    GROQ: {
        displayName: 'Groq',
        authType: 'api-key',
        envKeyHint: 'GROQ_API_KEY',
        defaultModel: 'llama-3.3-70b-versatile',
    },
    DEEPSEEK: {
        displayName: 'DeepSeek',
        authType: 'api-key',
        envKeyHint: 'DEEPSEEK_API_KEY',
        defaultModel: 'deepseek-chat',
    },
    MISTRAL: {
        displayName: 'Mistral AI',
        authType: 'api-key',
        envKeyHint: 'MISTRAL_API_KEY',
        defaultModel: 'mistral-small-latest',
    },
    CODESTRAL: {
        displayName: 'Codestral',
        authType: 'api-key',
        envKeyHint: 'CODESTRAL_API_KEY',
        defaultModel: 'codestral-latest',
    },
    COHERE: {
        displayName: 'Cohere',
        authType: 'api-key',
        envKeyHint: 'COHERE_API_KEY',
        defaultModel: 'command-r-plus',
    },
    PERPLEXITY: {
        displayName: 'Perplexity',
        authType: 'api-key',
        envKeyHint: 'PERPLEXITY_API_KEY',
        defaultModel: 'sonar',
    },
    GITHUB_MODELS: {
        displayName: 'GitHub Models',
        authType: 'api-key',
        envKeyHint: 'GITHUB_MODELS_API_KEY',
        defaultModel: 'gpt-4o-mini',
        setupNotes: 'Use a GitHub personal access token. Run `aic2 github-login` for browser-based auth.',
    },
    HUGGINGFACE: {
        displayName: 'Hugging Face',
        authType: 'cookie',
        defaultModel: 'CohereForAI/c4ai-command-r-plus',
        setupNotes: 'Requires a Hugging Face cookie for authentication.',
    },
    BEDROCK: {
        displayName: 'AWS Bedrock',
        authType: 'complex',
        setupNotes: 'Requires AWS credentials. Configure via AWS CLI or set region + access keys.',
    },
};

// Popular providers shown first for selection
const POPULAR_PROVIDERS = ['OPENAI', 'OPENROUTER', 'ANTHROPIC', 'GEMINI', 'OLLAMA', 'GROQ', 'DEEPSEEK'];

export default command(
    {
        name: 'setup',
        parameters: [],
        help: {
            description: 'Interactive setup wizard for configuring AI providers',
            examples: ['aic2 setup'],
        },
    },
    argv => {
        (async () => {
            consoleManager.printTitle();
            console.log();
            consoleManager.printInfo("Welcome to aicommit2 setup! Let's configure your AI providers.\n");

            // eslint-disable-next-line no-constant-condition
            while (true) {
                const selected = await selectProvider();
                if (!selected) {
                    break;
                }

                await configureProvider(selected.key, selected.info);

                const { addMore } = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'addMore',
                        message: 'Would you like to configure another provider?',
                        default: false,
                    },
                ]);

                if (!addMore) {
                    break;
                }
                console.log();
            }

            consoleManager.printSuccess('Setup complete! Run `aic2` to generate commit messages.');
        })().catch(error => {
            consoleManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);

interface ProviderSelection {
    key: string;
    info: ProviderInfo;
}

const selectProvider = async (): Promise<ProviderSelection | null> => {
    const popularChoices = POPULAR_PROVIDERS.map(key => ({
        name: PROVIDER_INFO[key].displayName,
        value: key,
    }));

    const otherProviders = BUILTIN_SERVICES.filter(s => !POPULAR_PROVIDERS.includes(s));
    const otherChoices = otherProviders.map(key => ({
        name: PROVIDER_INFO[key]?.displayName || key,
        value: key,
    }));

    const { provider } = await inquirer.prompt([
        {
            type: 'list',
            name: 'provider',
            message: 'Select an AI provider to configure:',
            choices: [
                new inquirer.Separator('── Popular ──'),
                ...popularChoices,
                new inquirer.Separator('── Other ──'),
                ...otherChoices,
                new inquirer.Separator(),
                { name: 'Done (exit setup)', value: null },
            ],
        },
    ]);

    if (!provider) {
        return null;
    }

    const info = PROVIDER_INFO[provider] || { displayName: provider, authType: 'api-key' as const };
    return { key: provider, info };
};

const configureProvider = async (providerKey: string, provider: ProviderInfo): Promise<void> => {
    console.log();

    if (provider.setupNotes) {
        consoleManager.printInfo(provider.setupNotes);
        console.log();
    }

    const configs: [string, string][] = [];

    switch (provider.authType) {
        case 'api-key': {
            const { apiKey } = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'apiKey',
                    message: `Enter your ${provider.displayName} API key:`,
                    mask: '*',
                    validate: (input: string) => {
                        if (!input.trim()) {
                            return 'API key is required';
                        }
                        return true;
                    },
                },
            ]);
            configs.push([`${providerKey}.key`, apiKey.trim()]);
            break;
        }
        case 'cookie': {
            const { cookie } = await inquirer.prompt([
                {
                    type: 'password',
                    name: 'cookie',
                    message: `Enter your ${provider.displayName} cookie:`,
                    mask: '*',
                    validate: (input: string) => {
                        if (!input.trim()) {
                            return 'Cookie is required';
                        }
                        return true;
                    },
                },
            ]);
            configs.push([`${providerKey}.cookie`, cookie.trim()]);
            break;
        }
        case 'none': {
            // Ollama — just need host and model
            const { host } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'host',
                    message: 'Ollama host URL:',
                    default: DEFAULT_OLLAMA_HOST,
                },
            ]);
            if (host && host !== DEFAULT_OLLAMA_HOST) {
                configs.push([`${providerKey}.host`, host.trim()]);
            }
            break;
        }
        case 'complex': {
            // Bedrock — guide through AWS setup
            consoleManager.printInfo('AWS Bedrock requires region and credentials.');
            console.log();

            const { region } = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'region',
                    message: 'AWS Region (e.g., us-east-1):',
                    validate: (input: string) => {
                        if (!input.trim()) {
                            return 'Region is required';
                        }
                        return true;
                    },
                },
            ]);
            configs.push([`${providerKey}.region`, region.trim()]);

            const { authMethod } = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'authMethod',
                    message: 'Authentication method:',
                    choices: [
                        { name: 'AWS Profile (from ~/.aws/credentials)', value: 'profile' },
                        { name: 'Access Key + Secret Key', value: 'keys' },
                        { name: 'Environment variables (already set)', value: 'env' },
                    ],
                },
            ]);

            if (authMethod === 'profile') {
                const { profile } = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'profile',
                        message: 'AWS Profile name:',
                        default: 'default',
                    },
                ]);
                configs.push([`${providerKey}.profile`, profile.trim()]);
            } else if (authMethod === 'keys') {
                const { accessKeyId, secretAccessKey } = await inquirer.prompt([
                    {
                        type: 'password',
                        name: 'accessKeyId',
                        message: 'AWS Access Key ID:',
                        mask: '*',
                    },
                    {
                        type: 'password',
                        name: 'secretAccessKey',
                        message: 'AWS Secret Access Key:',
                        mask: '*',
                    },
                ]);
                configs.push([`${providerKey}.accessKeyId`, accessKeyId.trim()]);
                configs.push([`${providerKey}.secretAccessKey`, secretAccessKey.trim()]);
            }
            // For 'env', no config needed — AWS SDK reads from environment
            break;
        }
    }

    // Model selection
    const { model } = await inquirer.prompt([
        {
            type: 'input',
            name: 'model',
            message: 'Model to use (comma-separated for multiple):',
            default: provider.defaultModel || '',
            validate: (input: string) => {
                if (!input.trim()) {
                    return 'At least one model is required';
                }
                return true;
            },
        },
    ]);
    configs.push([`${providerKey}.model`, model.trim()]);

    // Save configuration
    const spinner = consoleManager.displaySpinner('Saving configuration...');
    try {
        await setConfigs(configs);
        consoleManager.stopSpinner(spinner);
        consoleManager.printSuccess(`${provider.displayName} configured successfully!`);

        if (provider.envKeyHint) {
            console.log(`  Tip: You can also set the ${provider.envKeyHint} environment variable instead.`);
        }
    } catch (error) {
        consoleManager.stopSpinner(spinner);
        consoleManager.printError(`Failed to save configuration: ${(error as Error).message}`);
    }
};
