import { execa } from 'execa';

import { KnownError } from '../error.js';
import { BaseVCSAdapter, VCSDiff } from './base.adapter.js';

export class GitAdapter extends BaseVCSAdapter {
    name = 'git' as const;

    async assertRepo(): Promise<string> {
        try {
            const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { reject: true });
            return stdout.trim();
        } catch (error) {
            const execError = error as any;

            if (execError.code === 'ENOENT') {
                throw new KnownError('Git command not found!\n\nPlease install Git first: https://git-scm.com/downloads');
            }

            if (execError.stderr) {
                if (execError.stderr.includes('not a git repository')) {
                    throw new KnownError(
                        'Not in a Git repository!\n\nInitialize with: git init\nOr navigate to an existing Git repository.'
                    );
                }
                if (execError.stderr.includes('permission denied')) {
                    throw new KnownError(
                        `Git permission denied: ${execError.stderr.trim()}\n\nCheck file permissions and repository access.`
                    );
                }
            }

            throw new KnownError(`Failed to verify Git repository: ${execError.message || 'Unknown error'}`);
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
        const { stdout: files } = await execa('git', [
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
        const { stdout: diff } = await execa('git', [
            ...diffCached,
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        // Get file list including binary files
        const allFiles = files.split('\n').filter(Boolean);

        // Check for binary files that git can't diff
        const { stdout: binaryCheck } = await execa('git', [
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
    }

    async getCommitDiff(commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null> {
        const diffCommand = ['diff-tree', '-r', '--no-commit-id', '--name-only', commitHash];
        const { stdout: files } = await execa('git', [
            ...diffCommand,
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        if (!files) {
            return null;
        }

        const { stdout: diff } = await execa('git', [
            'show',
            commitHash,
            '--',
            ...this.filesToExclude,
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ]);

        // Check for binary files
        const { stdout: binaryCheck } = await execa('git', [
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
            await execa('git', ['commit', '-m', message, ...args], {
                stdio: 'inherit',
            });
        } catch (error) {
            const execError = error as any;

            if (execError.stderr) {
                // Parse git-specific commit errors
                if (execError.stderr.includes('nothing to commit')) {
                    throw new KnownError(
                        'Nothing to commit.\n\nStage your changes with: git add <files>\nOr use the --all flag to stage all changes.'
                    );
                }
                if (execError.stderr.includes('Please enter the commit message')) {
                    throw new KnownError('Commit message cannot be empty.\n\nProvide a meaningful commit message.');
                }
                if (execError.stderr.includes('Author identity unknown')) {
                    throw new KnownError(
                        'Git author identity not configured.\n\nConfigure with:\n  git config --global user.name "Your Name"\n  git config --global user.email "your.email@example.com"'
                    );
                }
                if (execError.stderr.includes('Permission denied')) {
                    throw new KnownError(
                        `Git permission error: ${execError.stderr.trim()}\n\nCheck repository permissions and file access.`
                    );
                }

                // Generic git error
                throw new KnownError(`Git commit failed: ${execError.stderr.trim()}`);
            }

            // Handle exit codes
            if (execError.exitCode === 1) {
                throw new KnownError('Git commit failed. Check your staged changes and try again.');
            }

            throw new KnownError(`Failed to commit with Git: ${execError.message || 'Unknown error'}`);
        }
    }

    async getCommentChar(): Promise<string> {
        try {
            const { stdout } = await execa('git', ['config', '--get', 'core.commentChar']);
            return stdout;
        } catch {
            return '#';
        }
    }

    async getBranchName(): Promise<string> {
        try {
            const { stdout } = await execa('git', ['branch', '--show-current']);
            const branchName = stdout.trim();
            if (!branchName) {
                // Detached HEAD state - use short commit hash
                const { stdout: headRef } = await execa('git', ['rev-parse', '--short', 'HEAD']);
                return `HEAD@${headRef.trim()}`;
            }
            return branchName;
        } catch {
            return 'HEAD';
        }
    }
}
