import chalk from 'chalk';

import { version } from '../../package.json';

export class KnownError extends Error {}

const indent = '    ';

export const handleCliError = (error: any) => {
    const isNotError = !(error instanceof Error);
    if (isNotError) {
        return;
    }
    if (!(error instanceof KnownError)) {
        if (error.stack) {
            console.error(chalk.dim(error.stack.split('\n').slice(1).join('\n')));
        }
        console.error(`\n${indent}${chalk.dim(`aicommit2 v${version}`)}`);
        console.error(`\n${indent}Please open a Bug report with the information above:`);
        console.error(`${indent}https://github.com/tak-bro/aicommit2/issues/new/choose`);
    }
};
