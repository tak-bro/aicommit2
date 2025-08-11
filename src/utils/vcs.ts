import { getConfig } from './config.js';
import { KnownError } from './error.js';
import { BaseVCSAdapter, VCSDiff } from './vcs-adapters/base.adapter.js';
import { GitAdapter } from './vcs-adapters/git.adapter.js';
import { JujutsuAdapter } from './vcs-adapters/jujutsu.adapter.js';

// Re-export types for backward compatibility
export interface GitDiff extends VCSDiff {}
export type { VCSDiff };

let vcsAdapter: BaseVCSAdapter | null = null;

/**
 * Detect and return the appropriate VCS adapter
 * Priority: Git first, unless JJ="true" environment variable or jujutsu=true config is set
 */
async function detectVCS(): Promise<BaseVCSAdapter> {
    const forceJJEnv = process.env.JJ === 'true';

    // If JJ environment variable is set, force Jujutsu (highest priority)
    if (forceJJEnv) {
        try {
            const jjAdapter = new JujutsuAdapter();
            await jjAdapter.assertRepo();
            return jjAdapter;
        } catch (error) {
            throw new KnownError(
                `JJ="true" environment variable is set, but Jujutsu is not available or not in a jj repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    // Check config setting for jujutsu preference
    let forceJJConfig = false;
    try {
        const config = await getConfig({});
        forceJJConfig = config.jujutsu === true;
    } catch (error) {
        // If config loading fails, continue with default behavior
        forceJJConfig = false;
    }

    // If config jujutsu=true is set, force Jujutsu (second priority)
    if (forceJJConfig) {
        try {
            const jjAdapter = new JujutsuAdapter();
            await jjAdapter.assertRepo();
            return jjAdapter;
        } catch (error) {
            throw new KnownError(
                `jujutsu=true is set in config, but Jujutsu is not available or not in a jj repository.\n${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    let gitError: Error | null = null;
    let jjError: Error | null = null;

    // Try Git first (default priority)
    try {
        const gitAdapter = new GitAdapter();
        await gitAdapter.assertRepo();
        return gitAdapter;
    } catch (error) {
        gitError = error instanceof Error ? error : new Error(String(error));
    }

    // If Git fails, try Jujutsu
    try {
        const jjAdapter = new JujutsuAdapter();
        await jjAdapter.assertRepo();
        return jjAdapter;
    } catch (error) {
        jjError = error instanceof Error ? error : new Error(String(error));
    }

    // Both failed, provide helpful error message
    if (gitError && jjError) {
        const gitMsg = gitError.message.replace('KnownError: ', '').trim();
        const jjMsg = jjError.message.replace('KnownError: ', '').trim();

        throw new KnownError(`No supported VCS repository found.

Git Error:
${gitMsg}

Jujutsu Error:
${jjMsg}

Solutions:
• Initialize a Git repository: git init
• Initialize a Jujutsu repository: jj init
• Navigate to an existing Git or Jujutsu repository
• Set JJ="true" environment variable to force Jujutsu detection
• Set jujutsu=true in config file to prefer Jujutsu`);
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
