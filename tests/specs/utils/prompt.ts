import { expect, testSuite } from 'manten';

import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt, generateUserPrompt } from '../../../src/utils/prompt.js';

export default testSuite(({ describe }) => {
    describe('Prompt Generation', ({ test, describe }) => {
        const baseOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale: 'en',
            maxLength: 50,
            type: 'conventional',
            generate: 1,
        };

        describe('generatePrompt', ({ test }) => {
            test('should include commit format instructions', () => {
                const result = generatePrompt(baseOptions);
                expect(result).toContain('conventional');
                expect(result).toContain('JSON array');
                expect(result).toContain('subject');
            });

            test('should include locale', () => {
                const result = generatePrompt({ ...baseOptions, locale: 'ko' });
                expect(result).toContain('ko');
            });

            test('should include maxLength', () => {
                const result = generatePrompt({ ...baseOptions, maxLength: 72 });
                expect(result).toContain('72');
            });

            test('should include body and footer in instructions', () => {
                const result = generatePrompt(baseOptions);
                expect(result).toContain('"body"');
                expect(result).toContain('"footer"');
            });

            test('should use custom systemPrompt when provided', () => {
                const result = generatePrompt({
                    ...baseOptions,
                    systemPrompt: 'Write commits in pirate speak',
                });
                expect(result).toContain('Write commits in pirate speak');
            });

            test('should replace template variables in systemPrompt', () => {
                const result = generatePrompt({
                    ...baseOptions,
                    locale: 'ja',
                    systemPrompt: 'Generate in {locale} language',
                });
                expect(result).toContain('Generate in ja language');
            });

            test('should use reasoning prompt when isReasoning is true', () => {
                const result = generatePrompt({ ...baseOptions, isReasoning: true });
                expect(result).toContain('expert developer');
                expect(result).toContain('primary intent');
                expect(result).toContain('WHY');
            });

            test('should use default prompt when isReasoning is false', () => {
                const result = generatePrompt({ ...baseOptions, isReasoning: false });
                expect(result).toContain('Generate exactly');
                expect(result).not.toContain('expert developer');
            });

            test('should use default prompt when isReasoning is not set', () => {
                const result = generatePrompt(baseOptions);
                expect(result).not.toContain('expert developer');
            });

            test('reasoning prompt should still include JSON format instructions', () => {
                const result = generatePrompt({ ...baseOptions, isReasoning: true });
                expect(result).toContain('JSON array');
                expect(result).toContain('"subject"');
                expect(result).toContain('"body"');
            });

            test('reasoning prompt should respect locale', () => {
                const result = generatePrompt({ ...baseOptions, isReasoning: true, locale: 'ko' });
                expect(result).toContain('ko');
            });

            test('custom systemPrompt should override reasoning prompt', () => {
                const result = generatePrompt({
                    ...baseOptions,
                    isReasoning: true,
                    systemPrompt: 'Custom override prompt',
                });
                expect(result).toContain('Custom override prompt');
                expect(result).not.toContain('expert developer');
            });
        });

        describe('generateUserPrompt', ({ test }) => {
            test('should wrap diff in code block', () => {
                const result = generateUserPrompt('some diff');
                expect(result).toBe('```diff\nsome diff\n```');
            });

            test('should include recent commits when provided', () => {
                const result = generateUserPrompt('diff content', 'commit', {
                    recentCommits: 'feat(auth): add login\nfix(api): handle null',
                });
                expect(result).toContain('## Recent Commits (for style reference)');
                expect(result).toContain('feat(auth): add login');
                expect(result).toContain('fix(api): handle null');
                expect(result).toContain('```diff');
            });

            test('should include branch name when provided', () => {
                const result = generateUserPrompt('diff content', 'commit', {
                    branchName: 'feature/auth',
                });
                expect(result).toContain('## Branch');
                expect(result).toContain('feature/auth');
            });

            test('should work without context (backward compatible)', () => {
                const result = generateUserPrompt('diff content');
                expect(result).toBe('```diff\ndiff content\n```');
            });

            test('should place context before diff', () => {
                const result = generateUserPrompt('diff content', 'commit', {
                    recentCommits: 'feat: test',
                    branchName: 'main',
                });
                const branchPos = result.indexOf('## Branch');
                const diffPos = result.indexOf('```diff');
                expect(branchPos).toBeLessThan(diffPos);
            });

            test('should skip empty context fields', () => {
                const result = generateUserPrompt('diff content', 'commit', {
                    recentCommits: '',
                    branchName: '',
                });
                expect(result).toBe('```diff\ndiff content\n```');
            });

            test('should handle only recentCommits without branchName', () => {
                const result = generateUserPrompt('diff content', 'commit', {
                    recentCommits: 'fix: bug',
                });
                expect(result).toContain('## Recent Commits');
                expect(result).not.toContain('## Branch');
            });

            test('should handle only branchName without recentCommits', () => {
                const result = generateUserPrompt('diff content', 'commit', {
                    branchName: 'hotfix/urgent',
                });
                expect(result).not.toContain('## Recent Commits');
                expect(result).toContain('## Branch');
                expect(result).toContain('hotfix/urgent');
            });
        });
    });
});
