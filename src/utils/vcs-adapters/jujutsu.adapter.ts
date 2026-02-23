import fs from 'fs';
import path from 'path';

import { execa } from 'execa';

import { KnownError } from '../error.js';
import { BaseVCSAdapter, CommitOptions, VCSDiff } from './base.adapter.js';

export class JujutsuAdapter extends BaseVCSAdapter {
    name = 'jujutsu' as const;

    async assertRepo(): Promise<string> {
        try {
            // First check if jj command is available
            const { stdout: version } = await execa('jj', ['--version'], { reject: true });
            // Log jj version for debugging
            if (process.env.DEBUG) {
                console.log(`Jujutsu version: ${version}`);
            }
        } catch (error) {
            const execError = error as any;
            if (execError.code === 'ENOENT') {
                throw new KnownError(
                    'Jujutsu (jj) command not found!\n\nPlease install Jujutsu:\n  - macOS: brew install jj\n  - Linux: cargo install jj-cli\n  - Windows: cargo install jj-cli\n  - See: https://github.com/martinvonz/jj#installation'
                );
            }
            throw new KnownError(`Failed to execute jj command: ${execError.message}`);
        }

        try {
            // Get the workspace root
            const { stdout, stderr } = await execa('jj', ['workspace', 'root'], { reject: true });
            const repoPath = stdout.trim();

            if (!repoPath) {
                throw new KnownError('jj workspace root returned empty path');
            }

            // Verify .jj directory exists
            const jjPath = path.join(repoPath, '.jj');
            if (!fs.existsSync(jjPath)) {
                throw new KnownError(`Jujutsu repository directory not found at ${jjPath}\n\nInitialize a jj repository with: jj init`);
            }

            return repoPath;
        } catch (error) {
            if (error instanceof KnownError) {
                throw error;
            }
            const execError = error as any;
            if (execError.stderr) {
                // Parse jj-specific error messages
                if (execError.stderr.includes('not in a jj repo')) {
                    throw new KnownError(
                        'Not in a Jujutsu repository!\n\nInitialize with: jj init\nOr navigate to an existing jj repository.'
                    );
                }
                if (execError.stderr.includes('No workspace found')) {
                    throw new KnownError(
                        'No Jujutsu workspace found!\n\nThis may be a bare repository. Navigate to a workspace directory.'
                    );
                }
                throw new KnownError(`Jujutsu error: ${execError.stderr.trim()}`);
            }
            throw new KnownError(`Failed to verify Jujutsu repository: ${execError.message || 'Unknown error'}`);
        }
    }

    private excludeFromDiff = (path: string) => {
        // Convert glob patterns to Jujutsu fileset glob expressions
        if (path.includes('*') || path.includes('?') || path.includes('[')) {
            return `~glob:"${path}"`;
        }
        // For exact file paths, use simple negation
        return `~"${path}"`;
    };

    private filesToExclude = [
        'package-lock.json',
        'pnpm-lock.yaml',
        // yarn.lock, Cargo.lock, Gemfile.lock, Pipfile.lock, etc.
        '*.lock',
        '*.lockb',
    ];

