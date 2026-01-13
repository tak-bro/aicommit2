import { execa } from 'execa';

import { KnownError } from '../error.js';
import { BaseVCSAdapter, VCSDiff } from './base.adapter.js';

export class YadmAdapter extends BaseVCSAdapter {
    name = 'yadm' as const;

    async assertRepo(): Promise<string> {
        try {
            // Check if yadm command exists and get work tree
            const { stdout } = await execa('yadm', ['rev-parse', '--show-toplevel'], { reject: true });
            const workTree = stdout.trim();

            // YADM repository's work tree MUST be $HOME
            // This prevents misidentifying regular git repos as yadm repos
            const home = process.env.HOME || process.env.USERPROFILE;
            if (!home) {
                throw new KnownError('HOME environment variable not set. Cannot determine YADM repository.');
            }

            const path = await import('path');
            const resolvedWorkTree = path.resolve(workTree);
            const resolvedHome = path.resolve(home);

            if (resolvedWorkTree !== resolvedHome) {
                throw new KnownError(
                    `Not a YADM repository (work tree is not $HOME).\n\nYADM work tree: ${resolvedWorkTree}\nExpected: ${resolvedHome}\n\nThis appears to be a regular Git repository.`
                );
            }

            // Additional verification: check git-dir points to yadm repo
            const { stdout: gitDir } = await execa('yadm', ['rev-parse', '--git-dir'], { reject: true });
            const gitDirPath = gitDir.trim();

            if (!gitDirPath.includes('yadm')) {
                throw new KnownError(
                    `Not a YADM repository (git-dir does not contain "yadm").\n\nGit directory: ${gitDirPath}\n\nThis appears to be a regular Git repository.`
                );
            }

            return workTree;
        } catch (error) {
            // Re-throw KnownError from our validation
            if (error instanceof KnownError) {
                throw error;
            }

            const execError = error as any;

            if (execError.code === 'ENOENT') {
                throw new KnownError('YADM command not found!\n\nPlease install YADM first: https://yadm.io/');
            }

            if (execError.stderr) {
                if (execError.stderr.includes('not a git repository')) {
                    throw new KnownError(
                        'Not in a YADM repository!\n\nInitialize with: yadm init\nOr clone your dotfiles: yadm clone <url>'
                    );
                }
                if (execError.stderr.includes('permission denied')) {
                    throw new KnownError(
                        `YADM permission denied: ${execError.stderr.trim()}\n\nCheck file permissions and repository access.`
                    );
                }
            }

            throw new KnownError(`Failed to verify YADM repository: ${execError.message || 'Unknown error'}`);
        }
    }

    private excludeFromDiff = (path: string) => `:(exclude)${path}`;

    private filesToExclude = [
        'package-lock.json',
        'pnpm-lock.yaml',
        // yarn.lock, Cargo.lock, Gemfile.lock, Pipfile.lock, etc.
        '*.lock',
        '*.lockb',
    ].map(this.excludeFromDiff);

    async getStagedDiff(excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null> {
        const diffCached = ['diff', '--cached', '--diff-algorithm=minimal'];
        const { stdout: files } = await execa('yadm', [
            ...diffCached,
            '--name-only',
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        if (!files) {
            return null;
        }

        // Get the regular diff
        const { stdout: diff } = await execa('yadm', [
            ...diffCached,
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        // Get file list including binary files
        const allFiles = files.split('\n').filter(Boolean);

        // Check for binary files that yadm can't diff
        const { stdout: binaryCheck } = await execa('yadm', [
            ...diffCached,
            '--numstat',
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
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
                const { stdout: fileStatus } = await execa('yadm', ['status', '--porcelain', file]);
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
    }

    async getCommitDiff(commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null> {
        const diffCommand = ['diff-tree', '-r', '--no-commit-id', '--name-only', commitHash];
        const { stdout: files } = await execa('yadm', [
            ...diffCommand,
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        if (!files) {
            return null;
        }

        const { stdout: diff } = await execa('yadm', [
            'show',
            commitHash,
            '--',
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        // Check for binary files
        const { stdout: binaryCheck } = await execa('yadm', [
            'diff-tree',
            '-r',
            '--numstat',
            commitHash,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
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
    }

    async commit(message: string, args: string[] = []): Promise<void> {
        try {
            await execa('yadm', ['commit', '-m', message, ...args], {
                stdio: 'inherit',
            });
        } catch (error) {
            const execError = error as any;

            if (execError.stderr) {
                // Parse yadm-specific commit errors
                if (execError.stderr.includes('nothing to commit')) {
                    throw new KnownError(
                        'Nothing to commit.\n\nStage your changes with: yadm add <file>\nOr stage tracked file modifications: aicommit2 --all\n\nNote: The --all flag only stages already-tracked files (YADM best practice).'
                    );
                }
                if (execError.stderr.includes('Please enter the commit message')) {
                    throw new KnownError('Commit message cannot be empty.\n\nProvide a meaningful commit message.');
                }
                if (execError.stderr.includes('Author identity unknown')) {
                    throw new KnownError(
                        'YADM author identity not configured.\n\nConfigure with:\n  yadm config --global user.name "Your Name"\n  yadm config --global user.email "your.email@example.com"'
                    );
                }
                if (execError.stderr.includes('Permission denied')) {
                    throw new KnownError(
                        `YADM permission error: ${execError.stderr.trim()}\n\nCheck repository permissions and file access.`
                    );
                }

                // Generic yadm error
                throw new KnownError(`YADM commit failed: ${execError.stderr.trim()}`);
            }

            // Handle exit codes
            if (execError.exitCode === 1) {
                throw new KnownError('YADM commit failed. Check your staged changes and try again.');
            }

            throw new KnownError(`Failed to commit with YADM: ${execError.message || 'Unknown error'}`);
        }
    }

    async getCommentChar(): Promise<string> {
        try {
            const { stdout } = await execa('yadm', ['config', '--get', 'core.commentChar']);
            return stdout;
        } catch {
            return '#';
        }
    }

    async getBranchName(): Promise<string> {
        try {
            const { stdout } = await execa('yadm', ['branch', '--show-current']);
            const branchName = stdout.trim();
            if (!branchName) {
                const { stdout: headRef } = await execa('yadm', ['rev-parse', '--short', 'HEAD']);
                return `HEAD@${headRef.trim()}`;
            }
            return branchName;
        } catch {
            return 'HEAD';
        }
    }
}
