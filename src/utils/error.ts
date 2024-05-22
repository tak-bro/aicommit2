import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

export const errorLogPath = path.join(os.homedir(), '.aicommit2_log');

export const createErrorLog = (aiName: string, diff: string, response: string) => {
    const now = new Date();
    const { year, month, day, hours, minutes, seconds } = getDateString(now);

    const title = `[${year}-${month}-${day} ${hours}:${minutes}:${seconds}] ${aiName}`;

    const fileName = generateLogFileName(now, diff);
    const fullPath = `${errorLogPath}/${fileName}`;
    if (fs.existsSync(fullPath)) {
        const originData = fs.readFileSync(fullPath, 'utf-8');
        writeFileSyncRecursive(fullPath, `${title}\n${response}\n${originData}`);
        return;
    }
    writeFileSyncRecursive(fullPath, `${title}\n${response}\n\n[Git Diff]\n${diff}`);
};

export const generateLogFileName = (date: Date, diff: string) => {
    const { year, month, day, hours, minutes, seconds } = getDateString(date);
    const hash = crypto.createHash('md5').update(diff).digest('hex').slice(0, 16);
    return `${year}${month}${day}_${hash}.log`;
};

export const writeFileSyncRecursive = (fileName: string, content: string = '') => {
    fs.mkdirSync(path.dirname(fileName), { recursive: true });
    fs.writeFileSync(fileName, content, 'utf-8');
};

export const getDateString = (date: Date) => {
    const year = date.getFullYear().toString();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return { year, month, day, hours, minutes, seconds };
};
