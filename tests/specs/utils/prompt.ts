import { expect, testSuite } from 'manten';

import {
    DEFAULT_PROMPT_OPTIONS,
    PromptOptions,
    generateBodyPrompt,
    generatePrompt,
    generateSubjectOnlyPrompt,
} from '../../../src/utils/prompt.js';

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
        });

        describe('generateSubjectOnlyPrompt', ({ test }) => {
            test('should instruct body to be empty string', () => {
                const result = generateSubjectOnlyPrompt(baseOptions);
                expect(result).toContain('MUST be empty string');
            });

            test('should still include subject instructions', () => {
                const result = generateSubjectOnlyPrompt(baseOptions);
                expect(result).toContain('subject');
                expect(result).toContain('conventional');
            });

            test('should include JSON format instructions', () => {
                const result = generateSubjectOnlyPrompt(baseOptions);
                expect(result).toContain('JSON array');
                expect(result).toContain('Return valid JSON only');
            });

            test('should include localized example with empty body', () => {
                const result = generateSubjectOnlyPrompt(baseOptions);
                expect(result).toContain('"body": ""');
                expect(result).toContain('"footer": ""');
            });

            test('should use custom systemPrompt when provided', () => {
                const result = generateSubjectOnlyPrompt({
                    ...baseOptions,
                    systemPrompt: 'Custom instruction',
                });
                expect(result).toContain('Custom instruction');
                expect(result).toContain('MUST be empty string');
            });

            test('should handle gitmoji type', () => {
                const result = generateSubjectOnlyPrompt({
                    ...baseOptions,
                    type: 'gitmoji',
                });
                expect(result).toContain('gitmoji');
                expect(result).toContain('MUST be empty string');
            });

            test('should handle empty commit type', () => {
                const result = generateSubjectOnlyPrompt({
                    ...baseOptions,
                    type: '',
                });
                expect(result).toContain('MUST be empty string');
            });

            test('should respect generate count', () => {
                const result = generateSubjectOnlyPrompt({
                    ...baseOptions,
                    generate: 3,
                });
                expect(result).toContain('exactly 3 objects');
            });
        });

        describe('generateBodyPrompt', ({ test }) => {
            test('should include the subject in the prompt', () => {
                const result = generateBodyPrompt('feat(auth): add login flow', 'en');
                expect(result).toContain('feat(auth): add login flow');
            });

            test('should include locale', () => {
                const result = generateBodyPrompt('fix: bug', 'ko');
                expect(result).toContain('ko');
            });

            test('should request JSON response', () => {
                const result = generateBodyPrompt('fix: bug', 'en');
                expect(result).toContain('JSON');
                expect(result).toContain('"body"');
                expect(result).toContain('"footer"');
            });

            test('should instruct to keep subject as-is', () => {
                const result = generateBodyPrompt('feat: new feature', 'en');
                expect(result).toContain('do NOT modify');
            });

            test('should include WHY guidance', () => {
                const result = generateBodyPrompt('fix: bug', 'en');
                expect(result).toContain('WHY');
            });

            test('should request JSON array format with subject preserved', () => {
                const subject = 'refactor(api): simplify handlers';
                const result = generateBodyPrompt(subject, 'en');
                expect(result).toContain(`"subject": "${subject}"`);
            });
        });

        describe('prompt consistency', ({ test }) => {
            test('generatePrompt and generateSubjectOnlyPrompt should share preamble', () => {
                const fullPrompt = generatePrompt(baseOptions);
                const subjectOnly = generateSubjectOnlyPrompt(baseOptions);

                // Both should contain the same default prompt preamble
                const preambleIndicator = 'commit message';
                expect(fullPrompt).toContain(preambleIndicator);
                expect(subjectOnly).toContain(preambleIndicator);
            });

            test('generateSubjectOnlyPrompt should differ from generatePrompt in final instructions', () => {
                const fullPrompt = generatePrompt(baseOptions);
                const subjectOnly = generateSubjectOnlyPrompt(baseOptions);

                // Subject-only should have empty body instruction, full should not
                expect(subjectOnly).toContain('MUST be empty string');
                expect(fullPrompt).not.toContain('MUST be empty string');
            });
        });
    });
});
