import { execa } from 'execa';

import { KnownError } from './error.js';

export interface GitDiff {
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
    '*.lockb',
    '*.gif',
    '*.png',
].map(excludeFromDiff);

export const getStagedDiff = async (excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const diffCached = ['diff', '--cached', '--diff-algorithm=minimal'];
    const { stdout: files } = await execa('git', [
        ...diffCached,
        '--name-only',
        ...filesToExclude,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
        ...(exclude ? exclude.map(excludeFromDiff) : []),
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

export const getCommitDiff = async (commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const diffCommand = ['diff-tree', '-r', '--no-commit-id', '--name-only', commitHash];
    const { stdout: files } = await execa('git', [
        ...diffCommand,
        ...filesToExclude,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
        ...(exclude ? exclude.map(excludeFromDiff) : []),
    ]);

    if (!files) {
        return null;
    }

    const { stdout: diff } = await execa('git', [
        'show',
        commitHash,
        '--',
        ...filesToExclude,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
        ...(exclude ? exclude.map(excludeFromDiff) : []),
    ]);

    return {
        files: files.split('\n').filter(Boolean),
        diff,
    };
};

export const getDetectedCommit = (files: string[]) =>
    `Detected ${files.length.toLocaleString()} changed file${files.length > 1 ? 's' : ''}`;

export const getCommentChar = async (): Promise<string> => {
    const { stdout } = await execa('git', ['config', '--get', 'core.commentChar']);
    return stdout;
};
