import http from 'http';
import { AddressInfo } from 'net';

import { type Options } from 'execa';

import { createFixture, createGit } from '../../utils.js';

export const MOCK_MESSAGE = 'feat: add mock feature';
export const MOCK_REVIEW_SUMMARY = 'Mock review summary';

export const MOCK_BODY = 'Mock body explaining why the feature exists';

const commitMessageContent = (body: string) => JSON.stringify([{ subject: MOCK_MESSAGE, body, footer: '' }]);
const codeReviewContent = (severity: string) =>
    JSON.stringify({
        summary: MOCK_REVIEW_SUMMARY,
        items: [{ severity, category: 'correctness', title: 'Mock finding', description: 'Mock description', suggestion: '' }],
    });

/**
 * Minimal OpenAI-compatible endpoint. Two `compatible` providers point at it, which is
 * what makes these tests exercise the multi-provider path without any API key.
 * Code review and commit message requests share the endpoint, so the prompt decides which
 * response shape comes back.
 */
const startMockProvider = async (reviewSeverity = 'warning', commitBody = ''): Promise<{ url: string; close: () => Promise<void> }> => {
    const server = http.createServer((request, response) => {
        let body = '';
        request.on('data', chunk => {
            body += chunk;
        });
        request.on('end', () => {
            // The prompt is JSON-escaped inside the request body, so match on a bare word
            // only the code review prompt uses
            const isCodeReviewRequest = body.includes('severity');
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(
                JSON.stringify({
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: 'assistant',
                                content: isCodeReviewRequest ? codeReviewContent(reviewSeverity) : commitMessageContent(commitBody),
                            },
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
 * every test needs. `commitBody` is what the mock puts in the message body (empty by default).
 * `serverUp: false` closes the mock first, so every provider fails.
 */
export const withMockProviders = async (
    serverUp: boolean,
    run: (context: { aicommit2: Fixture['aicommit2']; options: Options; git: Git }) => Promise<void>,
    extra: { generalConfig?: string; reviewSeverity?: string; commitBody?: string } = {}
) => {
    const mock = await startMockProvider(extra.reviewSeverity, extra.commitBody);
    const config = `${extra.generalConfig ?? ''}${twoProviderConfig(mock.url)}`;
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
