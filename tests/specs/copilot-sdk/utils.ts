import { expect, testSuite } from 'manten';

import { getAvailableAIs } from '../../../src/commands/get-available-ais.js';
import {
    buildCopilotSdkClientOptions,
    getCopilotSdkModelCandidates,
    isCopilotSdkClassicPatError,
    isCopilotSdkModelAccessError,
    normalizeCopilotSdkModel,
} from '../../../src/services/ai/copilot-sdk.utils.js';

export default testSuite(({ describe }) => {
    describe('copilot sdk utils', ({ test }) => {
        test('normalizes model aliases and provider-prefixed IDs', () => {
            expect(normalizeCopilotSdkModel('openai/gpt-4.1')).toBe('gpt-4.1');
            expect(normalizeCopilotSdkModel('openai/gpt-5-mini')).toBe('gpt-5-mini');
            expect(normalizeCopilotSdkModel('anthropic/claude-haiku-4.5')).toBe('claude-haiku-4.5');
        });

        test('builds deduplicated fallback candidates', () => {
            expect(getCopilotSdkModelCandidates('openai/gpt-4.1')).toEqual(['gpt-4.1', 'gpt-4o', 'gpt-5-mini']);
            expect(getCopilotSdkModelCandidates('gpt-5-mini')).toEqual(['gpt-5-mini', 'gpt-4.1', 'gpt-4o']);
        });

        test('detects common model access errors', () => {
            expect(isCopilotSdkModelAccessError('Unknown model: gpt-5')).toBe(true);
            expect(isCopilotSdkModelAccessError('unavailable_model')).toBe(true);
            expect(isCopilotSdkModelAccessError('model not found')).toBe(true);
            expect(isCopilotSdkModelAccessError('network timeout')).toBe(false);
        });

        test('detects classic PAT auth errors', () => {
            expect(isCopilotSdkClassicPatError('Classic Personal Access Tokens (ghp_) are not supported by Copilot.')).toBe(true);
            expect(isCopilotSdkClassicPatError('No authentication information found.')).toBe(false);
        });

        test('builds client options with COPILOT_GITHUB_TOKEN and strips generic GitHub envs', () => {
            const options = buildCopilotSdkClientOptions({
                COPILOT_GITHUB_TOKEN: 'github_pat_test',
                GH_TOKEN: 'ghp_bad',
                GITHUB_TOKEN: 'ghp_bad_2',
            });

            expect(options.githubToken).toBe('github_pat_test');
            expect(options.useLoggedInUser).toBe(false);
            expect(options.env?.COPILOT_GITHUB_TOKEN).toBe('github_pat_test');
            expect(options.env?.GH_TOKEN).toBe(undefined);
            expect(options.env?.GITHUB_TOKEN).toBe(undefined);
        });

        test('builds client options using logged-in user when COPILOT_GITHUB_TOKEN is missing', () => {
            const options = buildCopilotSdkClientOptions({
                GH_TOKEN: 'ghp_bad',
                GITHUB_TOKEN: 'ghp_bad_2',
            });

            expect(options.githubToken).toBe(undefined);
            expect(options.useLoggedInUser).toBe(true);
            expect(options.env?.COPILOT_GITHUB_TOKEN).toBe(undefined);
            expect(options.env?.GH_TOKEN).toBe(undefined);
            expect(options.env?.GITHUB_TOKEN).toBe(undefined);
        });

        test('COPILOT_SDK is available without API key when model is configured', () => {
            const config = {
                codeReview: true,
                watchMode: true,
                COPILOT_SDK: {
                    model: ['gpt-4.1'],
                    key: '',
                },
            } as any;

            const commitAIs = getAvailableAIs(config, 'commit');
            const reviewAIs = getAvailableAIs(config, 'review');
            const watchAIs = getAvailableAIs(config, 'watch');

            expect(commitAIs).toContain('COPILOT_SDK');
            expect(reviewAIs).toContain('COPILOT_SDK');
            expect(watchAIs).toContain('COPILOT_SDK');
        });
    });
});
