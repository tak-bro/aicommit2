import path from 'path';

import { execa } from 'execa';

import { KnownError } from '../error.js';
import { readCommitDiff, readStagedDiff } from './assemble-diff.js';
import { BaseVCSAdapter, CommitOptions, DiffOptions, MESSAGE_SAVE_FILE, VCSDiff } from './base.adapter.js';

export class YadmAdapter extends BaseVCSAdapter {
    name = 'yadm' as const;

    // Diff commands run here when set (tests point it at a fixture repo); otherwise process.cwd()
    constructor(private readonly cwd?: string) {
        super();
    }

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

    private run = (args: string[]) => execa('yadm', args, this.cwd ? { cwd: this.cwd } : {});

    async getStagedDiff(excludeFiles?: string[], exclude?: string[], options?: DiffOptions): Promise<VCSDiff | null> {
        return readStagedDiff(this.run, { excludeFiles, exclude, options });
    }

    async getCommitDiff(commitHash: string, excludeFiles?: string[], exclude?: string[], options?: DiffOptions): Promise<VCSDiff | null> {
        return readCommitDiff(this.run, commitHash, { excludeFiles, exclude, options });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async commit(message: string, args: string[] = [], _options: CommitOptions = {}): Promise<void> {
        try {
            await execa('yadm', ['commit', '-m', message, ...args], {
                stdio: 'inherit',
            });
        } catch (error) {
            const exitCode = error instanceof Error && 'exitCode' in error ? error.exitCode : 'unknown';
            // stdio is inherited, so yadm's own error (and any hook output) is already on screen
            // and nothing was captured to parse
            throw new KnownError(`YADM commit failed (exit code ${exitCode}).`);
        }
    }

    // yadm's repo lives outside the work tree; `--git-path` finds it, and the output may be cwd-relative
    async getMessageSavePath(): Promise<string | null> {
        const { stdout } = await this.run(['rev-parse', '--git-path', MESSAGE_SAVE_FILE]);
        return path.resolve(this.cwd ?? process.cwd(), stdout.trim());
    }

    async getCommentChar(): Promise<string> {
        try {
            const { stdout } = await execa('yadm', ['config', '--get', 'core.commentChar']);
            return stdout;
        } catch {
            return '#';
        }
    }

    async getRecentCommits(count: number = 5, _excludeHash?: string): Promise<string> {
        try {
            const { stdout } = await execa('yadm', ['log', '--format=%s', `-${count}`]);
            return stdout.trim();
        } catch {
            return '';
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
