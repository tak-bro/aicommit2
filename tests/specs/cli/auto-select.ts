import http from 'http';
import { AddressInfo } from 'net';

import { type Options } from 'execa';
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
    [
        ['MOCK', 'm1'],
        ['MOCK2', 'm2'],
    ]
        .map(([name, model]) => `[${name}]\ncompatible=true\nurl=${url}\npath=/v1\nkey=sk-test\nmodel=${model}\nstream=false\n`)
        .join('');

type Fixture = Awaited<ReturnType<typeof createFixture>>;
type Git = Awaited<ReturnType<typeof createGit>>;

/**
 * A git repo with one staged file and both mock providers configured, plus the run options
 * every test here needs. `serverUp: false` closes the mock first, so every provider fails.
 */
const withMockProviders = async (
    serverUp: boolean,
    run: (context: { aicommit2: Fixture['aicommit2']; options: Options; git: Git }) => Promise<void>
) => {
    const mock = await startMockProvider();
    const config = twoProviderConfig(mock.url);
    if (!serverUp) {
        await mock.close();
    }

    const { fixture, aicommit2 } = await createFixture({ '.aicommit2': config, 'data.json': '{"a":1}', 'data2.json': '{"b":2}' });
    const git = await createGit(fixture.path);
    await git('add', ['data.json']);

    try {
        await run({
            aicommit2,
            git,
            options: {
                env: { AICOMMIT_CONFIG_PATH: `${fixture.path}/.aicommit2` },
                reject: false,
                // Bound the run: regressing the gate parks it at the picker, and a hung CI
                // job is a much worse signal than a failed assertion
                timeout: 30_000,
            },
        });
    } finally {
        if (serverUp) {
            await mock.close();
        }
        await fixture.rm();
    }
};

export default testSuite(({ describe }) => {
    describe('auto-select', async ({ test }) => {
        // Issue #262: `--auto-select` used to be ignored unless exactly one provider was
        // configured, so a non-interactive run fell through to the picker and waited for Enter.
        test('selects a message without prompting when several providers are configured', async () => {
            await withMockProviders(true, async ({ aicommit2, options }) => {
                const { stdout, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], options);

                expect(exitCode).toBe(0);
                expect(stdout).toMatch(MOCK_MESSAGE);
            });
        });

        test('commits without asking for confirmation', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                const { exitCode } = await aicommit2(['--all', '--auto-select'], options);
                expect(exitCode).toBe(0);

                const { stdout: commitMessage } = await git('log', ['--pretty=format:%s']);
                expect(commitMessage).toBe(MOCK_MESSAGE);
            });
        });

        // `rewrite` owns a second copy of the flag, so it needs its own coverage — the gate
        // was originally fixed in only one of the two commands.
        test('rewrite selects a message without prompting', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                // Two commits: the root commit has no parent, so it has no diff to rewrite from
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await git('commit', ['-m', 'chore: second']);

                const { stdout, exitCode } = await aicommit2(['rewrite', '--dry-run', '--auto-select'], options);

                expect(exitCode).toBe(0);
                expect(stdout).toMatch(MOCK_MESSAGE);
            });
        });

        // Nothing renders the per-model error lines in auto-select mode, so they used to be
        // swallowed entirely and the run ended with no explanation.
        test('prints the per-model errors when every provider fails', async () => {
            await withMockProviders(false, async ({ aicommit2, options }) => {
                const { stdout, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], options);

                expect(exitCode).toBe(1);
                expect(stdout).toMatch('M1');
                expect(stdout).toMatch('M2');
                expect(stdout).toMatch('No valid commit message was generated');
            });
        });
    });
});
