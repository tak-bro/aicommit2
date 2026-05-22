import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { execa } from 'execa';

import { DEFAULT_DIFF_CONTEXT } from '../diff-compressor.js';
import { KnownError } from '../error.js';
import { BaseVCSAdapter, CommitOptions, DiffOptions, VCSDiff } from './base.adapter.js';

const REWRITE_MSG_ENV = 'AICOMMIT2_MSG_FILE';

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

    async getStagedDiff(excludeFiles?: string[], exclude?: string[], options?: DiffOptions): Promise<VCSDiff | null> {
        const contextArg = options?.diffContext !== undefined ? `-U${options.diffContext}` : `-U${DEFAULT_DIFF_CONTEXT}`;
        const diffCached = ['diff', '--cached', '--diff-algorithm=minimal', contextArg];
        const userExcludeArgs = [
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ];
        const defaultExcludeArgs = [...this.filesToExclude, ...userExcludeArgs];

        // Run file list, diff content, and binary detection in parallel
        const [filesResult, diffResult, numstatResult] = await Promise.all([
            execa('git', [...diffCached, '--name-only', ...defaultExcludeArgs]),
            execa('git', [...diffCached, ...defaultExcludeArgs]),
            execa('git', [...diffCached, '--numstat', ...userExcludeArgs]),
        ]);

        const files = filesResult.stdout;
        if (!files) {
            return null;
        }

        const diff = diffResult.stdout;
        const allFiles = files.split('\n').filter(Boolean);
        const binaryCheck = numstatResult.stdout;

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

    async getCommitDiff(commitHash: string, excludeFiles?: string[], exclude?: string[], options?: DiffOptions): Promise<VCSDiff | null> {
        const contextArg = options?.diffContext !== undefined ? `-U${options.diffContext}` : `-U${DEFAULT_DIFF_CONTEXT}`;
        const userExcludeArgs = [
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ];
        const defaultExcludeArgs = [...this.filesToExclude, ...userExcludeArgs];

        // Run file list, diff content, and binary detection in parallel
        const [filesResult, diffResult, numstatResult] = await Promise.all([
            execa('git', ['diff-tree', '-r', '--no-commit-id', '--name-only', commitHash, ...defaultExcludeArgs]),
            execa('git', ['show', contextArg, commitHash, '--', ...defaultExcludeArgs]),
            execa('git', ['diff-tree', '-r', '--numstat', commitHash, ...userExcludeArgs]),
        ]);

        const files = filesResult.stdout;
        if (!files) {
            return null;
        }

        const diff = diffResult.stdout;
        const binaryCheck = numstatResult.stdout;

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async commit(message: string, args: string[] = [], _options: CommitOptions = {}): Promise<void> {
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

    async getRecentCommits(count: number = 5, excludeHash?: string): Promise<string> {
        try {
            if (!excludeHash) {
                const { stdout } = await execa('git', ['log', '--format=%s', `-${count}`]);
                return stdout.trim();
            }

            // Resolve excludeHash (may be 'HEAD', short hash, or symbolic ref) to a full SHA
            // so exact-match comparison works against the %H column below.
            const { stdout: resolved } = await execa('git', ['rev-parse', excludeHash]);
            const excludeSha = resolved.trim();

            // Fetch hash+subject so we can drop the excluded commit, then return the next `count`.
            // NUL field separator survives subjects with arbitrary content.
            const { stdout } = await execa('git', ['log', `--format=%H%x00%s`, `-${count + 1}`]);
            return stdout
                .split('\n')
                .map(line => line.split('\x00'))
                .filter(([hash]) => hash && hash !== excludeSha)
                .slice(0, count)
                .map(([, subject]) => subject)
                .join('\n');
        } catch {
            return '';
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

    /**
     * Get the commit message of a specific commit (defaults to HEAD).
     */
    async getCommitMessage(commitHash: string = 'HEAD'): Promise<string> {
        try {
            const { stdout } = await execa('git', ['log', '--format=%B', '-n', '1', commitHash]);
            return stdout.trim();
        } catch {
            return '';
        }
    }

    /**
     * Rewrite the commit message of a specific commit.
     * For HEAD: uses `git commit --amend`.
     * For non-HEAD: uses `git rebase -i` with GIT_SEQUENCE_EDITOR + GIT_EDITOR.
     */
    async rewriteCommit(message: string, commitHash: string = 'HEAD'): Promise<void> {
        try {
            if (commitHash === 'HEAD') {
                // --only --allow-empty: amend only the message, ignoring any staged changes
                // Without --only, git commit --amend folds staged content into the commit
                await execa('git', ['commit', '--amend', '--only', '--allow-empty', '-m', message], {
                    stdio: 'inherit',
                });
            } else {
                // Reject if working tree is dirty — rebase would fail with a cryptic error
                try {
                    await execa('git', ['diff-index', '--quiet', 'HEAD', '--']);
                } catch {
                    throw new KnownError(
                        'Working tree has uncommitted changes.\n\n' +
                            'Stash or commit them before rewriting a non-HEAD commit:\n' +
                            '  git stash push -u\n' +
                            '  # ... run rewrite ...\n' +
                            '  git stash pop'
                    );
                }

                // Reject if the rebase range spans merge commits — without --rebase-merges the
                // history would be silently linearized, dropping the merges. Adding --rebase-merges
                // changes the replay semantics in ways the user may not expect, so we refuse instead.
                const { stdout: mergeCount } = await execa('git', ['rev-list', '--merges', '--count', `${commitHash}^..HEAD`]);
                if (parseInt(mergeCount.trim(), 10) > 0) {
                    throw new KnownError(
                        `Cannot rewrite ${commitHash}: the rebase range contains merge commits.\n\n` +
                            'Rewriting via `git rebase -i` would linearize history and drop the merges.\n' +
                            'Reword the merge commit directly with `git commit --amend` (if HEAD) or\n' +
                            'use `git rebase -i --rebase-merges` manually.'
                    );
                }

                // Resolve symbolic references (HEAD~1, branch names) to abbreviated commit hash
                // The rebase todo list uses actual commit hashes, not symbolic names
                const { stdout: shortHash } = await execa('git', ['rev-parse', '--short', commitHash]);
                const resolvedHash = shortHash.trim();

                // Random filename prevents predictable-path symlink races on shared tmpdir
                const tmpFile = path.join(os.tmpdir(), `aicommit2-rewrite-msg-${crypto.randomBytes(8).toString('hex')}.txt`);
                fs.writeFileSync(tmpFile, message, 'utf8');

                // Determine sed in-place flag for the platform
                const sedInPlace = process.platform === 'darwin' ? "sed -i ''" : 'sed -i';

                try {
                    // GIT_SEQUENCE_EDITOR rewrites the rebase todo, GIT_EDITOR replaces the commit message.
                    // tmpFile path goes through an env var instead of shell interpolation so paths
                    // containing quotes can't break out of the sh -c body.
                    await execa('git', ['rebase', '-i', `${commitHash}^`, '--keep-empty'], {
                        env: {
                            ...process.env,
                            [REWRITE_MSG_ENV]: tmpFile,
                            GIT_SEQUENCE_EDITOR: `${sedInPlace} 's/^pick ${resolvedHash}/reword ${resolvedHash}/'`,
                            GIT_EDITOR: `cp "$${REWRITE_MSG_ENV}" "$1"`,
                        },
                        stdio: 'inherit',
                    });
                } finally {
                    try {
                        fs.unlinkSync(tmpFile);
                    } catch {
                        // Already removed or never created — nothing to clean up
                    }
                }
            }
        } catch (error) {
            const execError = error as any;

            if (execError.stderr) {
                if (execError.stderr.includes('Author identity unknown')) {
                    throw new KnownError(
                        'Git author identity not configured.\n\nConfigure with:\n  git config --global user.name "Your Name"\n  git config --global user.email "your.email@example.com"'
                    );
                }
                if (execError.stderr.includes('nothing to amend')) {
                    throw new KnownError('Nothing to amend. The specified commit has no changes to modify.');
                }
                if (execError.stderr.includes('fatal: invalid upstream')) {
                    throw new KnownError(
                        `Invalid commit reference: ${commitHash}.\n\n` +
                            'Make sure the commit hash is correct and the commit exists in this repository.'
                    );
                }
                throw new KnownError(`Git rewrite failed: ${execError.stderr.trim()}`);
            }

            throw new KnownError(`Failed to rewrite commit: ${execError.message || 'Unknown error'}`);
        }
    }

    /**
     * Check if a commit has been pushed to any remote branch.
     * Uses `git branch -r --contains` so commits pushed via branches other than
     * the current one's upstream are still detected — important to warn the user
     * before rewriting already-published history.
     */
    async isCommitPushed(commitHash: string = 'HEAD'): Promise<boolean> {
        try {
            const { stdout } = await execa('git', ['branch', '-r', '--contains', commitHash]);
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }
}
