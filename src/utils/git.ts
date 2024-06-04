import { execa } from 'execa';

import { KnownError } from './error.js';

export interface StagedDiff {
    files: string[];
    diff: string;
}

export const assertGitRepo = async () => {
    const { stdout, failed } = await execa('git', ['rev-parse', '--show-toplevel'], { reject: false });

    if (failed) {
        throw new KnownError('The current directory must be a Git repository!');
    }

    return stdout;
};

const excludeFromDiff = (path: string) => `:(exclude)${path}`;

const filesToExclude = [
    'package-lock.json',
    'pnpm-lock.yaml',
    // yarn.lock, Cargo.lock, Gemfile.lock, Pipfile.lock, etc.
    '*.lock',
    '*.gif',
    '*.png',
].map(excludeFromDiff);

export const getStagedDiff = async (excludeFiles?: string[]): Promise<StagedDiff | null> => {
    const diffCached = ['diff', '--cached', '--diff-algorithm=minimal'];
    const { stdout: files } = await execa('git', [
        ...diffCached,
        '--name-only',
        ...filesToExclude,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
    ]);

    if (!files) {
        return null;
    }

    const { stdout: diff } = await execa('git', [
        ...diffCached,
        ...filesToExclude,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
    ]);

    return {
        files: files.split('\n'),
        diff,
    };
};

export const getDetectedMessage = (files: string[]) =>
    `Detected ${files.length.toLocaleString()} staged file${files.length > 1 ? 's' : ''}`;
