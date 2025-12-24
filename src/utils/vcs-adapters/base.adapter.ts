export interface VCSDiff {
    files: string[];
    diff: string;
}

export abstract class BaseVCSAdapter {
    abstract name: 'git' | 'jujutsu' | 'yadm';

    /**
     * Assert that we're in a VCS repository and return the repo root path
     */
    abstract assertRepo(): Promise<string>;

    /**
     * Get diff of staged/current changes
     */
    abstract getStagedDiff(excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null>;

    /**
     * Get diff of a specific commit
     */
    abstract getCommitDiff?(commitHash: string, excludeFiles?: string[], exclude?: string[]): Promise<VCSDiff | null>;

    /**
     * Commit changes with message
     */
    abstract commit(message: string, args?: string[]): Promise<void>;

    /**
     * Get the comment character used for commit messages
     */
    abstract getCommentChar(): Promise<string>;

    /**
     * Get detected message for current changes
     */
    getDetectedMessage(staged: VCSDiff): string {
        return `Detected ${staged.files.length.toLocaleString()} changed file${staged.files.length > 1 ? 's' : ''} (${staged.diff.length.toLocaleString()} characters)`;
    }

    /**
     * Get detected files message
     */
    getDetectedFiles(files: string[]): string {
        return `Detected ${files.length.toLocaleString()} changed file${files.length > 1 ? 's' : ''}`;
    }
}
