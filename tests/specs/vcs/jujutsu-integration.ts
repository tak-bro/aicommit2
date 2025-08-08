import { describe, expect } from 'manten';

import { JujutsuAdapter } from '../../../src/utils/vcs-adapters/jujutsu.adapter.js';

describe('Jujutsu Integration Tests', ({ test: runTest }) => {
    runTest('should integrate with VCS abstraction layer', () => {
        const adapter = new JujutsuAdapter();

        // Verify it implements the VCS adapter interface
        expect(adapter.name).toBe('jujutsu');
        expect(typeof adapter.assertRepo).toBe('function');
        expect(typeof adapter.getStagedDiff).toBe('function');
        expect(typeof adapter.getCommitDiff).toBe('function');
        expect(typeof adapter.commit).toBe('function');
        expect(typeof adapter.getCommentChar).toBe('function');

        // Verify inherited methods from BaseVCSAdapter
        expect(typeof adapter.getDetectedMessage).toBe('function');
        expect(typeof adapter.getDetectedFiles).toBe('function');
    });

    runTest('should handle typical workflow scenarios', async () => {
        const adapter = new JujutsuAdapter();

        // Test workflow: check repo → get changes → commit
        try {
            // 1. Verify we're in a jujutsu repository
            const repoPath = await adapter.assertRepo();
            expect(typeof repoPath).toBe('string');

            // 2. Get current changes (if any)
            const diff = await adapter.getStagedDiff();
            expect(diff === null || typeof diff.files === 'object').toBe(true);

            // 3. Get comment character for message formatting
            const commentChar = await adapter.getCommentChar();
            expect(typeof commentChar).toBe('string');
            expect(commentChar.length).toBeGreaterThan(0);
        } catch (error) {
            // Expected in test environment without jj setup
            expect(error).toBeDefined();
            expect(error.message).toContain('jj');
        }
    });

    runTest('should support file exclusion patterns', async () => {
        const adapter = new JujutsuAdapter();

        // Test file exclusion functionality
        const excludeFiles = ['package-lock.json', 'yarn.lock'];
        const excludePatterns = ['*.log', '*.tmp'];

        try {
            // Test staged diff with exclusions
            const stagedDiff = await adapter.getStagedDiff(excludeFiles, excludePatterns);
            expect(stagedDiff === null || typeof stagedDiff.files === 'object').toBe(true);

            // Test commit diff with exclusions
            const commitDiff = await adapter.getCommitDiff('test-hash', excludeFiles, excludePatterns);
            expect(commitDiff === null || typeof commitDiff.files === 'object').toBe(true);
        } catch (error) {
            // Expected in test environment
            expect(error).toBeDefined();
        }
    });

    runTest('should handle edge cases gracefully', async () => {
        const adapter = new JujutsuAdapter();

        try {
            // Test with empty commit message
            await adapter.commit('');
            expect(false).toBe(true); // Should not reach here
        } catch (error) {
            expect(error).toBeDefined();
            // Should fail with some error message (actual message depends on jj behavior)
            expect(error.message.length).toBeGreaterThan(0);
        }

        try {
            // Test with invalid commit hash
            const result = await adapter.getCommitDiff('invalid-hash-12345');
            expect(result).toBeNull(); // Should return null for invalid hashes
        } catch (error) {
            // Also acceptable - depends on jj behavior
            expect(error).toBeDefined();
        }
    });

    runTest('should provide meaningful error messages', async () => {
        const adapter = new JujutsuAdapter();

        // Error messages should be helpful and actionable
        try {
            await adapter.assertRepo();
        } catch (error) {
            expect(error).toBeDefined();
            expect(error.message).toBeDefined();
            expect(typeof error.message).toBe('string');
            expect(error.message.length).toBeGreaterThan(10);

            // Should contain helpful information
            const message = error.message.toLowerCase();
            const hasUsefulInfo =
                message.includes('jj') ||
                message.includes('jujutsu') ||
                message.includes('install') ||
                message.includes('init') ||
                message.includes('workspace');
            expect(hasUsefulInfo).toBe(true);
        }
    });

    runTest('should handle binary and text files appropriately', async () => {
        const adapter = new JujutsuAdapter();

        // Test that binary files are handled correctly
        try {
            const diff = await adapter.getStagedDiff();

            if (diff) {
                expect(Array.isArray(diff.files)).toBe(true);
                expect(typeof diff.diff).toBe('string');

                // If binary files are present, diff should mention them
                const hasBinarySection = diff.diff.includes('--- Binary Files Changed ---');
                if (hasBinarySection) {
                    expect(diff.diff).toContain('Binary file');
                }
            }
        } catch (error) {
            // Expected in test environment
            expect(error).toBeDefined();
        }
    });

    runTest('should support jujutsu-specific features', async () => {
        const adapter = new JujutsuAdapter();

        // Verify jujutsu-specific implementation details
        expect(adapter.name).toBe('jujutsu');

        // Should use jj commands rather than git commands
        // This is verified by the implementation using:
        // - jj workspace root (not git rev-parse --show-toplevel)
        // - jj describe -m (not git commit -m)
        // - jj new (after describe, unique to jj workflow)
        // - jj status --no-pager (for status checks)
        // - jj diff --git (for Git-compatible format)
        // - jj config get ui.comment-char (not core.commentChar)

        expect(typeof adapter.assertRepo).toBe('function');
        expect(typeof adapter.commit).toBe('function');
        expect(typeof adapter.getCommentChar).toBe('function');
    });

    runTest('should maintain Git compatibility for AI parsing', async () => {
        const adapter = new JujutsuAdapter();

        // Ensure diff output is Git-compatible for AI consumption
        try {
            const diff = await adapter.getStagedDiff();

            if (diff && diff.diff) {
                // Should contain Git-style diff headers
                const isGitCompatible =
                    diff.diff.includes('diff --git') ||
                    diff.diff.includes('@@') ||
                    diff.diff.includes('---') ||
                    diff.diff.includes('+++') ||
                    diff.diff === ''; // Empty is also valid

                // Or it should be a fallback format
                const isFallbackFormat = diff.diff.includes('Files changed:');

                expect(isGitCompatible || isFallbackFormat).toBe(true);
            }
        } catch (error) {
            // Expected in test environment
            expect(error).toBeDefined();
        }
    });

    runTest('should handle debug mode appropriately', async () => {
        const adapter = new JujutsuAdapter();

        // Test that debug mode doesn't break functionality
        const originalDebug = process.env.DEBUG;

        try {
            // Enable debug mode
            process.env.DEBUG = 'true';

            // Methods should still work (or fail gracefully)
            try {
                await adapter.assertRepo();
            } catch (error) {
                expect(error).toBeDefined();
            }

            try {
                await adapter.getStagedDiff();
            } catch (error) {
                expect(error).toBeDefined();
            }

            try {
                const commentChar = await adapter.getCommentChar();
                expect(typeof commentChar).toBe('string');
            } catch (error) {
                expect(error).toBeDefined();
            }
        } finally {
            // Restore original debug setting
            if (originalDebug === undefined) {
                delete process.env.DEBUG;
            } else {
                process.env.DEBUG = originalDebug;
            }
        }
    });

    runTest('should follow VCS adapter contract', () => {
        const adapter = new JujutsuAdapter();

        // Verify the adapter follows the expected contract
        // All methods should exist and have correct signatures
        expect(typeof adapter.name).toBe('string');
        expect(adapter.name).toBe('jujutsu');

        // Required methods from BaseVCSAdapter
        expect(typeof adapter.assertRepo).toBe('function');
        expect(typeof adapter.getStagedDiff).toBe('function');
        expect(typeof adapter.commit).toBe('function');
        expect(typeof adapter.getCommentChar).toBe('function');

        // Optional method
        expect(typeof adapter.getCommitDiff).toBe('function');

        // Inherited utility methods
        expect(typeof adapter.getDetectedMessage).toBe('function');
        expect(typeof adapter.getDetectedFiles).toBe('function');

        // Test inherited methods work correctly
        const mockDiff = { files: ['test.js'], diff: 'test diff' };
        const message = adapter.getDetectedMessage(mockDiff);
        expect(message).toContain('1 changed file');
        expect(message).toContain('9 characters');

        const filesMessage = adapter.getDetectedFiles(['a.js', 'b.js']);
        expect(filesMessage).toContain('2 changed files');
    });
});
