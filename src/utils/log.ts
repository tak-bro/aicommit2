import fs from 'fs';
import os from 'os';
import path from 'path';

import { xxh64 } from '@pacote/xxhash';

export const logPath = path.join(os.homedir(), '.aicommit2_log');

const now = new Date();

export const createLogResponse = (aiName: string, diff: string, prompt: string, response: string) => {
    const title = `[${aiName}]`;
    const fileName = generateLogFileName(now, diff);
    const fullPath = `${logPath}/${fileName}`;
    const systemPrompt = `- System Prompt\n${prompt}`;
    const aiResponse = `- Response\n${response}`;
    const diffContent = `[Git Diff]\n${diff}`;
    if (fs.existsSync(fullPath)) {
        const originData = fs.readFileSync(fullPath, 'utf-8');
        writeFileSyncRecursive(fullPath, `${title}\n${aiResponse}\n\n${systemPrompt}\n\n${originData}`);
        return;
    }
    writeFileSyncRecursive(fullPath, `${title}\n${aiResponse}\n\n${systemPrompt}\n\n${diffContent}`);
};

export const generateLogFileName = (date: Date, diff: string) => {
    const { year, month, day, hours, minutes, seconds } = getDateString(date);
    const hasher = xxh64(0);
    const hash = hasher.update(diff).digest('hex');
    return `aic2_${year}-${month}-${day}_${hours}:${minutes}:${seconds}_${hash}.log`;
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
