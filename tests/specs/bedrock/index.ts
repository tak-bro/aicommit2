import { expect, testSuite } from 'manten';

import { BedrockService } from '../../../src/services/ai/bedrock.service.js';

export default testSuite(({ describe }) => {
    describe('BedrockService', ({ test, describe }) => {
        describe('Configuration Validation', ({ test }) => {
            test('throws error for application mode without API key', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        runtimeMode: 'application',
                        region: 'us-east-1',
                        key: '', // Empty key
                        applicationBaseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com/application-inference',
                        codeReview: false,
                        temperature: 0.7,
                        topP: 1,
                        maxTokens: 1024,
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                expect(() => new BedrockService(params as any)).toThrow('Application mode requires a Bedrock API key');
            });

            test('throws error for foundation mode without region', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        runtimeMode: 'foundation',
                        region: '', // Empty region
                        key: '',
                        codeReview: false,
                        temperature: 0.7,
                        topP: 1,
                        maxTokens: 1024,
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                // Save and clear environment variables
                const savedRegion = process.env.AWS_REGION;
                const savedDefaultRegion = process.env.AWS_DEFAULT_REGION;
                delete process.env.AWS_REGION;
                delete process.env.AWS_DEFAULT_REGION;

                try {
                    expect(() => new BedrockService(params as any)).toThrow('AWS region is required to use Bedrock foundation models');
                } finally {
                    // Restore environment variables
                    if (savedRegion !== undefined) {
                        process.env.AWS_REGION = savedRegion;
                    }
                    if (savedDefaultRegion !== undefined) {
                        process.env.AWS_DEFAULT_REGION = savedDefaultRegion;
                    }
                }
            });

            test('throws error for application mode without endpoint configuration', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        runtimeMode: 'application',
                        region: '', // No region
                        key: 'test-api-key',
                        applicationBaseUrl: '', // No base URL
                        applicationEndpointId: '', // No endpoint ID
                        codeReview: false,
                        temperature: 0.7,
                        topP: 1,
                        maxTokens: 1024,
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                // Clear all region-related environment variables
                const savedRegion = process.env.AWS_REGION;
                const savedDefaultRegion = process.env.AWS_DEFAULT_REGION;
                delete process.env.AWS_REGION;
                delete process.env.AWS_DEFAULT_REGION;

                try {
                    expect(() => new BedrockService(params as any)).toThrow('Application mode requires applicationBaseUrl or region');
                } finally {
                    // Restore environment variables
                    if (savedRegion !== undefined) {
                        process.env.AWS_REGION = savedRegion;
                    }
                    if (savedDefaultRegion !== undefined) {
                        process.env.AWS_DEFAULT_REGION = savedDefaultRegion;
                    }
                }
            });

            test('successfully constructs with valid foundation mode config', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        runtimeMode: 'foundation',
                        region: 'us-west-2',
                        key: '',
                        codeReview: false,
                        temperature: 0.7,
                        topP: 1,
                        maxTokens: 1024,
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                        accessKeyId: 'AKIA_TEST',
                        secretAccessKey: 'test_secret',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                expect(() => new BedrockService(params as any)).not.toThrow();
            });

            test('successfully constructs with valid application mode config', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        runtimeMode: 'application',
                        region: 'us-east-1',
                        key: 'test-api-key',
                        applicationBaseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com/application-inference',
                        codeReview: false,
                        temperature: 0.7,
                        topP: 1,
                        maxTokens: 1024,
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                expect(() => new BedrockService(params as any)).not.toThrow();
            });
        });
    });
});
