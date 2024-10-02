import { rm } from 'node:fs/promises';

import chalk from 'chalk';
import { command } from 'cleye';

import { ConsoleManager } from '../managers/console.manager.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { logPath } from '../utils/log.js';

export default command(
    {
        name: 'log',
        parameters: ['<removeAll>'],
    },
    argv => {
        (async () => {
            const { removeAll } = argv._;

            if (removeAll === 'removeAll') {
                await rm(logPath, { recursive: true, force: true });
                console.log(`${chalk.green('✔')} All Log files are removed!`);
                return;
            }

            throw new KnownError(`Invalid mode: ${removeAll}`);
        })().catch(error => {
            const commandLineManager = new ConsoleManager();
            commandLineManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);
