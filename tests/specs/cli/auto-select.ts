import http from 'http';
import { AddressInfo } from 'net';

import { expect, testSuite } from 'manten';

import { createFixture, createGit } from '../../utils.js';

const MOCK_MESSAGE = 'feat: add mock feature';

/**
 * Minimal OpenAI-compatible endpoint. Two `compatible` providers point at it, which is
 * what makes these tests exercise the multi-provider path without any API key.
 */
const startMockProvider = async (): Promise<{ url: string; close: () => Promise<void> }> => {
    const server = http.createServer((request, response) => {
        request.on('data', () => {});
        request.on('end', () => {
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(
                JSON.stringify({
                    choices: [
                        {
                            index: 0,
                            message: { role: 'assistant', content: JSON.stringify([{ subject: MOCK_MESSAGE, body: '', footer: '' }]) },
                            finish_reason: 'stop',
                        },
                    ],
                })
            );
        });
    });

    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;

    return {
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
};

const twoProviderConfig = (url: string) =>
    ['[MOCK]', 'compatible=true', `url=${url}`, 'path=/v1', 'key=sk-test', 'model=m1', 'stream=false', ''].join('\n') +
    ['[MOCK2]', 'compatible=true', `url=${url}`, 'path=/v1', 'key=sk-test', 'model=m2', 'stream=false', ''].join('\n');

export default testSuite(({ describe }) => {
    describe('auto-select', async ({ test }) => {
        // Issue #262: `--auto-select` used to be ignored unless exactly one provider was
        // configured, so a non-interactive run fell through to the picker and waited for Enter.
        test('selects a message without prompting when several providers are configured', async () => {
            const mock = await startMockProvider();
            const { fixture, aicommit2 } = await createFixture({
                '.aicommit2': twoProviderConfig(mock.url),
                'data.json': '{"a":1}',
            });
            const git = await createGit(fixture.path);
            await git('add', ['data.json']);

            const { stdout, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], {
                env: { AICOMMIT_CONFIG_PATH: `${fixture.path}/.aicommit2` },
                reject: false,
                // Bound the run: regressing the gate parks it at the picker, and a hung CI
                // job is a much worse signal than a failed assertion
                timeout: 30_000,
            });

            expect(exitCode).toBe(0);
            expect(stdout).toMatch(MOCK_MESSAGE);

            await mock.close();
            await fixture.rm();
        });

        test('commits without asking for confirmation', async () => {
            const mock = await startMockProvider();
            const { fixture, aicommit2 } = await createFixture({
                '.aicommit2': twoProviderConfig(mock.url),
                'data.json': '{"a":1}',
            });
            const git = await createGit(fixture.path);
            await git('add', ['data.json']);

            const { exitCode } = await aicommit2(['--all', '--auto-select'], {
                env: { AICOMMIT_CONFIG_PATH: `${fixture.path}/.aicommit2` },
                reject: false,
                // Bound the run: regressing the gate parks it at the picker, and a hung CI
                // job is a much worse signal than a failed assertion
                timeout: 30_000,
            });

            expect(exitCode).toBe(0);
            const { stdout: commitMessage } = await git('log', ['--pretty=format:%s']);
            expect(commitMessage).toBe(MOCK_MESSAGE);

            await mock.close();
            await fixture.rm();
        });

        // Nothing renders the per-model error lines in auto-select mode, so they used to be
        // swallowed entirely and the run ended with no explanation.
        test('prints the per-model errors when every provider fails', async () => {
            const mock = await startMockProvider();
            const config = twoProviderConfig(mock.url);
            await mock.close();

            const { fixture, aicommit2 } = await createFixture({
                '.aicommit2': config,
                'data.json': '{"a":1}',
            });
            const git = await createGit(fixture.path);
            await git('add', ['data.json']);

            const { stdout, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], {
                env: { AICOMMIT_CONFIG_PATH: `${fixture.path}/.aicommit2` },
                reject: false,
                // Bound the run: regressing the gate parks it at the picker, and a hung CI
                // job is a much worse signal than a failed assertion
                timeout: 30_000,
            });

            expect(exitCode).toBe(1);
            expect(stdout).toMatch('M1');
            expect(stdout).toMatch('M2');
            expect(stdout).toMatch('No valid commit message was generated');

            await fixture.rm();
        });
    });
});
