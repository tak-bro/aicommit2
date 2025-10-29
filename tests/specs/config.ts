import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { getAvailableAIs } from '../../src/commands/get-available-ais.js';
import { ValidConfig, getConfig } from '../../src/utils/config.js';
import { ensureDirectoryExists } from '../../src/utils/utils.js';
import { createFixture } from '../utils.js';

const snapshotEnv = (keys: string[]) =>
    Object.fromEntries(keys.map(key => [key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined]));

const restoreEnv = (snapshot: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(snapshot)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
};

export default testSuite(({ describe }) => {
    describe('config', async ({ test, describe }) => {
        const openAiToken = 'OPENAI.key=sk-abc';

        test('set unknown config property', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const configPath = path.join(fixture.path, '.aicommit2');
            const { stdout } = await aicommit2(['config', 'set', 'UNKNOWN=1'], {
                reject: false,
            });

            expect(stdout).toMatch('\n✖ Invalid config property: UNKNOWN');
            await fixture.rm();
        });

        await test('set config file', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['config', 'path']);
            await aicommit2(['config', 'set', openAiToken]);

            const configFile = await fs.readFile(stdout, 'utf8');
            expect(configFile).toMatch('[OPENAI]\nkey=sk-abc\n');
            await fixture.rm();
        });

        await test('get config file', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['config', 'path']);
            await aicommit2(['config', 'set', openAiToken]);
            const configFile = await fs.readFile(stdout, 'utf8');
            expect(configFile).toMatch('[OPENAI]\nkey=sk-abc\n');

            // Check if config get command exits successfully
            const { exitCode } = await aicommit2(['config', 'get', 'OPENAI.key']);
            expect(exitCode).toBe(0);
            await fixture.rm();
        });

        await test('reading unknown config', async () => {
            const { fixture, aicommit2 } = await createFixture();
            {
                const { stdout } = await aicommit2(['config', 'path']);
                await ensureDirectoryExists(path.dirname(stdout));
                await fs.appendFile(stdout, 'UNKNOWN=1');
            }

            const { stdout, stderr } = await aicommit2(['config', 'get', 'UNKNOWN'], {
                reject: false,
            });

            // Based on latest output, config get UNKNOWN returns the whole config
            expect(stdout).toMatch('UNKNOWN {'); // Check for the start of the object string
            expect(stderr).toBe('');
            await fixture.rm();
        });

        await describe('timeout', ({ test }) => {
            test('setting invalid timeout config', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'set', 'timeout=abc'], {
                    reject: false,
                });
                expect(stdout).toMatch('\n✖ Invalid config property timeout: Must be an integer'); // Updated expectation
                await fixture.rm();
            });

            test('setting valid timeout config', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                const timeout = 'timeout=20000';
                await aicommit2(['config', 'set', timeout]);

                const configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch(timeout);

                // Check if config get command exits successfully
                const { exitCode } = await aicommit2(['config', 'get', 'timeout']);
                expect(exitCode).toBe(0);
                await fixture.rm();
            });
        });

        await describe('maxLength', ({ test }) => {
            test('must be an integer', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'set', 'maxLength=abc'], {
                    reject: false,
                });

                expect(stdout).toMatch('\n✖ Invalid config property maxLength: Must be an integer'); // Updated expectation
                await fixture.rm();
            });

            test('must be at least 20 characters', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'set', 'maxLength=10'], {
                    reject: false,
                });

                expect(stdout).toMatch('\n✖ Invalid config property maxLength: Must be greater than 20 characters'); // Updated expectation
                await fixture.rm();
            });

            test('updates config', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                // Set the default config first for the get test
                await aicommit2(['config', 'set', 'maxLength=50']);
                // Check config file content after setting
                let configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch('maxLength=50');

                // Check if config get command exits successfully
                let { exitCode } = await aicommit2(['config', 'get', 'maxLength']);
                expect(exitCode).toBe(0);

                const maxLength = 'maxLength=60';
                await aicommit2(['config', 'set', maxLength]);

                configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch(maxLength);

                // Check if config get command exits successfully
                ({ exitCode } = await aicommit2(['config', 'get', 'maxLength']));
                expect(exitCode).toBe(0);
                await fixture.rm();
            });
        });

        await describe('del', async ({ test }) => {
            await test('delete a general property', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                await aicommit2(['config', 'set', 'logging=false']);
                let configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch('logging=false');

                await aicommit2(['config', 'del', 'logging']);
                configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).not.toMatch('logging=false');
                await fixture.rm();
            });

            await test('delete a model-specific property', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                await aicommit2(['config', 'set', 'OPENAI.temperature=0.9']);
                let configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch('temperature=0.9'); // Check for value presence

                await aicommit2(['config', 'del', 'OPENAI.temperature']);
                configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).not.toMatch('temperature=0.9'); // Check for value absence
                await fixture.rm();
            });

            await test('delete an entire model section', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                await aicommit2(['config', 'set', 'GEMINI.key=test_key']);
                let configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch('[GEMINI]');
                expect(configFile).toMatch('key=test_key');

                await aicommit2(['config', 'del', 'GEMINI']);
                configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).not.toMatch('[GEMINI]');
                expect(configFile).not.toMatch('key=test_key');
                await fixture.rm();
            });

            await test('attempt to delete a non-existent config', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'del', 'NON_EXISTENT_CONFIG'], {
                    reject: false,
                });
                expect(stdout).toMatch('\n✖ Config not found: NON_EXISTENT_CONFIG');

                const { stdout: stdoutNested } = await aicommit2(['config', 'del', 'OPENAI.NON_EXISTENT_KEY'], {
                    reject: false,
                });
                expect(stdoutNested).toMatch('\n✖ Config not found: OPENAI.NON_EXISTENT_KEY');
                await fixture.rm();
            });
        });

        await describe('disableLowerCase', ({ test }) => {
            test('setting disableLowerCase to true', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                const disableLowerCase = 'disableLowerCase=true';
                await aicommit2(['config', 'set', disableLowerCase]);

                const configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch(disableLowerCase);

                // Check if config get command exits successfully
                const { exitCode } = await aicommit2(['config', 'get', 'disableLowerCase']);
                expect(exitCode).toBe(0);
                await fixture.rm();
            });

            test('setting disableLowerCase to false', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'path']);
                const disableLowerCase = 'disableLowerCase=false';
                await aicommit2(['config', 'set', disableLowerCase]);

                const configFile = await fs.readFile(stdout, 'utf8');
                expect(configFile).toMatch(disableLowerCase);

                // Check if config get command exits successfully
                const { exitCode } = await aicommit2(['config', 'get', 'disableLowerCase']);
                expect(exitCode).toBe(0);
                await fixture.rm();
            });

            test('setting invalid disableLowerCase config', async () => {
                const { fixture, aicommit2 } = await createFixture();
                const { stdout } = await aicommit2(['config', 'set', 'disableLowerCase=invalid'], {
                    reject: false,
                });
                expect(stdout).toMatch('\n✖ Invalid config property disableLowerCase: Must be a boolean(true or false)');
                await fixture.rm();
            });
        });

        await describe('Bedrock configuration', async ({ test }) => {
            const envKeys = [
                'AICOMMIT_CONFIG_PATH',
                'AWS_REGION',
                'AWS_DEFAULT_REGION',
                'AWS_ACCESS_KEY_ID',
                'AWS_SECRET_ACCESS_KEY',
                'AWS_SESSION_TOKEN',
                'AWS_PROFILE',
                'BEDROCK_API_KEY',
                'BEDROCK_APPLICATION_API_KEY',
                'BEDROCK_APPLICATION_BASE_URL',
                'BEDROCK_APPLICATION_ENDPOINT_ID',
                'BEDROCK_APPLICATION_INFERENCE_PROFILE_ARN',
            ];

            await test('parses IAM environment fallbacks', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(configPath, '[BEDROCK]\nmodel=anthropic.claude\n');

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.AWS_REGION = 'us-west-2';
                process.env.AWS_DEFAULT_REGION = 'us-west-2';
                process.env.AWS_ACCESS_KEY_ID = 'AKIA_TEST';
                process.env.AWS_SECRET_ACCESS_KEY = 'SECRET_TEST';
                delete process.env.BEDROCK_API_KEY;
                delete process.env.BEDROCK_APPLICATION_API_KEY;

                const config = (await getConfig({}, [])) as ValidConfig;
                const bedrock = config.BEDROCK as any;

                expect(bedrock.region).toBe('us-west-2');
                expect(bedrock.accessKeyId).toBe('AKIA_TEST');
                expect(bedrock.secretAccessKey).toBe('SECRET_TEST');
                expect(bedrock.runtimeMode).toBe('foundation');
                expect(bedrock.envKey).toBe('BEDROCK_API_KEY');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('uses application API key environment fallback', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(configPath, ['[BEDROCK]', 'model=anthropic.claude', 'runtimeMode=application', ''].join('\n'));

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                delete process.env.BEDROCK_API_KEY;
                delete process.env.BEDROCK_APPLICATION_API_KEY;
                process.env.BEDROCK_APPLICATION_API_KEY = 'app-key-123';

                const config = (await getConfig({}, [])) as ValidConfig;
                const bedrock = config.BEDROCK as any;

                expect(bedrock.key).toBe('app-key-123');
                expect(bedrock.runtimeMode).toBe('application');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('considers Bedrock available with IAM credentials', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(configPath, ['[BEDROCK]', 'model=anthropic.claude', 'codeReview=true', ''].join('\n'));

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.AWS_REGION = 'us-east-1';
                process.env.AWS_ACCESS_KEY_ID = 'AKIA_EXAMPLE';
                process.env.AWS_SECRET_ACCESS_KEY = 'SECRET_EXAMPLE';
                delete process.env.BEDROCK_API_KEY;
                delete process.env.BEDROCK_APPLICATION_API_KEY;

                const config = (await getConfig({}, [])) as ValidConfig;

                const commitAIs = getAvailableAIs(config, 'commit');
                const reviewAIs = getAvailableAIs(config, 'review');

                expect(commitAIs).toContain('BEDROCK');
                expect(reviewAIs).toContain('BEDROCK');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('considers Bedrock available with application endpoint details', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(
                    configPath,
                    [
                        '[BEDROCK]',
                        'model=anthropic.claude',
                        'runtimeMode=application',
                        'applicationBaseUrl=https://example.com/invoke',
                        'key=test-api-key',
                        'codeReview=true',
                        '',
                    ].join('\n')
                );

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                delete process.env.BEDROCK_API_KEY;
                delete process.env.BEDROCK_APPLICATION_API_KEY;

                const config = (await getConfig({}, [])) as ValidConfig;

                const commitAIs = getAvailableAIs(config, 'commit');
                const reviewAIs = getAvailableAIs(config, 'review');

                expect(commitAIs).toContain('BEDROCK');
                expect(reviewAIs).toContain('BEDROCK');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('considers Bedrock available with AWS_PROFILE environment variable', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(configPath, ['[BEDROCK]', 'model=anthropic.claude-3', 'codeReview=true', ''].join('\n'));

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.AWS_REGION = 'eu-west-1';
                process.env.AWS_PROFILE = 'my-profile';
                delete process.env.AWS_ACCESS_KEY_ID;
                delete process.env.AWS_SECRET_ACCESS_KEY;
                delete process.env.BEDROCK_API_KEY;

                const config = (await getConfig({}, [])) as ValidConfig;

                const commitAIs = getAvailableAIs(config, 'commit');
                const reviewAIs = getAvailableAIs(config, 'review');

                expect(commitAIs).toContain('BEDROCK');
                expect(reviewAIs).toContain('BEDROCK');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('considers Bedrock available with application endpoint environment variables', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(
                    configPath,
                    ['[BEDROCK]', 'model=anthropic.claude-3', 'runtimeMode=application', 'codeReview=true', ''].join('\n')
                );

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.BEDROCK_APPLICATION_ENDPOINT_ID = 'my-endpoint-123';
                process.env.BEDROCK_APPLICATION_API_KEY = 'test-api-key';
                delete process.env.BEDROCK_APPLICATION_BASE_URL;

                const config = (await getConfig({}, [])) as ValidConfig;

                const commitAIs = getAvailableAIs(config, 'commit');
                const reviewAIs = getAvailableAIs(config, 'review');

                expect(commitAIs).toContain('BEDROCK');
                expect(reviewAIs).toContain('BEDROCK');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('considers Bedrock available with application mode using region and API key only', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(
                    configPath,
                    [
                        '[BEDROCK]',
                        'model=arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123',
                        'runtimeMode=application',
                        'region=us-east-1',
                        'key=test-api-key',
                        'codeReview=true',
                        '',
                    ].join('\n')
                );

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                delete process.env.BEDROCK_APPLICATION_BASE_URL;
                delete process.env.BEDROCK_APPLICATION_ENDPOINT_ID;
                delete process.env.BEDROCK_APPLICATION_INFERENCE_PROFILE_ARN;

                const config = (await getConfig({}, [])) as ValidConfig;

                const commitAIs = getAvailableAIs(config, 'commit');
                const reviewAIs = getAvailableAIs(config, 'review');

                expect(commitAIs).toContain('BEDROCK');
                expect(reviewAIs).toContain('BEDROCK');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('does not consider Bedrock available without credentials or endpoints', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(configPath, ['[BEDROCK]', 'model=anthropic.claude-3', ''].join('\n'));

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                delete process.env.AWS_REGION;
                delete process.env.AWS_DEFAULT_REGION;
                delete process.env.AWS_ACCESS_KEY_ID;
                delete process.env.AWS_SECRET_ACCESS_KEY;
                delete process.env.AWS_PROFILE;
                delete process.env.BEDROCK_API_KEY;
                delete process.env.BEDROCK_APPLICATION_API_KEY;
                delete process.env.BEDROCK_APPLICATION_BASE_URL;
                delete process.env.BEDROCK_APPLICATION_ENDPOINT_ID;

                const config = (await getConfig({}, [])) as ValidConfig;

                const commitAIs = getAvailableAIs(config, 'commit');

                expect(commitAIs).not.toContain('BEDROCK');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('auto-detects application mode from application-inference-profile ARN', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(
                    configPath,
                    [
                        '[BEDROCK]',
                        'model=arn:aws:bedrock:us-east-1:123456789012:application-inference-profile/abc123',
                        'region=us-east-1',
                        '',
                    ].join('\n')
                );

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.BEDROCK_APPLICATION_API_KEY = 'test-api-key';

                const config = (await getConfig({}, [])) as ValidConfig;
                const bedrock = config.BEDROCK as any;

                expect(bedrock.runtimeMode).toBe('application');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('defaults to foundation mode for standard model IDs', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(
                    configPath,
                    ['[BEDROCK]', 'model=anthropic.claude-haiku-4-5-20251001-v1:0', 'region=us-west-2', ''].join('\n')
                );

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.AWS_ACCESS_KEY_ID = 'AKIA_TEST';
                process.env.AWS_SECRET_ACCESS_KEY = 'SECRET_TEST';

                const config = (await getConfig({}, [])) as ValidConfig;
                const bedrock = config.BEDROCK as any;

                expect(bedrock.runtimeMode).toBe('foundation');

                await fixture.rm();
                restoreEnv(snapshot);
            });

            await test('explicit runtimeMode overrides auto-detection', async () => {
                const { fixture } = await createFixture();
                const configPath = path.join(fixture.path, '.config', 'aicommit2', 'config.ini');
                await ensureDirectoryExists(path.dirname(configPath));
                await fs.writeFile(
                    configPath,
                    ['[BEDROCK]', 'model=anthropic.claude-haiku-4-5-20251001-v1:0', 'runtimeMode=application', 'region=us-east-1', ''].join(
                        '\n'
                    )
                );

                const snapshot = snapshotEnv(envKeys);

                process.env.AICOMMIT_CONFIG_PATH = configPath;
                process.env.BEDROCK_APPLICATION_API_KEY = 'test-api-key';

                const config = (await getConfig({}, [])) as ValidConfig;
                const bedrock = config.BEDROCK as any;

                expect(bedrock.runtimeMode).toBe('application');

                await fixture.rm();
                restoreEnv(snapshot);
            });
        });
    });
});
