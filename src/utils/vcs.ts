import fs from 'fs/promises';

import { getConfig } from './config.js';
import { DEFAULT_DIFF_CONTEXT, compressDiff } from './diff-compressor.js';
import { ErrorMessages } from './error-messages.js';
import { CommitFailedError, KnownError } from './error.js';
import { GitAdapter, JujutsuAdapter, YadmAdapter } from './vcs-adapters/index.js';

import type { DiffCompressionConfig } from './diff-compressor.js';
import type { BaseVCSAdapter, CommitOptions, DiffOptions, VCSDiff } from './vcs-adapters/index.js';

export type { CommitOptions };

// Re-export types for backward compatibility
export interface GitDiff extends VCSDiff {}
export type { VCSDiff };

let cachedDiffDefaults: { diffContext: number; excludeGenerated: boolean } | null = null;
let vcsAdapter: BaseVCSAdapter | null = null;

/**
 * Detect and return the appropriate VCS adapter
 * Priority:
 * 1. CLI flags (--git, --yadm, --jj)
 * 2. Environment variables (FORCE_GIT, FORCE_YADM, FORCE_JJ)
 * 3. Config (forceGit)
 * 4. Auto-detection (Jujutsu → Git → YADM)
 */
const detectVCS = async (): Promise<BaseVCSAdapter> => {
    // Check CLI flags from process.argv
    const hasGitFlag = process.argv.includes('--git');
    const hasYadmFlag = process.argv.includes('--yadm');
    const hasJjFlag = process.argv.includes('--jj');

    // CLI flags have highest priority
    if (hasGitFlag) {
        try {
            const gitAdapter = new GitAdapter();
            await gitAdapter.assertRepo();
            return gitAdapter;
        } catch (error) {
            throw new KnownError(
                `--git flag is set, but Git is not available or not in a git repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    if (hasYadmFlag) {
        try {
            const yadmAdapter = new YadmAdapter();
            await yadmAdapter.assertRepo();
            return yadmAdapter;
        } catch (error) {
            throw new KnownError(
                `--yadm flag is set, but YADM is not available or not in a YADM repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    if (hasJjFlag) {
        try {
            const jjAdapter = new JujutsuAdapter();
            await jjAdapter.assertRepo();
            return jjAdapter;
        } catch (error) {
            throw new KnownError(
                `--jj flag is set, but Jujutsu is not available or not in a jj repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // Check environment variables
    const forceGitEnv = process.env.FORCE_GIT === 'true';
    const forceYadmEnv = process.env.FORCE_YADM === 'true';
    const forceJjEnv = process.env.FORCE_JJ === 'true';

    if (forceGitEnv) {
        try {
            const gitAdapter = new GitAdapter();
            await gitAdapter.assertRepo();
            return gitAdapter;
        } catch (error) {
            throw new KnownError(
                `FORCE_GIT="true" environment variable is set, but Git is not available or not in a git repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    if (forceYadmEnv) {
        try {
            const yadmAdapter = new YadmAdapter();
            await yadmAdapter.assertRepo();
            return yadmAdapter;
        } catch (error) {
            throw new KnownError(
                `FORCE_YADM="true" environment variable is set, but YADM is not available or not in a YADM repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    if (forceJjEnv) {
        try {
            const jjAdapter = new JujutsuAdapter();
            await jjAdapter.assertRepo();
            return jjAdapter;
        } catch (error) {
            throw new KnownError(
                `FORCE_JJ="true" environment variable is set, but Jujutsu is not available or not in a jj repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // Check config
    let forceGitConfig = false;
    try {
        const config = await getConfig({});
        forceGitConfig = config.forceGit === true;
    } catch (error) {
        forceGitConfig = false;
    }

    if (forceGitConfig) {
        try {
            const gitAdapter = new GitAdapter();
            await gitAdapter.assertRepo();
            return gitAdapter;
        } catch (error) {
            throw new KnownError(
                `forceGit=true is set in config, but Git is not available or not in a git repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // Auto-detect all VCS in parallel, then pick by priority (Jujutsu → Git → YADM)
    const [jjResult, gitResult, yadmResult] = await Promise.allSettled([
        (async () => {
            const a = new JujutsuAdapter();
            await a.assertRepo();
            return a;
        })(),
        (async () => {
            const a = new GitAdapter();
            await a.assertRepo();
            return a;
        })(),
        (async () => {
            const a = new YadmAdapter();
            await a.assertRepo();
            return a;
        })(),
    ]);

    if (jjResult.status === 'fulfilled') {
        return jjResult.value;
    }
    if (gitResult.status === 'fulfilled') {
        return gitResult.value;
    }
    if (yadmResult.status === 'fulfilled') {
        return yadmResult.value;
    }

    // All failed — collect error messages
    const extractMsg = (result: PromiseSettledResult<BaseVCSAdapter>): string => {
        if (result.status === 'fulfilled') {
            return 'unexpected success';
        }
        return String(result.reason?.message ?? result.reason)
            .replace('KnownError: ', '')
            .trim();
    };

    const jjMsg = extractMsg(jjResult);
    const gitMsg = extractMsg(gitResult);
    const yadmMsg = extractMsg(yadmResult);

    throw new KnownError(`No supported VCS repository found.

Jujutsu Error:
${jjMsg}

Git Error:
${gitMsg}

YADM Error:
${yadmMsg}

Solutions:
• Initialize a Jujutsu repository: jj init
• Initialize a Git repository: git init
• Initialize a YADM repository: yadm init (or yadm clone <url>)
• Navigate to an existing Jujutsu, Git, or YADM repository
• Set FORCE_GIT="true" environment variable to force Git detection
• Set forceGit=true in config file to prefer Git detection`);
};

/**
 * Get the VCS adapter (cached after first detection)
 */
const getVCSAdapter = async (): Promise<BaseVCSAdapter> => {
    if (!vcsAdapter) {
        vcsAdapter = await detectVCS();
    }
    return vcsAdapter;
};

/**
 * Reset VCS adapter cache (useful for testing)
 */
export const resetVCSAdapter = (): void => {
    vcsAdapter = null;
};

/**
 * Reset diff config cache (useful for testing)
 */
export const resetDiffConfigCache = (): void => {
    cachedDiffDefaults = null;
};

/**
 * Resolve diff settings from the global config file (cached after first call).
 */
const resolveDiffDefaults = async () => {
    if (cachedDiffDefaults !== null) {
        return cachedDiffDefaults;
    }
    try {
        const config = await getConfig({});
        cachedDiffDefaults = { diffContext: config.diffContext, excludeGenerated: config.excludeGenerated };
    } catch {
        cachedDiffDefaults = { diffContext: DEFAULT_DIFF_CONTEXT, excludeGenerated: true };
    }
    return cachedDiffDefaults;
};

const resolveDiffOptions = async (includeGenerated?: boolean): Promise<DiffOptions> => {
    const { diffContext, excludeGenerated } = await resolveDiffDefaults();
    return { diffContext, includeGenerated: includeGenerated || !excludeGenerated };
};

/**
 * Apply diff compression and attach stats to the result.
 * The `compressDiff` function handles mode=none internally, so no pre-check needed.
 */
export const applyDiffCompression = (diff: VCSDiff, compressionConfig: DiffCompressionConfig): VCSDiff => {
    const { diff: compressed, stats } = compressDiff(diff.diff, compressionConfig);

    // No compression applied — return original without stats
    if (compressed === diff.diff) {
        return diff;
    }

    return { ...diff, diff: compressed, compression: stats };
};

// Backward compatible exports
export const assertGitRepo = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.assertRepo();
};

export const getStagedDiff = async (excludeFiles?: string[], exclude?: string[], includeGenerated?: boolean): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    const diff = await adapter.getStagedDiff(excludeFiles, exclude, await resolveDiffOptions(includeGenerated));
    if (!diff) {
        return null;
    }
    return diff;
};

export const getCommitDiff = async (commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    if (!adapter.getCommitDiff) {
        throw new KnownError(`Commit diff not supported for ${adapter.name}`);
    }
    const diff = await adapter.getCommitDiff(commitHash, excludeFiles, exclude, await resolveDiffOptions());
    if (!diff) {
        return null;
    }
    return diff;
};

export const getCommentChar = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getCommentChar();
};

export const getDetectedMessage = (staged: GitDiff): string => {
    const fileCount = staged.files.length.toLocaleString();
    const fileSuffix = staged.files.length > 1 ? 's' : '';
    const charCount = staged.diff.length.toLocaleString();
    return `Detected ${fileCount} changed file${fileSuffix} (${charCount} characters)`;
};

export const getDetectedCommit = (files: string[]): string => {
    return `Detected ${files.length.toLocaleString()} changed file${files.length > 1 ? 's' : ''}`;
};

// New VCS-aware functions
export const getVCSName = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.name;
};

// Catch-clause boundary: `unknown` is what a catch binding is, normalized once here
const toError = (error: unknown): Error => (error instanceof Error ? error : new Error(String(error)));

/**
 * Where a failed commit's message is kept, or null when this VCS keeps none (jj). A lookup
 * that fails warns and returns null: saving is a convenience that must not block the commit.
 */
export const getMessageSavePath = async (): Promise<string | null> => {
    const adapter = await getVCSAdapter();
    try {
        return await adapter.getMessageSavePath();
    } catch (error) {
        process.stderr.write(`Could not resolve where to save the commit message: ${toError(error).message}\n`);
        return null;
    }
};

/**
 * Keeps the message of a failed commit so neither `aicommit2 --retry` nor the user has to
 * generate it again. A save that fails only warns: the commit failure is the error to report.
 */
const saveFailedMessage = async (
    savePath: string | null,
    message: string,
    commitError: Error,
    vcsName: string
): Promise<CommitFailedError> => {
    const unsaved = new CommitFailedError(commitError.message, null, { cause: commitError });
    if (!savePath) {
        return unsaved;
    }
    try {
        await fs.writeFile(savePath, message, 'utf8');
    } catch (writeError) {
        process.stderr.write(`Could not save the commit message to ${savePath}: ${toError(writeError).message}\n`);
        return unsaved;
    }
    return new CommitFailedError(`${commitError.message}\n\n${ErrorMessages.commitFailedMessageSaved(savePath, vcsName)}`, savePath, {
        cause: commitError,
    });
};

/**
 * Commits, saving the message on failure and clearing a stale saved message on success
 */
export const commitChanges = async (message: string, args?: string[], options?: CommitOptions): Promise<void> => {
    const adapter = await getVCSAdapter();
    const savePath = await getMessageSavePath();
    try {
        await adapter.commit(message, args || [], options);
    } catch (error) {
        throw await saveFailedMessage(savePath, message, toError(error), adapter.name);
    }
    if (!savePath) {
        return;
    }
    // The commit already succeeded; a leftover file only risks a stale --retry, so warn
    try {
        await fs.rm(savePath, { force: true });
    } catch (error) {
        process.stderr.write(`Could not remove the saved commit message ${savePath}: ${toError(error).message}\n`);
    }
};

/**
 * The message a failed commit left at `savePath`, or null when there is none. Read errors
 * other than a missing file propagate: "nothing saved" would hide them.
 */
export const readSavedMessage = async (savePath: string): Promise<string | null> => {
    try {
        const message = await fs.readFile(savePath, 'utf8');
        return message.trim() ? message : null;
    } catch (error) {
        const isMissing = error instanceof Error && 'code' in error && error.code === 'ENOENT';
        if (isMissing) {
            return null;
        }
        throw error;
    }
};

export const getBranchName = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getBranchName();
};

export const getRecentCommits = async (count: number = 5, excludeHash?: string): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getRecentCommits(count, excludeHash);
};

export const rewriteCommit = async (message: string, commitHash: string = 'HEAD'): Promise<void> => {
    const adapter = await getVCSAdapter();
    if (!adapter.rewriteCommit) {
        throw new KnownError(`Rewrite is not supported for ${adapter.name} repositories. Only Git is supported.`);
    }
    await adapter.rewriteCommit(message, commitHash);
};

export const getCommitMessage = async (commitHash: string = 'HEAD'): Promise<string> => {
    const adapter = await getVCSAdapter();
    if (!adapter.getCommitMessage) {
        return '';
    }
    return adapter.getCommitMessage(commitHash);
};

export const isCommitPushed = async (commitHash: string = 'HEAD'): Promise<boolean> => {
    const adapter = await getVCSAdapter();
    if (!adapter.isCommitPushed) {
        return false;
    }
    return adapter.isCommitPushed(commitHash);
};
