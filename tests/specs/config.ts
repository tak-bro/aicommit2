import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { createFixture } from '../utils.js';

export default testSuite(({ describe }) => {
    describe('config', async ({ test, describe }) => {
        const { fixture, aicommit2 } = await createFixture();
        const configPath = path.join(fixture.path, '.aicommit2');
        const openAiToken = 'OPENAI_KEY=sk-abc';

        test('set unknown config file', async () => {
            const { stderr } = await aicommit2(['config', 'set', 'UNKNOWN=1'], {
                reject: false,
            });

            expect(stderr).toMatch('Invalid config property: UNKNOWN');
        });

        test('set invalid OPENAI_KEY', async () => {
            const { stderr } = await aicommit2(['config', 'set', 'OPENAI_KEY=abc'], {
                reject: false,
            });

            expect(stderr).toMatch('Invalid config property OPENAI_KEY: Must start with "sk-"');
        });

        await test('set config file', async () => {
            await aicommit2(['config', 'set', openAiToken]);

            const configFile = await fs.readFile(configPath, 'utf8');
            expect(configFile).toMatch(openAiToken);
        });

        await test('get config file', async () => {
            const { stdout } = await aicommit2(['config', 'get', 'OPENAI_KEY']);
            expect(stdout).toBe(openAiToken);
        });

        await test('reading unknown config', async () => {
            await fs.appendFile(configPath, 'UNKNOWN=1');

            const { stdout, stderr } = await aicommit2(['config', 'get', 'UNKNOWN'], {
                reject: false,
            });

            expect(stdout).toBe('');
            expect(stderr).toBe('');
        });

        await describe('timeout', ({ test }) => {
            test('setting invalid timeout config', async () => {
                const { stderr } = await aicommit2(['config', 'set', 'timeout=abc'], {
                    reject: false,
                });

                expect(stderr).toMatch('Must be an integer');
            });

            test('setting valid timeout config', async () => {
                const timeout = 'timeout=20000';
                await aicommit2(['config', 'set', timeout]);

                const configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).toMatch(timeout);

                const get = await aicommit2(['config', 'get', 'timeout']);
                expect(get.stdout).toBe(timeout);
            });
        });

        await describe('max-length', ({ test }) => {
            test('must be an integer', async () => {
                const { stderr } = await aicommit2(['config', 'set', 'max-length=abc'], {
                    reject: false,
                });

                expect(stderr).toMatch('Must be an integer');
            });

            test('must be at least 20 characters', async () => {
                const { stderr } = await aicommit2(['config', 'set', 'max-length=10'], {
                    reject: false,
                });

                expect(stderr).toMatch(/must be greater than 20 characters/i);
            });

            test('updates config', async () => {
                const defaultConfig = await aicommit2(['config', 'get', 'max-length']);
                expect(defaultConfig.stdout).toBe('max-length=50');

                const maxLength = 'max-length=60';
                await aicommit2(['config', 'set', maxLength]);

                const configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).toMatch(maxLength);

                const get = await aicommit2(['config', 'get', 'max-length']);
                expect(get.stdout).toBe(maxLength);
            });
        });

        await describe('del', async ({ test }) => {
            await test('delete a general property', async () => {
                await aicommit2(['config', 'set', 'logging=false']);
                let configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).toMatch('logging=false');

                await aicommit2(['config', 'del', 'logging']);
                configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).not.toMatch('logging=false');
            });

            await test('delete a model-specific property', async () => {
                await aicommit2(['config', 'set', 'OPENAI.temperature=0.9']);
                let configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).toMatch('OPENAI.temperature=0.9');

                await aicommit2(['config', 'del', 'OPENAI.temperature']);
                configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).not.toMatch('OPENAI.temperature=0.9');
            });

            await test('delete an entire model section', async () => {
                await aicommit2(['config', 'set', 'GEMINI.key=test_key']);
                let configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).toMatch('[GEMINI]');
                expect(configFile).toMatch('key=test_key');

                await aicommit2(['config', 'del', 'GEMINI']);
                configFile = await fs.readFile(configPath, 'utf8');
                expect(configFile).not.toMatch('[GEMINI]');
                expect(configFile).not.toMatch('key=test_key');
            });

            await test('attempt to delete a non-existent config', async () => {
                const { stderr } = await aicommit2(['config', 'del', 'NON_EXISTENT_CONFIG'], {
                    reject: false,
                });
                expect(stderr).toMatch('Config not found: NON_EXISTENT_CONFIG');

                const { stderr: stderrNested } = await aicommit2(['config', 'del', 'OPENAI.NON_EXISTENT_KEY'], {
                    reject: false,
                });
                expect(stderrNested).toMatch('Config not found: OPENAI.NON_EXISTENT_KEY');
            });
        });

        await test('set config file', async () => {
            await aicommit2(['config', 'set', openAiToken]);

            const configFile = await fs.readFile(configPath, 'utf8');
            expect(configFile).toMatch(openAiToken);
        });

        await test('get config file', async () => {
            const { stdout } = await aicommit2(['config', 'get', 'OPENAI_KEY']);
            expect(stdout).toBe(openAiToken);
        });

        await fixture.rm();
    });
});
