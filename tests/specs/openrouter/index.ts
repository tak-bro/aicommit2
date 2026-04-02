import { expect, testSuite } from 'manten';

import { OpenRouterService } from '../../../src/services/ai/openrouter.service.js';

export default testSuite(({ describe }) => {
    describe('OpenRouterService', ({ test }) => {
        test('includes OpenRouter-specific payload options when configured', async () => {
            const params = {
                config: {
                    model: 'stepfun/step-3.5-flash:free',
                    key: 'test-api-key',
                    url: 'https://openrouter.ai',
                    path: '/api/v1/chat/completions',
                    maxTokens: 4096,
                    temperature: 0.2,
                    topP: 0.9,
                    timeout: 120000,
                    logging: false,
                    locale: 'ru',
                    generate: 1,
                    type: 'conventional',
                    maxLength: 50,
                    systemPrompt: '',
                    systemPromptPath: '',
                    codeReviewPromptPath: '',
                    responseFormat: {
                        type: 'json_object',
                    },
                    provider: {
                        allow_fallbacks: true,
                        require_parameters: false,
                    },
                    reasoning: {
                        effort: 'low',
                    },
                },
                stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                keyName: 'OPENROUTER' as const,
                branchName: 'main',
            };

            const service = new OpenRouterService(params as any);
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
                                            content: '{"subject":"feat: add openrouter support"}',
                                        },
                                    },
                                ],
                            };
                        },
                    },
                },
            };

            const result = await (service as any).generateMessage('commit');

            expect(capturedPayload?.response_format).toEqual({ type: 'json_object' });
            expect(capturedPayload?.provider).toEqual({
                allow_fallbacks: true,
                require_parameters: false,
            });
            expect(capturedPayload?.reasoning).toEqual({
                effort: 'low',
            });
            expect(capturedPayload?.max_tokens).toBe(4096);
            expect(result[0].title).toBe('feat: add openrouter support');
        });
    });
});
