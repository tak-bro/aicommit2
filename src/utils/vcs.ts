import { getConfig } from './config.js';
import { DEFAULT_DIFF_CONTEXT, compressDiff } from './diff-compressor.js';
import { KnownError } from './error.js';
import { GitAdapter, JujutsuAdapter, YadmAdapter } from './vcs-adapters/index.js';

import type { DiffCompressionConfig } from './diff-compressor.js';
import type { BaseVCSAdapter, CommitOptions, VCSDiff } from './vcs-adapters/index.js';

export type { CommitOptions };

// Re-export types for backward compatibility
export interface GitDiff extends VCSDiff {}
export type { VCSDiff };

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
    cachedDiffContext = null;
};

let cachedDiffContext: number | null = null;

/**
 * Resolve diffContext from the global config file (cached after first call).
 */
const resolveDiffContext = async (): Promise<number> => {
    if (cachedDiffContext !== null) {
        return cachedDiffContext;
    }
    try {
        const config = await getConfig({});
        cachedDiffContext = config.diffContext;
    } catch {
        cachedDiffContext = DEFAULT_DIFF_CONTEXT;
    }
    return cachedDiffContext;
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

export const getStagedDiff = async (excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    const diffContext = await resolveDiffContext();
    const diff = await adapter.getStagedDiff(excludeFiles, exclude, { diffContext });
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
    const diffContext = await resolveDiffContext();
    const diff = await adapter.getCommitDiff(commitHash, excludeFiles, exclude, { diffContext });
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

export const commitChanges = async (message: string, args?: string[], options?: CommitOptions): Promise<void> => {
    const adapter = await getVCSAdapter();
    await adapter.commit(message, args || [], options);
};

export const getBranchName = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getBranchName();
};
