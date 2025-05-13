import { command } from 'cleye';

import { ConsoleManager } from '../managers/console.manager.js';
import { addConfigs, getConfig, hasOwn, listConfigs, setConfigs } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';

export default command(
    {
        name: 'config',
        parameters: ['<mode>', '[key=value...]'],
        help: {
            description: 'Manage configuration settings',
            examples: [
                'aic2 config set <key>=<value> [<key>=<value> ...]',
                'aic2 config get [<key> [<key> ...]]',
                'aic2 config add <key>=<value> [<key>=<value> ...]',
                'aic2 config list',
            ],
        },
        commands: [
            command({
                name: 'set',
                parameters: ['<key>=<value>', '[<key>=<value> ...]'],
                help: {
                    description: 'Set configuration values. Multiple key-value pairs can be set at once.',
                    examples: ['aic2 config set OPENAI.key=<your key>', 'aic2 config set ANTHROPIC.topP=0.8 ANTHROPIC.generate=2'],
                },
            }),
            command({
                name: 'get',
                parameters: ['[<key>', '[<key> ...]]'],
                help: {
                    description: 'Retrieve configuration values for specified AI provider.',
                    examples: ['aic2 config get OPENAI', 'aic2 config get ANTHROPIC'],
                },
            }),
            command({
                name: 'add',
                parameters: ['<key>=<value>', '[<key>=<value> ...]'],
                help: {
                    description: 'Add new model to existing configuration. Only Ollama.model can be added.',
                    examples: ['aic2 config add OLLAMA.model="gemma2"'],
                },
            }),

            command({
                name: 'list',
                parameters: [],
                help: {
                    description: 'Display all configuration keys and their values.',
                    examples: ['aic2 config list'],
                },
            }),
        ],
    },
    argv => {
        (async () => {
            const { mode, keyValue: keyValues } = argv._;

            if (mode === 'get') {
                const config = await getConfig({}, []);
                // If no keys are provided, print all configs
                if (keyValues.length === 0) {
                    for (const [key, value] of Object.entries(config)) {
                        console.log(key, value);
                    }
                    return;
                }
                // Otherwise print only the requested keys
                for (const key of keyValues) {
                    if (hasOwn(config, key)) {
                        console.log(key, config[key as keyof typeof config]);
                    }
                }
                return;
            }

            if (mode === 'set') {
                await setConfigs(
                    keyValues.map(keyValue => {
                        const firstEqualIndex = keyValue.indexOf('=');
                        if (firstEqualIndex === -1) {
                            throw new KnownError(`Invalid format. Use: key=value`);
                        }
                        const key = keyValue.slice(0, firstEqualIndex);
                        const value = keyValue.slice(firstEqualIndex + 1);
                        return [key, value] as [string, string];
                    })
                );
                return;
            }

            if (mode === 'add') {
                await addConfigs(
                    keyValues.map(keyValue => {
                        const firstEqualIndex = keyValue.indexOf('=');
                        if (firstEqualIndex === -1) {
                            throw new KnownError(`Invalid format. Use: key=value`);
                        }
                        const key = keyValue.slice(0, firstEqualIndex);
                        const value = keyValue.slice(firstEqualIndex + 1);
                        return [key, value] as [string, string];
                    })
                );
                return;
            }

            if (mode === 'list') {
                await listConfigs();
                return;
            }

            throw new KnownError(`Invalid mode: ${mode}`);
        })().catch(error => {
            const commandLineManager = new ConsoleManager();
            commandLineManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);
