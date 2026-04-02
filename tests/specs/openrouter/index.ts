import { expect, testSuite } from 'manten';

import { OpenRouterService } from '../../../src/services/ai/openrouter.service.js';

export default testSuite(({ describe }) => {
    describe('OpenRouterService', ({ test }) => {
        test('includes OpenRouter-specific payload options when configured and supported', async () => {
            const params = {
                config: {
                    model: 'qwen/qwen3.6-plus-preview:free',
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

            (service as any).isResponseFormatSupported = async () => true;
            (service as any).isReasoningSupported = async () => true;
            (service as any).openAI = {
                chat: {
                    completions: {
                        create: async (payload: Record<string, unknown>) => {
                            capturedPayload = payload;
                            return {
                                choices: [
                                    {
                                        message: {
                                            content:
                                                '{"subject":"[ADD] - add OpenRouter runtime config for Qwen model;","body":"","footer":""}',
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
                exclude: true,
            });
            expect(result[0].title).toBe('[ADD] - add OpenRouter runtime config for Qwen model;');
        });

        test('skips response_format automatically when the model does not support it', async () => {
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
                },
                stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                keyName: 'OPENROUTER' as const,
                branchName: 'main',
            };

            const service = new OpenRouterService(params as any);
            let capturedPayload: Record<string, unknown> | undefined;

            (service as any).isResponseFormatSupported = async () => false;
            (service as any).isReasoningSupported = async () => true;
            (service as any).openAI = {
                chat: {
                    completions: {
                        create: async (payload: Record<string, unknown>) => {
                            capturedPayload = payload;
                            return {
                                choices: [
                                    {
                                        message: {
                                            content:
                                                '{"subject":"[ADD] - add OpenRouter runtime config for aicommit2;","body":"","footer":""}',
                                        },
                                    },
                                ],
                            };
                        },
                    },
                },
            };

            const result = await (service as any).generateMessage('commit');

            expect(capturedPayload?.response_format).toBeUndefined();
            expect(capturedPayload?.provider).toEqual({
                allow_fallbacks: true,
                require_parameters: false,
            });
            expect(capturedPayload?.reasoning).toEqual({
                exclude: true,
            });
            expect(result[0].title).toBe('[ADD] - add OpenRouter runtime config for aicommit2;');
        });

        test('merges configured reasoning options while keeping reasoning hidden by default', async () => {
            const params = {
                config: {
                    model: 'qwen/qwen3.6-plus-preview:free',
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

            (service as any).isResponseFormatSupported = async () => false;
            (service as any).isReasoningSupported = async () => true;
            (service as any).openAI = {
                chat: {
                    completions: {
                        create: async (payload: Record<string, unknown>) => {
                            capturedPayload = payload;
                            return {
                                choices: [
                                    {
                                        message: {
                                            content:
                                                '{"subject":"[ADD] - add OpenRouter runtime config for aicommit2;","body":"","footer":""}',
                                        },
                                    },
                                ],
                            };
                        },
                    },
                },
            };

            await (service as any).generateMessage('commit');

            expect(capturedPayload?.reasoning).toEqual({
                effort: 'low',
                exclude: true,
            });
        });

        test('falls back to reasoning text when content is missing', async () => {
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
                },
                stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                keyName: 'OPENROUTER' as const,
                branchName: 'main',
            };

            const service = new OpenRouterService(params as any);

            (service as any).isResponseFormatSupported = async () => false;
            (service as any).isReasoningSupported = async () => true;
            (service as any).openAI = {
                chat: {
                    completions: {
                        create: async () => {
                            return {
                                choices: [
                                    {
                                        message: {
                                            content: null,
                                            reasoning: '[{"subject":"[FEATURE] - add reasoning fallback support;","body":"","footer":""}]',
                                        },
                                    },
                                ],
                            };
                        },
                    },
                },
            };

            const result = await (service as any).generateMessage('commit');

            expect(result[0].title).toBe('[FEATURE] - add reasoning fallback support;');
        });
    });
});
