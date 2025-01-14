import { command } from 'cleye';

import { ConsoleManager } from '../managers/console.manager.js';
import { BUILTIN_SERVICES, ModelName, addConfigs, getConfig, hasOwn, setConfigs } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';

export default command(
    {
        name: 'config',
        parameters: ['<mode>', '<key=value...>'],
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
                await setConfigs(keyValues.map(keyValue => keyValue.split('=') as [string, string]));
                return;
            }

            if (mode === 'add') {
                await addConfigs(keyValues.map(keyValue => keyValue.split('=') as [string, string]));
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
