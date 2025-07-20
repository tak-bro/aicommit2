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

    // Get the regular diff
    const { stdout: diff } = await execa('git', [
        ...diffCached,
        ...filesToExclude,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
        ...(exclude ? exclude.map(excludeFromDiff) : []),
    ]);

    // Get file list including binary files
    const allFiles = files.split('\n').filter(Boolean);

    // Check for binary files that git can't diff
    const { stdout: binaryCheck } = await execa('git', [
        ...diffCached,
        '--numstat',
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
        ...(exclude ? exclude.map(excludeFromDiff) : []),
    ]);

    const binaryFiles: string[] = [];
    const numstatLines = binaryCheck.split('\n').filter(Boolean);

    for (const line of numstatLines) {
        const parts = line.split('\t');
        // Binary files show as "-\t-\t" in numstat
        if (parts[0] === '-' && parts[1] === '-' && parts[2]) {
            binaryFiles.push(parts[2]);
        }
    }

    // Build enhanced diff with binary file information
    let enhancedDiff = diff;

    if (binaryFiles.length > 0) {
        if (!diff.trim()) {
            enhancedDiff = '';
        }

        // Add binary file information to the diff
        enhancedDiff += '\n\n--- Binary Files Changed ---\n';
        for (const file of binaryFiles) {
            const { stdout: fileStatus } = await execa('git', ['status', '--porcelain', file]);
            const status = fileStatus.substring(0, 2).trim();
            const action = status === 'A' ? 'added' : status === 'M' ? 'modified' : status === 'D' ? 'deleted' : 'changed';
            enhancedDiff += `Binary file ${file} ${action}\n`;
        }
    }

    // Include all files (both text and binary) in the file list
    const allStagedFiles = [...new Set([...allFiles, ...binaryFiles])];

    return {
        files: allStagedFiles,
        diff: enhancedDiff || `Files changed: ${allStagedFiles.join(', ')}`,
    };
};

export const getDetectedMessage = (staged: GitDiff) =>
    `Detected ${staged.files.length.toLocaleString()} staged file${staged.files.length > 1 ? 's' : ''} (${staged.diff.length.toLocaleString()} characters)`;

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

    // Check for binary files
    const { stdout: binaryCheck } = await execa('git', [
        'diff-tree',
        '-r',
        '--numstat',
        commitHash,
        ...(excludeFiles ? excludeFiles.map(excludeFromDiff) : []),
        ...(exclude ? exclude.map(excludeFromDiff) : []),
    ]);

    const binaryFiles: string[] = [];
    const numstatLines = binaryCheck.split('\n').filter(Boolean);

    for (const line of numstatLines) {
        const parts = line.split('\t');
        if (parts[0] === '-' && parts[1] === '-' && parts[2]) {
            binaryFiles.push(parts[2]);
        }
    }

    let enhancedDiff = diff;
    if (binaryFiles.length > 0) {
        if (!diff.trim()) {
            enhancedDiff = '';
        }
        enhancedDiff += '\n\n--- Binary Files Changed ---\n';
        for (const file of binaryFiles) {
            enhancedDiff += `Binary file ${file} changed\n`;
        }
    }

    const allFiles = [...new Set([...files.split('\n').filter(Boolean), ...binaryFiles])];

    return {
        files: allFiles,
        diff: enhancedDiff || `Files changed: ${allFiles.join(', ')}`,
    };
};

export const getDetectedCommit = (files: string[]) =>
    `Detected ${files.length.toLocaleString()} changed file${files.length > 1 ? 's' : ''}`;

export const getCommentChar = async (): Promise<string> => {
    try {
        const { stdout } = await execa('git', ['config', '--get', 'core.commentChar']);
        return stdout;
    } catch {
        return '#';
    }
};
