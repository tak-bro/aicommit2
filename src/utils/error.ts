import chalk from 'chalk';

import { ErrorCodeType } from './error-messages.js';
import { version } from '../../package.json';

export interface KnownErrorOptions {
    code?: ErrorCodeType;
    suggestions?: string[];
    cause?: Error;
}

/**
 * Error class for user-facing errors with actionable suggestions
 */
export class KnownError extends Error {
    readonly code?: ErrorCodeType;
    readonly suggestions: string[];

    constructor(message: string, options: KnownErrorOptions = {}) {
        super(message, { cause: options.cause });
        this.name = 'KnownError';
        this.code = options.code;
        this.suggestions = options.suggestions || [];
    }
}

const indent = '    ';

/**
 * Format and display CLI errors
 * - KnownError: Shows message with optional suggestions
 * - Unknown errors: Shows stack trace and bug report link
 */
export const handleCliError = (error: unknown): void => {
    if (!(error instanceof Error)) {
        return;
    }

    if (error instanceof KnownError) {
        // Display suggestions if available
        if (error.suggestions.length > 0) {
            console.error('');
            console.error(`${indent}${chalk.yellow('Suggestions:')}`);
            error.suggestions.forEach(suggestion => {
                console.error(`${indent}  ${chalk.dim('•')} ${suggestion}`);
            });
        }
        return;
    }

    // Unknown error - show stack trace and bug report link
    if (error.stack) {
        console.error(chalk.dim(error.stack.split('\n').slice(1).join('\n')));
    }
    console.error(`\n${indent}${chalk.dim(`aicommit2 v${version}`)}`);
    console.error(`\n${indent}Please open a Bug report with the information above:`);
    console.error(`${indent}https://github.com/tak-bro/aicommit2/issues/new/choose`);
};
