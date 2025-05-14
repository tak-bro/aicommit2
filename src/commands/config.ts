import fs from 'fs/promises';

import { command } from 'cleye';
import ini from 'ini';

import { ConsoleManager } from '../managers/console.manager.js';
import {
    addConfigs,
    getConfig,
    getWriteConfigPath,
    hasOwn,
    listConfigs,
    printConfigPath,
    readConfigFile,
    setConfigs,
} from '../utils/config.js';
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
                'aic2 config del <key>',
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
            command({
                name: 'del',
                parameters: ['<config-name>'],
                help: {
                    description: 'Delete a configuration setting or section.',
                    examples: ['aic2 config del <config-name>', 'aic2 config del OPENAI.key', 'aic2 config del OPENAI'],
                },
            }),
            command({
                name: 'path',
                parameters: [],
                help: {
                    description: 'Display the path of the loaded configuration file.',
                    examples: ['aic2 config path'],
                },
            }),
        ],
    },
    argv => {
        (async () => {
            const { mode, keyValue: keyValues } = argv._;
            const configName = argv._[1]; // Assuming config-name is the second parameter

            if (mode === 'get') {
                const config = await getConfig({}, []);
                // If no keys are provided, print all configs
                if (keyValues.length === 0) {
                    console.log(config);
                    return;
                }
                // Otherwise print only the requested keys
                for (const key of keyValues) {
                    const parts = key.split('.');
                    let currentValue: any = config;
                    let found = true;
                    for (const part of parts) {
                        if (hasOwn(currentValue, part)) {
                            currentValue = currentValue[part];
                        } else {
                            found = false;
                            break;
                        }
                    }
                    if (found) {
                        console.log(key, currentValue);
                    } else {
                        console.log(`${key} not found`);
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

            if (mode === 'del') {
                if (!configName) {
                    throw new KnownError('Please provide the config name to delete.');
                }

                const config = await readConfigFile();
                const parts = configName.split('.');

                if (parts.length === 2) {
                    const [section, key] = parts;
                    if (config[section] && typeof config[section] === 'object' && hasOwn(config[section], key)) {
                        delete (config[section] as Record<string, any>)[key];
                        // Optional: remove section if it becomes empty
                        if (Object.keys(config[section] as Record<string, any>).length === 0) {
                            delete config[section];
                        }
                        const writePath = getWriteConfigPath();
                        await fs.writeFile(writePath, ini.stringify(config), 'utf8');
                        console.log(`Successfully deleted config: ${configName}`);
                        // Re-read and print the file content for debugging
                        const updatedConfigContent = await fs.readFile(writePath, 'utf8');
                        console.log('--- Updated Config Content ---');
                        console.log(updatedConfigContent);
                        console.log('----------------------------');
                    } else {
                        throw new KnownError(`Config not found: ${configName}`);
                    }
                } else if (parts.length === 1) {
                    const key = parts[0];
                    if (hasOwn(config, key)) {
                        delete config[key];
                        const writePath = getWriteConfigPath();
                        await fs.writeFile(writePath, ini.stringify(config), 'utf8');
                        console.log(`Successfully deleted config: ${configName}`);
                        // Re-read and print the file content for debugging
                        const updatedConfigContent = await fs.readFile(writePath, 'utf8');
                        console.log('--- Updated Config Content ---');
                        console.log(updatedConfigContent);
                        console.log('----------------------------');
                    } else {
                        throw new KnownError(`Config not found: ${configName}`);
                    }
                } else {
                    throw new KnownError(`Invalid config name format: ${configName}`);
                }
                return;
            }

            if (mode === 'path') {
                await printConfigPath();
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
