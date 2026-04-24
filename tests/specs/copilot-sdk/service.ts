import { expect, testSuite } from 'manten';

import { CopilotSdkService } from '../../../src/services/ai/copilot-sdk.service.js';
import { isCopilotSdkAuthError } from '../../../src/services/ai/copilot-sdk.utils.js';

const createService = (model: string = 'gpt-4.1') =>
    new CopilotSdkService({
        config: {
            model: [model],
            timeout: 1000,
            maxTokens: 128,
            temperature: 0.7,
            logging: false,
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- minimal mock for testing
        stagedDiff: {
            files: ['file.ts'],
            diff: 'diff --git a/file.ts b/file.ts',
        },
        keyName: 'COPILOT_SDK',
    });

export default testSuite(({ describe }) => {
    describe('copilot sdk service', ({ test }) => {
        describe('extractContent', ({ test }) => {
            const callExtract = (response: unknown): string => {
                const service = createService();
                return (service as any).extractContent(response); // eslint-disable-line @typescript-eslint/no-explicit-any -- accessing private method
            };

            test('returns empty string for null/undefined', () => {
                expect(callExtract(null)).toBe('');
                expect(callExtract(undefined)).toBe('');
            });

            test('returns empty string for non-object', () => {
                expect(callExtract('string')).toBe('');
                expect(callExtract(42)).toBe('');
                expect(callExtract(true)).toBe('');
            });

            test('extracts direct content field', () => {
                expect(callExtract({ content: 'hello world' })).toBe('hello world');
            });

            test('trims whitespace from direct content', () => {
                expect(callExtract({ content: '  trimmed  ' })).toBe('trimmed');
            });

            test('extracts nested data.content', () => {
                expect(callExtract({ data: { content: 'nested' } })).toBe('nested');
            });

            test('extracts deep data.message.content', () => {
                expect(callExtract({ data: { message: { content: 'deep' } } })).toBe('deep');
            });

            test('returns empty string when no content found', () => {
                expect(callExtract({})).toBe('');
                expect(callExtract({ data: {} })).toBe('');
                expect(callExtract({ data: { message: {} } })).toBe('');
            });

            test('prefers direct content over nested', () => {
                expect(callExtract({ content: 'direct', data: { content: 'nested' } })).toBe('direct');
            });
        });

        describe('getServiceSpecificErrorMessage', ({ test }) => {
            const callErrorMessage = (code?: string, message?: string): string | null => {
                const service = createService();
                const error = new Error(message || '') as any;
                if (code) {
                    error.code = code;
                }
                return (service as any).getServiceSpecificErrorMessage(error);
            };

            test('returns install message for SDK_NOT_INSTALLED', () => {
                const result = callErrorMessage('SDK_NOT_INSTALLED');
                expect(result).toContain('not installed');
            });

            test('returns classic PAT message for ghp_ token error', () => {
                const result = callErrorMessage(undefined, 'Classic Personal Access Tokens (ghp_) are not supported by Copilot.');
                expect(result).toContain('ghp_');
            });

            test('returns auth message for AUTHENTICATION_FAILED code', () => {
                const result = callErrorMessage('AUTHENTICATION_FAILED');
                expect(result).toContain('authentication failed');
            });

            test('returns auth message for auth error message', () => {
                const result = callErrorMessage(undefined, 'unauthorized access denied');
                expect(result).toContain('authentication failed');
            });

            test('returns node:sqlite message for ERR_UNKNOWN_BUILTIN_MODULE', () => {
                const result = callErrorMessage(undefined, 'ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite');
                expect(result).toContain('Node.js 22+');
            });

            test('returns model unavailable for MODEL_NOT_AVAILABLE code', () => {
                const result = callErrorMessage('MODEL_NOT_AVAILABLE');
                expect(result).toContain('unavailable');
            });

            test('returns no content message for NO_CONTENT code', () => {
                const result = callErrorMessage('NO_CONTENT');
                expect(result).toContain('no content');
            });

            test('returns null for unknown error', () => {
                const result = callErrorMessage(undefined, 'some random error');
                expect(result).toBe(null);
            });
        });
    });

    describe('isCopilotSdkAuthError (tightened)', ({ test }) => {
        test('matches specific auth error patterns', () => {
            expect(isCopilotSdkAuthError('authentication failed')).toBe(true);
            expect(isCopilotSdkAuthError('unauthorized')).toBe(true);
            expect(isCopilotSdkAuthError('forbidden')).toBe(true);
            expect(isCopilotSdkAuthError('invalid token provided')).toBe(true);
            expect(isCopilotSdkAuthError('token expired')).toBe(true);
            expect(isCopilotSdkAuthError('No authentication information found')).toBe(true);
            expect(isCopilotSdkAuthError('copilot cli not found')).toBe(true);
            expect(isCopilotSdkAuthError('copilot cli authentication failed')).toBe(true);
        });

        test('does not false-positive on non-auth messages', () => {
            expect(isCopilotSdkAuthError('max_tokens exceeded')).toBe(false);
            expect(isCopilotSdkAuthError('token limit reached')).toBe(false);
            expect(isCopilotSdkAuthError('network timeout')).toBe(false);
            expect(isCopilotSdkAuthError('model not found')).toBe(false);
            expect(isCopilotSdkAuthError('rate limit exceeded')).toBe(false);
            expect(isCopilotSdkAuthError('author name required')).toBe(false);
            expect(isCopilotSdkAuthError('copilot cli updated successfully')).toBe(false);
        });
    });
});
