import fs from 'fs/promises';
import path from 'path';
import { expect, testSuite } from 'manten';
import { createFixture } from '../utils.js';

export default testSuite(({ describe }) => {
    describe('config environment variable expansion', async ({ test }) => {
        test('expands environment variables in config', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const configPath = path.join(fixture.path, '.aicommit2');

            await fs.writeFile(configPath, '[OPENAI]\nurl=$MY_CUSTOM_URL\n');

            const { stdout } = await aicommit2(['config', 'get', 'OPENAI.url'], {
                env: {
                    AICOMMIT_CONFIG_PATH: configPath,
                    MY_CUSTOM_URL: 'https://api.custom.com',
                },
            });

            expect(stdout).toMatch('https://api.custom.com');
            await fixture.rm();
        });

        test('expands environment variables with curly braces', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const configPath = path.join(fixture.path, '.aicommit2');

            await fs.writeFile(configPath, '[OPENAI]\nurl=${MY_CUSTOM_URL}/v1\n');

            const { stdout } = await aicommit2(['config', 'get', 'OPENAI.url'], {
                env: {
                    AICOMMIT_CONFIG_PATH: configPath,
                    MY_CUSTOM_URL: 'https://api.custom.com',
                },
            });

            expect(stdout).toMatch('https://api.custom.com/v1');
            await fixture.rm();
        });
    });
});
