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
    // VCS 우선순위: JJ환경변수 > config jujutsu=true > Git 기본 > Jujutsu 폴백
    const forceJJEnv = process.env.JJ === 'true';

    // JJ 환경변수가 설정된 경우 Jujutsu 강제 사용 (최고 우선순위)
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

    // config 파일에서 jujutsu 설정 확인
    let forceJJConfig = false;
    try {
        const config = await getConfig({});
        forceJJConfig = config.jujutsu === true;
    } catch (error) {
        // config 로딩 실패 시 기본 동작 계속
        forceJJConfig = false;
    }

    // config에서 jujutsu=true 설정된 경우 Jujutsu 강제 사용 (두 번째 우선순위)
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

    // Git 먼저 시도 (기본 우선순위)
    try {
        const gitAdapter = new GitAdapter();
        await gitAdapter.assertRepo();
        return gitAdapter;
    } catch (error) {
        gitError = error instanceof Error ? error : new Error(String(error));
    }

    // Git 실패 시 Jujutsu 시도
    try {
        const jjAdapter = new JujutsuAdapter();
        await jjAdapter.assertRepo();
        return jjAdapter;
    } catch (error) {
        jjError = error instanceof Error ? error : new Error(String(error));
    }

    // 둘 다 실패한 경우 도움말 메시지 제공
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
