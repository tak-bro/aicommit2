import { expect, testSuite } from 'manten';

import { BedrockService } from '../../../src/services/ai/bedrock.service.js';

export default testSuite(({ describe }) => {
    describe('BedrockService', ({ test, describe }) => {
        describe('Authentication-based Configuration', ({ test }) => {
            test('throws error when no authentication configured', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'us-east-1',
                        key: '',
                        codeReview: false,
                        inferenceParameters: {},
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                expect(() => new BedrockService(params as any)).toThrow('Authentication required');
            });

            test('throws error when region missing', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: '',
                        key: 'test-api-key',
                        codeReview: false,
                        inferenceParameters: {},
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                const savedRegion = process.env.AWS_REGION;
                const savedDefaultRegion = process.env.AWS_DEFAULT_REGION;
                delete process.env.AWS_REGION;
                delete process.env.AWS_DEFAULT_REGION;

                try {
                    expect(() => new BedrockService(params as any)).toThrow('AWS region is required');
                } finally {
                    if (savedRegion !== undefined) {
                        process.env.AWS_REGION = savedRegion;
                    }
                    if (savedDefaultRegion !== undefined) {
                        process.env.AWS_DEFAULT_REGION = savedDefaultRegion;
                    }
                }
            });

            test('uses AWS SDK with profile', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'us-east-1',
                        profile: 'test-profile',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('uses AWS SDK with access keys', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'us-west-2',
                        accessKeyId: 'AKIA_TEST',
                        secretAccessKey: 'test_secret',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('uses Bearer token with API key only', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'us-east-1',
                        key: 'test-api-key',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('prefers AWS SDK when both auth methods configured', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'us-east-1',
                        profile: 'test-profile',
                        key: 'test-api-key',
                        codeReview: false,
                        inferenceParameters: {},
                        timeout: 120000,
                        logging: false,
                        locale: 'en',
                        generate: 1,
                        type: '',
                    },
                    stagedDiff: { diff: 'test diff', files: [] },
                    keyName: 'BEDROCK' as const,
                };

                const service = new BedrockService(params as any);
                expect(service).toBeDefined();
            });

            test('works with foundation model ID', async () => {
                const params = {
                    config: {
                        model: 'anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'us-east-1',
                        profile: 'test-profile',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('works with cross-region profile (US)', async () => {
                const params = {
                    config: {
                        model: 'us.anthropic.claude-3-5-sonnet-20240620-v1:0',
                        region: 'us-east-1',
                        profile: 'test-profile',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('works with global inference profile', async () => {
                const params = {
                    config: {
                        model: 'global.anthropic.claude-sonnet-4-5-20250929-v1:0',
                        region: 'us-east-1',
                        profile: 'test-profile',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('works with EU inference profile', async () => {
                const params = {
                    config: {
                        model: 'eu.anthropic.claude-haiku-4-5-20251001-v1:0',
                        region: 'eu-west-1',
                        profile: 'test-profile',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('works with APAC inference profile', async () => {
                const params = {
                    config: {
                        model: 'apac.anthropic.claude-sonnet-4-5-20250929-v1:0',
                        region: 'ap-southeast-1',
                        profile: 'test-profile',
                        codeReview: false,
                        inferenceParameters: {},
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

            test('works with application profile ARN', async () => {
                const params = {
                    config: {
                        model: 'arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123',
                        region: 'us-east-1',
                        key: 'test-api-key',
                        codeReview: false,
                        inferenceParameters: {},
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
