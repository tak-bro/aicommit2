import { expect, testSuite } from 'manten';

import { parseHookPositionalArgs } from '../../src/utils/parse-hook-args.js';

export default testSuite(({ describe }) => {
    describe('parseHookPositionalArgs', ({ test }) => {
        test('extracts positional args with --pre-commit flag only', () => {
            const result = parseHookPositionalArgs(['--pre-commit', '.git/COMMIT_EDITMSG'], ['--pre-commit']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });

        test('skips --type value pair and extracts positional arg', () => {
            const result = parseHookPositionalArgs(['--pre-commit', '--type', 'conventional', '.git/COMMIT_EDITMSG'], ['--pre-commit']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });

        test('does not skip positional arg after boolean flag (--verbose)', () => {
            const result = parseHookPositionalArgs(['--pre-commit', '--verbose', '.git/COMMIT_EDITMSG'], ['--pre-commit']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });

        test('preserves commitSource positional arg', () => {
            const result = parseHookPositionalArgs(['--pre-commit', '.git/COMMIT_EDITMSG', 'merge'], ['--pre-commit']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG', 'merge']);
        });

        test('handles short flags with values (-l ko)', () => {
            const result = parseHookPositionalArgs(['--hook-mode', '-l', 'ko', '.git/COMMIT_EDITMSG'], ['--hook-mode']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });

        test('handles --type=conventional (= syntax)', () => {
            const result = parseHookPositionalArgs(['--pre-commit', '--type=conventional', '.git/COMMIT_EDITMSG'], ['--pre-commit']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });

        test('handles multiple flags combined', () => {
            const result = parseHookPositionalArgs(
                ['--pre-commit', '--type', 'conventional', '--locale', 'ko', '--verbose', '--generate', '3', '.git/COMMIT_EDITMSG'],
                ['--pre-commit']
            );
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });

        test('returns empty array for empty input', () => {
            const result = parseHookPositionalArgs([], ['--pre-commit']);
            expect(result).toEqual([]);
        });

        test('returns empty array when only flags present', () => {
            const result = parseHookPositionalArgs(['--pre-commit', '--verbose'], ['--pre-commit']);
            expect(result).toEqual([]);
        });

        test('works without skipFlags', () => {
            const result = parseHookPositionalArgs(['--verbose', '.git/COMMIT_EDITMSG']);
            expect(result).toEqual(['.git/COMMIT_EDITMSG']);
        });
    });
});
