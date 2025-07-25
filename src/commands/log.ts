import { exec } from 'node:child_process';
import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import chalk from 'chalk';
import { command } from 'cleye';

import { ConsoleManager } from '../managers/console.manager.js';
import { AICOMMIT_LOGS_DIR } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';

const execAsync = promisify(exec);

const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) {
        return '0 B';
    }
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
};

const formatDate = (date: Date): string => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

const listLogFiles = async (consoleManager: ConsoleManager) => {
    try {
        const files = await readdir(AICOMMIT_LOGS_DIR);

        if (files.length === 0) {
            console.log(`${chalk.yellow('No log files found.')}`);
            return;
        }

        console.log(`${chalk.blue('Log files in')} ${AICOMMIT_LOGS_DIR}:\n`);

        const fileInfos = await Promise.all(
            files.map(async file => {
                const filePath = path.join(AICOMMIT_LOGS_DIR, file);
                const stats = await stat(filePath);
                return {
                    name: file,
                    size: formatFileSize(stats.size),
                    modified: formatDate(stats.mtime),
                };
            })
        );

        // Sort by modification time (newest first)
        fileInfos.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());

        fileInfos.forEach((file, index) => {
            const prefix = index === 0 ? '📄' : '  ';
            console.log(`${prefix} ${chalk.cyan(file.name)} ${chalk.gray(`(${file.size}, ${file.modified})`)}`);
        });

        console.log(`\n${chalk.green('Total:')} ${files.length} file${files.length !== 1 ? 's' : ''}`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`${chalk.yellow('Logs directory does not exist yet.')}`);
        } else {
            throw error;
        }
    }
};

const openLogsDirectory = async (consoleManager: ConsoleManager) => {
    try {
        // Ensure directory exists
        await readdir(AICOMMIT_LOGS_DIR);

        const platform = process.platform;
        let command: string;

        switch (platform) {
            case 'darwin':
                command = `open "${AICOMMIT_LOGS_DIR}"`;
                break;
            case 'win32':
                command = `start "" "${AICOMMIT_LOGS_DIR}"`;
                break;
            default: // linux and others
                command = `xdg-open "${AICOMMIT_LOGS_DIR}"`;
                break;
        }

        await execAsync(command);
        console.log(`${chalk.green('✔')} Opened logs directory in file manager`);
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            console.log(`${chalk.yellow('Logs directory does not exist yet.')}`);
        } else {
            consoleManager.printError(`Failed to open logs directory: ${error.message}`);
        }
    }
};

const removeAllLogs = async (consoleManager: ConsoleManager) => {
    try {
        await rm(AICOMMIT_LOGS_DIR, { recursive: true, force: true });
        console.log(`${chalk.green('✔')} All log files removed!`);
    } catch (error: any) {
        consoleManager.printError(`Failed to remove log files: ${error.message}`);
    }
};

export default command(
    {
        name: 'log',
        parameters: ['<action>'],
        help: {
            description: 'Manage log files generated by the application',
            examples: [
                'aic2 log list        # List all log files',
                'aic2 log path        # Show logs directory path',
                'aic2 log open        # Open logs directory',
                'aic2 log removeAll   # Remove all log files',
            ],
        },
    },
    argv => {
        (async () => {
            const { action } = argv._;
            const consoleManager = new ConsoleManager();

            switch (action) {
                case 'list':
                    await listLogFiles(consoleManager);
                    break;

                case 'path':
                    console.log(`${chalk.blue('Logs directory:')} ${AICOMMIT_LOGS_DIR}`);
                    break;

                case 'open':
                    await openLogsDirectory(consoleManager);
                    break;

                case 'removeAll':
                    await removeAllLogs(consoleManager);
                    break;

                default:
                    throw new KnownError(`Invalid action: ${action}. Use 'list', 'path', 'open', or 'removeAll'`);
            }
        })().catch(error => {
            const commandLineManager = new ConsoleManager();
            commandLineManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);
