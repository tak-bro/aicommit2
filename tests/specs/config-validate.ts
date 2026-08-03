import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { createFixture } from '../utils.js';

export default testSuite(({ describe }) => {
    describe('config validate', async ({ test }) => {
        const runValidate = async (configContent: string) => {
            const { fixture, aicommit2 } = await createFixture();
            const configPath = path.join(fixture.path, '.aicommit2');
            await fs.writeFile(configPath, configContent);

            const result = await aicommit2(['config', 'validate'], {
                env: { AICOMMIT_CONFIG_PATH: configPath },
                reject: false,
            });

            await fixture.rm();
            return result;
        };

        test('accepts a valid config', async () => {
            const { stdout, exitCode } = await runValidate('[OPENAI]\nkey=sk-test\nmodel=gpt-4o\ntemperature=0.7\n');

            expect(stdout).toMatch('Configuration is valid');
            expect(exitCode).toBe(0);
        });

        test('reports a section name that is silently dropped', async () => {
            const { stdout, exitCode } = await runValidate('[openai]\nkey=sk-test\n');

            expect(stdout).toMatch('[openai]');
            expect(stdout).toMatch('Invalid section name');
            expect(stdout).toMatch('Did you mean [OPENAI]?');
            expect(exitCode).toBe(1);
        });

        test('reports an unknown option and suggests the closest one', async () => {
            const { stdout, exitCode } = await runValidate('[OPENAI]\nkey=sk-test\nmodell=gpt-4o\n');

            expect(stdout).toMatch('OPENAI.modell');
            expect(stdout).toMatch('Unknown option');
            expect(stdout).toMatch('Did you mean `model`?');
            // Unknown options are a warning, not a failure
            expect(exitCode).toBe(0);
        });

        test('reports every invalid value, not just the first', async () => {
            const { stdout, exitCode } = await runValidate('[OPENAI]\ntemperature=99\nmaxTokens=abc\n');

            expect(stdout).toMatch('OPENAI.temperature');
            expect(stdout).toMatch('OPENAI.maxTokens');
            expect(exitCode).toBe(1);
        });

        test('reports an invalid top level option value', async () => {
            const { stdout, exitCode } = await runValidate('generate=nope\n');

            expect(stdout).toMatch('generate');
            expect(stdout).toMatch('Must be an integer');
            expect(exitCode).toBe(1);
        });

        // An unreadable config file used to be swallowed, so the run continued with an empty
        // config and failed later with something unrelated.
        test('names the config file when it cannot be read', async () => {
            const { fixture, aicommit2 } = await createFixture({ 'not-a-file/keep': '' });
            const configPath = path.join(fixture.path, 'not-a-file');

            const { stdout, exitCode } = await aicommit2(['config', 'validate'], {
                env: { AICOMMIT_CONFIG_PATH: configPath },
                reject: false,
            });

            expect(stdout).toMatch('Failed to read config file');
            expect(stdout).toMatch(configPath);
            expect(exitCode).toBe(1);
            await fixture.rm();
        });

        test('reports an unreadable config file on a normal run instead of failing later', async () => {
            const { fixture, aicommit2 } = await createFixture({ 'not-a-file/keep': '' });
            const configPath = path.join(fixture.path, 'not-a-file');

            const { stdout, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], {
                env: { AICOMMIT_CONFIG_PATH: configPath },
                reject: false,
            });

            expect(stdout).toMatch('Failed to read config file');
            expect(stdout).toMatch('config validate');
            expect(exitCode).toBe(1);
            await fixture.rm();
        });

        test('passes when no config file exists', async () => {
            const { fixture, aicommit2 } = await createFixture();

            const { stdout, exitCode } = await aicommit2(['config', 'validate'], {
                env: { AICOMMIT_CONFIG_PATH: path.join(fixture.path, 'missing-config') },
                reject: false,
            });

            expect(stdout).toMatch('No configuration file found');
            expect(exitCode).toBe(0);
            await fixture.rm();
        });
    });
});
