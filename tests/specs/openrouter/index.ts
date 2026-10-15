import os from 'os';
import path from 'path';

import { expect, testSuite } from 'manten';
import { firstValueFrom } from 'rxjs';

import { OpenRouterService } from '../../../src/services/ai/openrouter.service.js';
import { HttpRequestBuilder } from '../../../src/services/http/http-request.builder.js';
import { initializeLogger, isLoggerInitialized } from '../../../src/utils/logger.js';

export default testSuite(async ({ describe }) => {
    await describe('OpenRouterService', async ({ test }) => {
        // generateCommitMessage$() maps errors through handleError$, which logs
        if (!isLoggerInitialized()) {
            const logDir = path.join(os.tmpdir(), 'aicommit2-openrouter-test');
            await initializeLogger({
                logging: false,
                logFilePath: path.join(logDir, 'main.log'),
                exceptionLogFilePath: path.join(logDir, 'exception.log'),
            });
        }

        const resetOpenRouterCaches = () => {
            (OpenRouterService as any).catalogCache?.clear?.();
            (OpenRouterService as any).modelCache?.clear?.();
        };

        await test('includes OpenRouter-specific payload options when configured and supported', async () => {
            resetOpenRouterCaches();

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

        await test('skips response_format automatically when the model does not support it', async () => {
            resetOpenRouterCaches();

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

        await test('merges configured reasoning options while keeping reasoning hidden by default', async () => {
            resetOpenRouterCaches();

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

        await test('falls back to reasoning text when content is missing', async () => {
            resetOpenRouterCaches();

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

        await test('falls back to reasoning_content when content is missing', async () => {
            resetOpenRouterCaches();

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
                                            reasoning_content:
                                                '[{"subject":"[FEATURE] - add reasoning_content fallback support;","body":"","footer":""}]',
                                        },
                                    },
                                ],
                            };
                        },
                    },
                },
            };

            const result = await (service as any).generateMessage('commit');

            expect(result[0].title).toBe('[FEATURE] - add reasoning_content fallback support;');
        });

        await test('discovers capabilities from the catalog and caches the lookup', async () => {
            resetOpenRouterCaches();

            const originalExecute = HttpRequestBuilder.prototype.execute;
            const catalogCalls: string[] = [];

            HttpRequestBuilder.prototype.execute = async function <T>() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const baseURL = (this as any).config?.baseURL || '';
                catalogCalls.push(baseURL);

                if (baseURL.endsWith('/models/user')) {
                    const error = new Error('404 Not Found');
                    throw error;
                }

                if (baseURL.endsWith('/models')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 'qwen/qwen3.6-plus-preview:free',
                                    supported_parameters: ['response_format', 'reasoning'],
                                },
                            ],
                        },
                    } as any;
                }

                throw new Error(`Unexpected catalog URL: ${baseURL}`);
            };

            try {
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
                    },
                    stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                    keyName: 'OPENROUTER' as const,
                    branchName: 'main',
                };

                const service = new OpenRouterService(params as any);
                const capturedPayloads: Record<string, unknown>[] = [];

                (service as any).openAI = {
                    chat: {
                        completions: {
                            create: async (payload: Record<string, unknown>) => {
                                capturedPayloads.push(payload);
                                return {
                                    choices: [
                                        {
                                            message: {
                                                content:
                                                    '{"subject":"[ADD] - add catalog-backed OpenRouter capability detection;","body":"","footer":""}',
                                            },
                                        },
                                    ],
                                };
                            },
                        },
                    },
                };

                const result = await (service as any).generateMessage('commit');
                const cachedLookupCalls = catalogCalls.length;

                await (service as any).generateMessage('commit');

                expect(capturedPayloads).toHaveLength(2);
                expect(capturedPayloads[0]?.model).toBe('qwen/qwen3.6-plus-preview:free');
                expect(capturedPayloads[1]?.model).toBe('qwen/qwen3.6-plus-preview:free');
                expect(result[0].title).toBe('[ADD] - add catalog-backed OpenRouter capability detection;');
                expect(catalogCalls).toEqual(['https://openrouter.ai/api/v1/models/user', 'https://openrouter.ai/api/v1/models']);
                expect(catalogCalls.length).toBe(cachedLookupCalls);
            } finally {
                HttpRequestBuilder.prototype.execute = originalExecute;
            }
        });

        await test('supports include_reasoning-only catalog entries', async () => {
            resetOpenRouterCaches();

            const originalExecute = HttpRequestBuilder.prototype.execute;

            HttpRequestBuilder.prototype.execute = async function <T>() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const baseURL = (this as any).config?.baseURL || '';

                if (baseURL.endsWith('/models/user')) {
                    const error = new Error('404 Not Found');
                    throw error;
                }

                if (baseURL.endsWith('/models')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 'stepfun/step-3.5-flash:free',
                                    supported_parameters: ['include_reasoning'],
                                },
                            ],
                        },
                    } as any;
                }

                throw new Error(`Unexpected catalog URL: ${baseURL}`);
            };

            try {
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
                                                content: '{"subject":"[FEATURE] - add include_reasoning support;","body":"","footer":""}',
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
                expect(capturedPayload?.reasoning).toEqual({
                    exclude: true,
                });
                expect(result[0].title).toBe('[FEATURE] - add include_reasoning support;');
            } finally {
                HttpRequestBuilder.prototype.execute = originalExecute;
            }
        });

        await test('model=free races JSON-capable free models and returns the first valid response', async () => {
            resetOpenRouterCaches();

            const originalExecute = HttpRequestBuilder.prototype.execute;

            HttpRequestBuilder.prototype.execute = async function <T>() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const baseURL = (this as any).config?.baseURL || '';

                if (baseURL.endsWith('/models/user')) {
                    throw new Error('404 Not Found');
                }

                if (baseURL.endsWith('/models')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 'nvidia/nemotron-3.5-content-safety:free',
                                    supported_parameters: ['reasoning', 'include_reasoning', 'max_tokens'],
                                },
                                {
                                    id: 'apodex/apodex-1.1-mini:free',
                                    supported_parameters: ['response_format', 'reasoning'],
                                },
                                {
                                    id: 'google/gemma-4-31b-it:free',
                                    supported_parameters: ['response_format'],
                                },
                            ],
                        },
                    } as any;
                }

                throw new Error(`Unexpected catalog URL: ${baseURL}`);
            };

            try {
                const params = {
                    config: {
                        model: 'free',
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
                        responseFormat: { type: 'json_object' },
                        stream: true,
                    },
                    stagedDiff: { diff: 'diff --git a/file b/file', files: [] },
                    keyName: 'OPENROUTER' as const,
                    branchName: 'main',
                };

                const service = new OpenRouterService(params as any);
                const capturedPayloads: Record<string, unknown>[] = [];

                (service as any).openAI = {
                    chat: {
                        completions: {
                            create: async (payload: Record<string, unknown>) => {
                                capturedPayloads.push(payload);

                                if (payload.model === 'apodex/apodex-1.1-mini:free') {
                                    return {
                                        choices: [{ message: { content: 'User Safety: safe' } }],
                                    };
                                }

                                return {
                                    choices: [
                                        {
                                            message: {
                                                content: '{"subject":"[FEATURE] - add free model racing;","body":"","footer":""}',
                                            },
                                        },
                                    ],
                                };
                            },
                        },
                    },
                };

                const result = await (service as any).generateMessage('commit');

                expect(result[0].title).toBe('[FEATURE] - add free model racing;');
                expect((service as any).params.config.model).toEqual(['google/gemma-4-31b-it:free']);
                expect((service as any).serviceName).toMatch('gemma-4-31b-it');

                const racedModels = capturedPayloads.map(payload => payload.model).sort();
                expect(racedModels).toEqual(['apodex/apodex-1.1-mini:free', 'google/gemma-4-31b-it:free']);
                expect(capturedPayloads.every(payload => payload.stream === false)).toBe(true);
                expect(capturedPayloads.every(payload => payload.response_format !== undefined)).toBe(true);
            } finally {
                HttpRequestBuilder.prototype.execute = originalExecute;
            }
        });

        await test('model=free rejects with per-model failures when every free model fails', async () => {
            resetOpenRouterCaches();

            const originalExecute = HttpRequestBuilder.prototype.execute;

            HttpRequestBuilder.prototype.execute = async function <T>() {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const baseURL = (this as any).config?.baseURL || '';

                if (baseURL.endsWith('/models/user')) {
                    throw new Error('404 Not Found');
                }

                if (baseURL.endsWith('/models')) {
                    return {
                        data: {
                            data: [
                                {
                                    id: 'apodex/apodex-1.1-mini:free',
                                    supported_parameters: ['response_format'],
                                },
                            ],
                        },
                    } as any;
                }

                throw new Error(`Unexpected catalog URL: ${baseURL}`);
            };

            try {
                const params = {
                    config: {
                        model: 'free',
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

                (service as any).openAI = {
                    chat: {
                        completions: {
                            create: async () => {
                                throw new Error('429 rate limited');
                            },
                        },
                    },
                };

                // Assert on the emitted choice so the service error mapping is covered too
                const choice = await firstValueFrom(service.generateCommitMessage$());
                expect(choice.isError).toBe(true);
                expect(choice.name).toMatch(/All free OpenRouter models failed.*apodex\/apodex-1\.1-mini:free: 429 rate limited/);
            } finally {
                HttpRequestBuilder.prototype.execute = originalExecute;
            }
        });

        await test('invalid JSON errors include the raw model output', async () => {
            resetOpenRouterCaches();

            const params = {
                config: {
                    model: 'nvidia/nemotron-3.5-content-safety:free',
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
            (service as any).isReasoningSupported = async () => false;
            (service as any).openAI = {
                chat: {
                    completions: {
                        create: async () => ({
                            choices: [{ message: { content: 'User Safety: safe' } }],
                        }),
                    },
                },
            };

            const choice = await firstValueFrom(service.generateCommitMessage$());
            expect(choice.isError).toBe(true);
            expect(choice.name).toMatch(/did not contain a valid JSON object or array\. Raw response: User Safety: safe/);
        });
    });
});