    async getStagedDiff(excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null> {
        // In Jujutsu, there's no staging area, so we diff against the parent
        // Use --git flag for Git-compatible output format
        try {
            // First check if there are any changes using jj status
            const { stdout: status } = await execa('jj', ['status', '--no-pager']);

            if (process.env.DEBUG) {
                console.log('jj status output:', JSON.stringify(status));
                console.log('excludeFiles:', excludeFiles);
                console.log('exclude:', exclude);
            }

            // If status shows no changes, return null
            if (status.includes('No changes.') || status.includes('The working copy is clean')) {
                return null;
            }

            // Build exclusion patterns using Jujutsu fileset syntax
            const defaultExclusions = this.filesToExclude.map(this.excludeFromDiff);
            const userExclusions = [
                ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
                ...(exclude ? exclude.map(this.excludeFromDiff) : []),
            ];
            const allExclusions = [...defaultExclusions, ...userExclusions];

            // Create fileset expression: all() with exclusions applied
            let filesetExpr = 'all()';
            if (allExclusions.length > 0) {
                // Combine all exclusions: all() & ~pattern1 & ~pattern2 & ...
                filesetExpr = `all() & ${allExclusions.join(' & ')}`;
            }

            // Build commands with fileset expressions
            const diffCmd = ['diff', '--name-only'];
            const diffArgsCmd = ['diff', '--git'];

            // Add fileset expression as positional argument if we have exclusions
            if (allExclusions.length > 0) {
                diffCmd.push(filesetExpr);
                diffArgsCmd.push(filesetExpr);
            }

            if (process.env.DEBUG) {
                console.log('jj diff command with fileset:', diffCmd);
                console.log('fileset expression:', filesetExpr);
            }

            // Get list of changed files
            const { stdout: files } = await execa('jj', diffCmd);

            if (process.env.DEBUG) {
                console.log('jj diff --name-only output:', JSON.stringify(files));
            }

            if (!files.trim()) {
                return null;
            }

            // Get the actual diff with Git-compatible format
            const { stdout: diff } = await execa('jj', diffArgsCmd);

            // Get file status for binary detection
            const { stdout: statusOutput } = await execa('jj', ['status', '--no-pager']);

            const allFiles = files.split('\n').filter(Boolean);

            // Parse binary files from status (jj shows binary files differently)
            const binaryFiles: string[] = [];
            const statusLines = statusOutput.split('\n');

            for (const line of statusLines) {
                // Look for binary file indicators in jj status
                if (line.includes('(binary)') || line.includes('Binary file')) {
                    // Extract filename - jj status format may vary
                    const match = line.match(/([^\s]+)\s*\(binary\)/);
                    if (match && match[1]) {
                        binaryFiles.push(match[1]);
                    }
                }
            }

            let enhancedDiff = diff;

            if (binaryFiles.length > 0) {
                enhancedDiff += '\n\n--- Binary Files Changed ---\n';
                for (const file of binaryFiles) {
                    enhancedDiff += `Binary file ${file} changed\n`;
                }
            }

            const allChangedFiles = [...new Set([...allFiles, ...binaryFiles])];

            return {
                files: allChangedFiles,
                diff: enhancedDiff || `Files changed: ${allChangedFiles.join(', ')}`,
            };
        } catch (error) {
            const execError = error as any;

            // Handle specific jj diff errors
            if (execError.stderr) {
                if (execError.stderr.includes('No changes to show')) {
                    return null;
                }
                if (execError.stderr.includes('Operation not allowed')) {
                    throw new KnownError(`Jujutsu diff failed: ${execError.stderr.trim()}\n\nTry: jj status --no-pager`);
                }
                if (execError.stderr.includes('Invalid revision')) {
                    throw new KnownError(`Jujutsu revision error: ${execError.stderr.trim()}\n\nCheck if you're in a valid workspace.`);
                }
            }

            // Check if it's just empty changes (exit code 1 is common for no changes)
            if (execError.exitCode === 1 && !execError.stderr) {
                return null;
            }

            // For debug mode, show more details
            if (process.env.DEBUG) {
                throw new KnownError(
                    `Jujutsu diff failed: ${execError.message}\nstderr: ${execError.stderr}\nexitCode: ${execError.exitCode}`
                );
            }

            // Fallback: return null for potential "no changes" scenarios
            return null;
        }
    }

    async getCommitDiff(commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null> {
        // Only use user-provided exclusions for commit diff
        const userExclusions = [
            ...(excludeFiles ? excludeFiles.map(this.excludeFromDiff) : []),
            ...(exclude ? exclude.map(this.excludeFromDiff) : []),
        ];

        try {
            // Build base commands
            const filesCmd = ['diff', '--name-only', '--revision', commitHash];
            const diffCmd = ['diff', '--git', '--revision', commitHash];

            // Create fileset expression with user exclusions if provided
            if (userExclusions.length > 0) {
                const filesetExpr = `all() & ${userExclusions.join(' & ')}`;
                filesCmd.push(filesetExpr);
                diffCmd.push(filesetExpr);

                if (process.env.DEBUG) {
                    console.log('jj getCommitDiff fileset expression:', filesetExpr);
                }
            }

            // Get files changed in the commit
            const { stdout: files } = await execa('jj', filesCmd);

            if (!files.trim()) {
                return null;
            }

            // Get the diff for the commit
            const { stdout: diff } = await execa('jj', diffCmd);

            const allFiles = files.split('\n').filter(Boolean);

            return {
                files: allFiles,
                diff: diff || `Files changed: ${allFiles.join(', ')}`,
            };
        } catch (error) {
            if (process.env.DEBUG) {
                const execError = error as any;
                console.log('jj getCommitDiff error:', execError.message, execError.stderr);
            }
            return null;
        }
    }

    async commit(message: string, args: string[] = [], options: CommitOptions = {}): Promise<void> {
        // Jujutsu uses 'describe' to set commit message, not 'commit'
        // The working copy is already a commit, we just need to describe it
        try {
            await execa('jj', ['describe', '-m', message, ...args], {
                stdio: 'inherit',
            });

            // Only run `jj new` if autoNew option is explicitly set to true
            // Many jj users prefer to manually control when to create a new changeset
            if (options.autoNew) {
                await execa('jj', ['new'], {
                    stdio: 'inherit',
                });
            }
        } catch (error) {
            const execError = error as any;

            if (execError.stderr) {
                // Parse jj-specific commit errors
                if (execError.stderr.includes('Empty commit message')) {
                    throw new KnownError('Commit message cannot be empty.\n\nProvide a meaningful commit message.');
                }
                if (execError.stderr.includes('No changes to commit')) {
                    throw new KnownError('No changes to commit.\n\nMake some changes first, then try again.');
                }
                if (execError.stderr.includes('Invalid revision')) {
                    throw new KnownError(
                        `Jujutsu commit error: ${execError.stderr.trim()}\n\nEnsure you're in a valid workspace with changes.`
                    );
                }
                if (execError.stderr.includes('Operation not allowed')) {
                    throw new KnownError(
                        `Jujutsu operation not allowed: ${execError.stderr.trim()}\n\nCheck repository state with: jj status`
                    );
                }

                // Generic jj error
                throw new KnownError(`Jujutsu describe failed: ${execError.stderr.trim()}`);
            }

            // Handle exit codes
            if (execError.exitCode === 1) {
                throw new KnownError('Jujutsu commit failed. Check your changes and repository state.');
            }

            throw new KnownError(`Failed to commit with Jujutsu: ${execError.message || 'Unknown error'}`);
        }
    }

    async getCommentChar(): Promise<string> {
        try {
            // jj uses # as default comment char, check if configured differently
            const { stdout } = await execa('jj', ['config', 'get', 'ui.comment-char']);
            return stdout.trim() || '#';
        } catch {
            return '#';
        }
    }

    async getBranchName(): Promise<string> {
        try {
            // Try to get bookmark name first (jj's equivalent of branch)
            const { stdout: bookmarks } = await execa('jj', ['bookmark', 'list', '--revisions', '@']);
            if (bookmarks.trim()) {
                const firstBookmark = bookmarks.split('\n')[0];
                const bookmarkName = firstBookmark.split(':')[0].trim();
                if (bookmarkName) {
                    return bookmarkName;
                }
            }
            // Fall back to change-id
            const { stdout: changeId } = await execa('jj', ['log', '-r', '@', '--no-graph', '-T', 'change_id.short()']);
            return changeId.trim() || 'HEAD';
        } catch {
            return 'HEAD';
        }
    }
}
