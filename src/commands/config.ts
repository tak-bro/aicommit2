import { command } from 'cleye';

import { ConsoleManager } from '../managers/console.manager.js';
import { BUILTIN_SERVICES, ModelName, addConfigs, getConfig, hasOwn, listConfigs, setConfigs } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';

export default command(
    {
        name: 'config',
        parameters: ['<mode>', '[key=value...]'],
        help: {
            usage: [
                'aic2 config set <key>=<value> [<key>=<value> ...]',
                'aic2 config get [<key> [<key> ...]]',
                'aic2 config add <key>=<value> [<key>=<value> ...]',
                'aic2 config list',
            ].join('\n'),
        },
    },
    argv => {
        (async () => {
            const { mode, keyValue: keyValues } = argv._;

            if (mode === 'get') {
                const config = await getConfig({}, []);
                for (const key of keyValues) {
                    if (hasOwn(config, key)) {
                        const isModel = BUILTIN_SERVICES.includes(key as ModelName);
                        if (isModel) {
                            // @ts-ignore ignore
                            console.log(key, config[key]);
                            return;
                        }
                        console.log(`${key}=${config[key as keyof typeof config]}`);
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
                await addConfigs(keyValues.map(keyValue => keyValue.split('=') as [string, string]));
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
