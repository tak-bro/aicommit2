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
 * Priority: Jujutsu first (since jj repos are colocated with .git by default since v0.34.0),
 * unless FORCE_GIT="true" environment variable is set
 */
async function detectVCS(): Promise<BaseVCSAdapter> {
    const forceGitEnv = process.env.FORCE_GIT === 'true';

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

    let jjError: Error | null = null;
    let gitError: Error | null = null;

    // Try Jujutsu first (since jj repos are colocated with .git by default since v0.34.0)
    try {
        const jjAdapter = new JujutsuAdapter();
        await jjAdapter.assertRepo();
        return jjAdapter;
    } catch (error) {
        jjError = error instanceof Error ? error : new Error(String(error));
    }

    // If Jujutsu is not available or not a jj repo, try Git
    try {
        const gitAdapter = new GitAdapter();
        await gitAdapter.assertRepo();
        return gitAdapter;
    } catch (error) {
        gitError = error instanceof Error ? error : new Error(String(error));
    }

    if (jjError && gitError) {
        const jjMsg = jjError.message.replace('KnownError: ', '').trim();
        const gitMsg = gitError.message.replace('KnownError: ', '').trim();

        throw new KnownError(`No supported VCS repository found.

Jujutsu Error:
${jjMsg}

Git Error:
${gitMsg}

Solutions:
• Initialize a Jujutsu repository: jj init
• Initialize a Git repository: git init
• Navigate to an existing Jujutsu or Git repository
• Set FORCE_GIT="true" environment variable to force Git detection in a jj repository`);
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
