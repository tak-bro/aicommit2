import { expect, testSuite } from 'manten';

import { GitHubModelsService } from '../../../src/services/ai/github-models.service.js';

const createService = (model: string) =>
    new GitHubModelsService({
        config: {
            key: 'github_pat_test',
            model: [model],
            timeout: 1000,
            maxTokens: 128,
            topP: 0.9,
            temperature: 0.7,
            logging: false,
        } as any,
        stagedDiff: {
            files: ['file.ts'],
            diff: 'diff --git a/file.ts b/file.ts',
        },
        keyName: 'GITHUB_MODELS',
    });

export default testSuite(({ describe }) => {
    describe('github models service', ({ test }) => {
        test('uses reasoning parameters for prefixed reasoning models', async () => {
            const service = createService('openai/gpt-5');
            let requestBody: any;
            const originalFetch = globalThis.fetch;

            globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
                requestBody = JSON.parse(String(init?.body || '{}'));
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: '[{\"subject\":\"feat: add tests\"}]' } }],
                    }),
                } as Response;
            }) as typeof fetch;

            try {
                await (service as any).makeRequest('system', 'diff', 'commit');
            } finally {
                globalThis.fetch = originalFetch;
            }

            expect(requestBody.max_completion_tokens).toBe(128);
            expect(requestBody.max_tokens).toBe(undefined);
        });

        test('uses standard parameters for non-reasoning prefixed models', async () => {
            const service = createService('openai/gpt-4o-mini');
            let requestBody: any;
            const originalFetch = globalThis.fetch;

            globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit) => {
                requestBody = JSON.parse(String(init?.body || '{}'));
                return {
                    ok: true,
                    json: async () => ({
                        choices: [{ message: { content: '[{\"subject\":\"fix: align config\"}]' } }],
                    }),
                } as Response;
            }) as typeof fetch;

            try {
                await (service as any).makeRequest('system', 'diff', 'commit');
            } finally {
                globalThis.fetch = originalFetch;
            }

            expect(requestBody.max_tokens).toBe(128);
            expect(requestBody.max_completion_tokens).toBe(undefined);
        });
    });
});
