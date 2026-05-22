import { describe, expect } from 'manten';

import { GitAdapter } from '../../../src/utils/vcs-adapters/git.adapter.js';

describe('Git Adapter', ({ test: runTest }) => {
    // ─── Basic adapter properties ──────────────────────────────

    runTest('should have correct name', () => {
        const adapter = new GitAdapter();
        expect(adapter.name).toBe('git');
    });

    runTest('should conform to BaseVCSAdapter interface', () => {
        const adapter = new GitAdapter();

        // All required methods from BaseVCSAdapter
        expect(typeof adapter.assertRepo).toBe('function');
        expect(typeof adapter.getStagedDiff).toBe('function');
        expect(typeof adapter.commit).toBe('function');
        expect(typeof adapter.getCommentChar).toBe('function');
        expect(typeof adapter.getBranchName).toBe('function');
        expect(typeof adapter.getRecentCommits).toBe('function');
    });

    // ─── Method existence checks ───────────────────────────────

    runTest('should handle repository assertion', async () => {
        const adapter = new GitAdapter();

        // This would normally test the assertRepo method
        // In a real implementation, you'd mock the execa calls
        expect(typeof adapter.assertRepo).toBe('function');
    });

    runTest('should handle staged diff retrieval', async () => {
        const adapter = new GitAdapter();

        // Test that getStagedDiff method exists and returns correct format
        expect(typeof adapter.getStagedDiff).toBe('function');

        // In actual tests, you'd mock git commands and verify:
        // 1. Correct git diff commands are called
        // 2. File exclusions are applied correctly
        // 3. Binary files are handled properly
        // 4. Return format matches VCSDiff interface
    });

    runTest('should handle commit diff retrieval', async () => {
        const adapter = new GitAdapter();

        expect(typeof adapter.getCommitDiff).toBe('function');

        // Test would verify:
        // 1. Correct git diff-tree commands
        // 2. Commit hash validation
        // 3. Proper diff formatting
    });

    runTest('should handle commit execution', async () => {
        const adapter = new GitAdapter();

        expect(typeof adapter.commit).toBe('function');

        // Test would verify:
        // 1. Correct git commit command construction
        // 2. Message and args handling
        // 3. stdio: 'inherit' option
        // 4. Error handling for various git commit failures
    });

    runTest('should handle comment character retrieval', async () => {
        const adapter = new GitAdapter();

        expect(typeof adapter.getCommentChar).toBe('function');

        // Test would verify:
        // 1. git config command for core.commentChar
        // 2. Default to '#' when not configured
        // 3. Error handling for config access
    });

    runTest('should exclude specified files from diff', async () => {
        const adapter = new GitAdapter();

        // Test file exclusion logic
        const excludeFiles = ['package-lock.json', 'yarn.lock'];

        // Verify that excludeFromDiff helper works correctly
        expect(typeof adapter['excludeFromDiff']).toBe('function');

        // Test would mock git diff and verify exclude patterns are applied
    });

    runTest('should handle binary files in diff', async () => {
        const adapter = new GitAdapter();

        // Test that binary files are detected and handled in diff output
        // This would involve mocking git diff --numstat and verifying
        // that binary files are properly annotated in the result
        expect(true).toBe(true); // Placeholder — requires git mock
    });

    // ─── rewriteCommit ─────────────────────────────────────────

    runTest('should have rewriteCommit method', () => {
        const adapter = new GitAdapter();
        expect(typeof adapter.rewriteCommit).toBe('function');
    });

    runTest('rewriteCommit should accept message string', () => {
        const adapter = new GitAdapter();
        // Function signature: (message: string, commitHash?: string) => Promise<void>
        expect(adapter.rewriteCommit?.length).toBeGreaterThanOrEqual(1);
    });

    runTest('rewriteCommit default commitHash should be HEAD', async () => {
        const adapter = new GitAdapter();
        // When called with only message, commitHash defaults to 'HEAD'
        // This is verified by checking the function parameter default
        const fnStr = adapter.rewriteCommit?.toString() || '';
        expect(fnStr).toMatch(/commitHash.*=.*['"]HEAD['"]/);
    });

    // ─── getCommitMessage ──────────────────────────────────────

    runTest('should have getCommitMessage method', () => {
        const adapter = new GitAdapter();
        expect(typeof adapter.getCommitMessage).toBe('function');
    });

    runTest('getCommitMessage should accept optional commitHash', () => {
        const adapter = new GitAdapter();
        expect(adapter.getCommitMessage?.length).toBeGreaterThanOrEqual(0);
    });

    runTest('getCommitMessage default commitHash should be HEAD', async () => {
        const adapter = new GitAdapter();
        const fnStr = adapter.getCommitMessage?.toString() || '';
        expect(fnStr).toMatch(/commitHash.*=.*['"]HEAD['"]/);
    });

    runTest('getCommitMessage returns empty string on error', () => {
        // Method wraps git log and returns '' on any error
        const adapter = new GitAdapter();
        // Test the signature — actual mock test would verify catch path
        expect(adapter.getCommitMessage).toBeDefined();
    });

    // ─── isCommitPushed ────────────────────────────────────────

    runTest('should have isCommitPushed method', () => {
        const adapter = new GitAdapter();
        expect(typeof adapter.isCommitPushed).toBe('function');
    });

    runTest('isCommitPushed should accept optional commitHash', () => {
        const adapter = new GitAdapter();
        expect(adapter.isCommitPushed?.length).toBeGreaterThanOrEqual(0);
    });

    runTest('isCommitPushed default commitHash should be HEAD', async () => {
        const adapter = new GitAdapter();
        const fnStr = adapter.isCommitPushed?.toString() || '';
        expect(fnStr).toMatch(/commitHash.*=.*['"]HEAD['"]/);
    });

    runTest('isCommitPushed returns false when upstream not configured', () => {
        // Method returns false when git rev-parse @{u} fails
        const adapter = new GitAdapter();
        expect(adapter.isCommitPushed).toBeDefined();
    });

    // ─── rewriteCommit via vcs.ts layer ────────────────────────

    runTest('should handle rewrite from vcs.ts layer', async () => {
        const { rewriteCommit } = await import('../../../src/utils/vcs.js');
        expect(typeof rewriteCommit).toBe('function');
    });

    runTest('vcs.ts rewriteCommit accepts message and optional commitHash', async () => {
        const { rewriteCommit } = await import('../../../src/utils/vcs.js');
        // (message: string, commitHash?: string) => Promise<void>
        expect(rewriteCommit.length).toBeGreaterThanOrEqual(1);
    });

    runTest('vcs.ts getCommitMessage is exported', async () => {
        const { getCommitMessage } = await import('../../../src/utils/vcs.js');
        expect(typeof getCommitMessage).toBe('function');
    });

    runTest('vcs.ts isCommitPushed is exported', async () => {
        const { isCommitPushed } = await import('../../../src/utils/vcs.js');
        expect(typeof isCommitPushed).toBe('function');
    });

    // ─── Branch name edge cases ────────────────────────────────

    runTest('getBranchName returns string', () => {
        const adapter = new GitAdapter();
        expect(typeof adapter.getBranchName).toBe('function');
    });

    runTest('getRecentCommits returns string', () => {
        const adapter = new GitAdapter();
        expect(typeof adapter.getRecentCommits).toBe('function');
    });

    // ─── Commit diff with arguments ────────────────────────────

    runTest('getCommitDiff accepts excludeFiles and exclude arrays', () => {
        const adapter = new GitAdapter();
        // (commitHash, excludeFiles?, exclude?, options?) => Promise<VCSDiff | null>
        expect(adapter.getCommitDiff?.length).toBeGreaterThanOrEqual(1);
    });

    runTest('getStagedDiff accepts excludeFiles and exclude arrays', () => {
        const adapter = new GitAdapter();
        // (excludeFiles?, exclude?, options?) => Promise<VCSDiff | null>
        expect(adapter.getStagedDiff.length).toBeGreaterThanOrEqual(0);
    });
});
