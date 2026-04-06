import { getConfig } from './config.js';
import { DEFAULT_DIFF_COMPRESSION_CONFIG, DEFAULT_DIFF_CONTEXT, compressDiff } from './diff-compressor.js';
import { KnownError } from './error.js';
import { GitAdapter, JujutsuAdapter, YadmAdapter } from './vcs-adapters/index.js';

import type { DiffCompressionConfig, DiffCompressionResult } from './diff-compressor.js';
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
async function detectVCS(): Promise<BaseVCSAdapter> {
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
}

/**
 * Get the VCS adapter (cached after first detection)
 */
async function getVCSAdapter(): Promise<BaseVCSAdapter> {
    if (!vcsAdapter) {
        vcsAdapter = await detectVCS();
    }
    return vcsAdapter;
}

/**
 * Reset VCS adapter cache (useful for testing)
 */
export function resetVCSAdapter(): void {
    vcsAdapter = null;
}

/**
 * Reset diff config cache (useful for testing)
 */
export const resetDiffConfigCache = (): void => {
    cachedDiffConfig = null;
};

interface ResolvedDiffConfig {
    compression: DiffCompressionConfig;
    diffContext: number;
}

let cachedDiffConfig: ResolvedDiffConfig | null = null;

/**
 * Resolve diff compression config from the global config file (cached after first call).
 */
const resolveDiffConfig = async (): Promise<ResolvedDiffConfig> => {
    if (cachedDiffConfig) {
        return cachedDiffConfig;
    }
    try {
        const config = await getConfig({});
        cachedDiffConfig = {
            compression: {
                mode: config.diffCompression,
                maxHunkLines: config.maxHunkLines,
                maxDiffLines: config.maxDiffLines,
            },
            diffContext: config.diffContext,
        };
    } catch (error) {
        console.warn(
            `[aicommit2] Failed to read diff compression config, using defaults: ${error instanceof Error ? error.message : String(error)}`
        );
        cachedDiffConfig = {
            compression: { ...DEFAULT_DIFF_COMPRESSION_CONFIG },
            diffContext: DEFAULT_DIFF_CONTEXT,
        };
    }
    return cachedDiffConfig;
};

/**
 * Apply diff compression and attach stats to the result.
 * The `compressDiff` function handles mode=none internally, so no pre-check needed.
 */
const applyDiffCompression = (diff: VCSDiff, compressionConfig: DiffCompressionConfig): VCSDiff => {
    const originalChars = diff.diff.length;
    const { diff: compressed, stats } = compressDiff(diff.diff, compressionConfig);

    // No compression applied — return original without stats
    if (compressed === diff.diff) {
        return diff;
    }

    const compression: DiffCompressionResult = {
        originalChars,
        compressedChars: compressed.length,
        truncatedHunks: stats.truncatedHunks,
        truncatedFiles: stats.truncatedFiles,
    };
    return { ...diff, diff: compressed, compression };
};

// Backward compatible exports
export const assertGitRepo = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.assertRepo();
};

export const getStagedDiff = async (excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    const { compression, diffContext } = await resolveDiffConfig();
    const diff = await adapter.getStagedDiff(excludeFiles, exclude, { diffContext });
    if (!diff) {
        return null;
    }
    return applyDiffCompression(diff, compression);
};

export const getCommitDiff = async (commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    if (!adapter.getCommitDiff) {
        throw new KnownError(`Commit diff not supported for ${adapter.name}`);
    }
    const { compression, diffContext } = await resolveDiffConfig();
    const diff = await adapter.getCommitDiff(commitHash, excludeFiles, exclude, { diffContext });
    if (!diff) {
        return null;
    }
    return applyDiffCompression(diff, compression);
};

export const getCommentChar = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getCommentChar();
};

/**
 * Truncate diff to a maximum character length to prevent exceeding model context windows.
 * Truncation happens at line boundaries to avoid cutting in the middle of a diff hunk.
 * Returns { diff, truncated } where truncated indicates if truncation occurred.
 */
export const truncateDiff = (diff: string, maxChars: number): { diff: string; truncated: boolean } => {
    if (!maxChars || maxChars <= 0 || diff.length <= maxChars) {
        return { diff, truncated: false };
    }

    // Find the last newline before the limit to avoid cutting mid-line
    const cutoff = diff.lastIndexOf('\n', maxChars);
    const truncatedDiff = cutoff > 0 ? diff.slice(0, cutoff) : diff.slice(0, maxChars);
    return {
        diff: `${truncatedDiff}\n\n[diff truncated — original was ${diff.length.toLocaleString()} characters]`,
        truncated: true,
    };
};

export const getDetectedMessage = (staged: GitDiff): string => {
    const fileCount = staged.files.length.toLocaleString();
    const fileSuffix = staged.files.length > 1 ? 's' : '';
    const charCount = staged.diff.length.toLocaleString();

    if (staged.compression) {
        const { originalChars, compressedChars } = staged.compression;
        const ratio = originalChars > 0 ? Math.round((1 - compressedChars / originalChars) * 100) : 0;
        return `Detected ${fileCount} changed file${fileSuffix} (${originalChars.toLocaleString()} → ${charCount} chars, ${ratio}% compressed)`;
    }

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
