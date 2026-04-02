import { expect, testSuite } from 'manten';

import {
    ensureGitHubModelsModelId,
    isValidGitHubModelsModelId,
    isValidGitHubTokenFormat,
    normalizeGitHubModelsModelId,
} from '../../../src/services/ai/github-models.utils.js';

export default testSuite(({ describe }) => {
    describe('github models utils', ({ test }) => {
        test('accepts valid publisher/model IDs', () => {
            expect(isValidGitHubModelsModelId('openai/gpt-4o-mini')).toBe(true);
            expect(isValidGitHubModelsModelId('meta/llama-3.3-70b-instruct')).toBe(true);
            expect(isValidGitHubModelsModelId('mistral-ai/mistral-large-2411')).toBe(true);
        });

        test('rejects invalid model IDs', () => {
            expect(isValidGitHubModelsModelId('gpt-4o-mini')).toBe(false);
            expect(isValidGitHubModelsModelId('openai')).toBe(false);
            expect(isValidGitHubModelsModelId('openai/')).toBe(false);
            expect(isValidGitHubModelsModelId('')).toBe(false);
        });

        test('normalizes and validates model IDs', () => {
            expect(normalizeGitHubModelsModelId('  openai/gpt-5  ')).toBe('openai/gpt-5');
            expect(ensureGitHubModelsModelId(' openai/gpt-5 ')).toBe('openai/gpt-5');
            expect(() => ensureGitHubModelsModelId('gpt-5')).toThrow('Expected format: "publisher/model"');
        });

        test('accepts modern and legacy GitHub token prefixes', () => {
            expect(isValidGitHubTokenFormat('github_pat_foo')).toBe(true);
            expect(isValidGitHubTokenFormat('ghp_foo')).toBe(true);
            expect(isValidGitHubTokenFormat('gho_foo')).toBe(true);
            expect(isValidGitHubTokenFormat('ghu_foo')).toBe(true);
            expect(isValidGitHubTokenFormat('ghs_foo')).toBe(true);
            expect(isValidGitHubTokenFormat('ghr_foo')).toBe(true);
            expect(isValidGitHubTokenFormat('foo')).toBe(false);
        });
    });
});
