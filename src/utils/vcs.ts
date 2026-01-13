import { getConfig } from './config.js';
import { KnownError } from './error.js';
import { GitAdapter, JujutsuAdapter, YadmAdapter } from './vcs-adapters/index.js';

import type { BaseVCSAdapter, VCSDiff } from './vcs-adapters/index.js';

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

    let jjError: Error | null = null;
    let gitError: Error | null = null;
    let yadmError: Error | null = null;

    // Try Jujutsu first (since jj repos are colocated with .git by default since v0.34.0)
    try {
        const jjAdapter = new JujutsuAdapter();
        await jjAdapter.assertRepo();
        return jjAdapter;
    } catch (error) {
        jjError = error instanceof Error ? error : new Error(String(error));
    }

    // Try Git before YADM (since .git directories indicate regular Git repos)
    // YADM is a Git wrapper that manages dotfiles in $HOME, so it should be checked last
    try {
        const gitAdapter = new GitAdapter();
        await gitAdapter.assertRepo();
        return gitAdapter;
    } catch (error) {
        gitError = error instanceof Error ? error : new Error(String(error));
    }

    // Try YADM last (only for dotfiles in $HOME without a .git directory)
    try {
        const yadmAdapter = new YadmAdapter();
        await yadmAdapter.assertRepo();
        return yadmAdapter;
    } catch (error) {
        yadmError = error instanceof Error ? error : new Error(String(error));
    }

    if (jjError && gitError && yadmError) {
        const jjMsg = jjError.message.replace('KnownError: ', '').trim();
        const gitMsg = gitError.message.replace('KnownError: ', '').trim();
        const yadmMsg = yadmError.message.replace('KnownError: ', '').trim();

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

    throw new KnownError('Unexpected error during VCS detection');
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

// Backward compatible exports
export const assertGitRepo = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.assertRepo();
};

export const getStagedDiff = async (excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    return adapter.getStagedDiff(excludeFiles, exclude);
};

export const getCommitDiff = async (commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<GitDiff | null> => {
    const adapter = await getVCSAdapter();
    if (!adapter.getCommitDiff) {
        throw new KnownError(`Commit diff not supported for ${adapter.name}`);
    }
    return adapter.getCommitDiff(commitHash, excludeFiles, exclude);
};

export const getCommentChar = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getCommentChar();
};

export const getDetectedMessage = (staged: GitDiff): string => {
    // Use the static method from base adapter
    return `Detected ${staged.files.length.toLocaleString()} changed file${staged.files.length > 1 ? 's' : ''} (${staged.diff.length.toLocaleString()} characters)`;
};

export const getDetectedCommit = (files: string[]): string => {
    return `Detected ${files.length.toLocaleString()} changed file${files.length > 1 ? 's' : ''}`;
};

// New VCS-aware functions
export const getVCSName = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.name;
};

export const commitChanges = async (message: string, args?: string[]): Promise<void> => {
    const adapter = await getVCSAdapter();
    await adapter.commit(message, args || []);
};

export const getBranchName = async (): Promise<string> => {
    const adapter = await getVCSAdapter();
    return adapter.getBranchName();
};
