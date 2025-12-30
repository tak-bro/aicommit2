import { expect, testSuite } from 'manten';

import { isReasoningModel } from '../../../src/utils/openai.js';

export default testSuite(({ describe }) => {
    describe('isReasoningModel', ({ test }) => {
        test('should recognize exact prefix matches', () => {
            expect(isReasoningModel('gpt-5')).toBe(true);
            expect(isReasoningModel('o1')).toBe(true);
            expect(isReasoningModel('o3')).toBe(true);
            expect(isReasoningModel('o3-mini')).toBe(true);
            expect(isReasoningModel('o4-mini')).toBe(true);
        });

        test('should recognize dash notation versions', () => {
            expect(isReasoningModel('gpt-5-preview')).toBe(true);
            expect(isReasoningModel('o1-preview')).toBe(true);
            expect(isReasoningModel('o3-mini-2025-01-31')).toBe(true);
            expect(isReasoningModel('gpt-5-codex-preview')).toBe(true);
        });

        test('should recognize dot notation versions (issue #200)', () => {
            expect(isReasoningModel('gpt-5.1')).toBe(true);
            expect(isReasoningModel('gpt-5.2')).toBe(true);
            expect(isReasoningModel('gpt-5.2-preview')).toBe(true);
            expect(isReasoningModel('o1.5')).toBe(true);
        });

        test('should be case-insensitive', () => {
            expect(isReasoningModel('GPT-5')).toBe(true);
            expect(isReasoningModel('GPT-5.2')).toBe(true);
            expect(isReasoningModel('O1')).toBe(true);
            expect(isReasoningModel('O3-MINI')).toBe(true);
        });

        test('should not match non-reasoning models', () => {
            expect(isReasoningModel('gpt-4')).toBe(false);
            expect(isReasoningModel('gpt-4o')).toBe(false);
            expect(isReasoningModel('gpt-4o-mini')).toBe(false);
            expect(isReasoningModel('gpt-4-turbo')).toBe(false);
            expect(isReasoningModel('claude-3')).toBe(false);
            expect(isReasoningModel('gemini-pro')).toBe(false);
        });

        test('should not match similar but different prefixes (avoid false positives)', () => {
            expect(isReasoningModel('gpt-50')).toBe(false);
            expect(isReasoningModel('gpt-5x')).toBe(false);
            expect(isReasoningModel('o10')).toBe(false);
            expect(isReasoningModel('o1x')).toBe(false);
        });
    });
});
