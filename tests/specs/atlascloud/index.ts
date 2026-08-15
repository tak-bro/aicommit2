import { expect, testSuite } from 'manten';

import { AtlasCloudService } from '../../../src/services/ai/atlascloud.service.js';

export default testSuite(async ({ describe }) => {
    await describe('AtlasCloudService', async ({ test }) => {
        await test('uses the Atlas Cloud OpenAI-compatible endpoint and provider identity', async () => {
            const service = new AtlasCloudService({
                config: {
                    model: 'qwen/qwen3.8-max',
                    key: 'test-api-key',
                    url: 'https://api.atlascloud.ai',
                    path: '/v1',
                    maxTokens: 512,
                    temperature: 0.2,
                    topP: 0.9,
                    timeout: 120000,
                    logging: false,
                    locale: 'en',
                    generate: 1,
                    type: 'conventional',
                    maxLength: 50,
                    systemPrompt: '',
                    systemPromptPath: '',
                    codeReviewPromptPath: '',
                    stream: false,
                } as any,
                stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                keyName: 'ATLASCLOUD',
                branchName: 'main',
            });

            expect((service as any).openAI.baseURL).toBe('https://api.atlascloud.ai/v1');
            expect((service as any).getProviderName()).toMatch('Atlas Cloud');
        });

        await test('sends the configured model through Chat Completions', async () => {
            const service = new AtlasCloudService({
                config: {
                    model: 'qwen/qwen3.8-max',
                    key: 'test-api-key',
                    url: 'https://api.atlascloud.ai',
                    path: '/v1',
                    maxTokens: 512,
                    temperature: 0.2,
                    topP: 0.9,
                    timeout: 120000,
                    logging: false,
                    locale: 'en',
                    generate: 1,
                    type: 'conventional',
                    maxLength: 50,
                    systemPrompt: '',
                    systemPromptPath: '',
                    codeReviewPromptPath: '',
                    stream: false,
                } as any,
                stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                keyName: 'ATLASCLOUD',
                branchName: 'main',
            });
            let capturedPayload: Record<string, unknown> | undefined;

            (service as any).openAI = {
                chat: {
                    completions: {
                        create: async (payload: Record<string, unknown>) => {
                            capturedPayload = payload;
                            return {
                                choices: [
                                    {
                                        message: {
                                            content: '{"subject":"feat: add Atlas Cloud provider","body":"","footer":""}',
                                        },
                                    },
                                ],
                            };
                        },
                    },
                },
            };

            const result = await (service as any).generateMessage('commit');

            expect(capturedPayload?.model).toBe('qwen/qwen3.8-max');
            expect(result[0].title).toBe('feat: add Atlas Cloud provider');
        });
    });
});
