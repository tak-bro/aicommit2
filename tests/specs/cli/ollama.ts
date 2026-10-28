import http from 'http';

import { expect, testSuite } from 'manten';

import { createFixture, createGit } from '../../utils.js';

import type { ChatRequest } from 'ollama';

export default testSuite(({ describe }) => {
    describe('Ollama thinking controls', async ({ test }) => {
        for (const stream of [false, true]) {
            for (const think of [undefined, false, true]) {
                await test(`sends think=${think} with stream=${stream}`, async () => {
                    let payload: ChatRequest | undefined;
                    const subject = 'feat: add example function';
                    const server = http.createServer((request, response) => {
                        if (request.url !== '/api/chat') {
                            response.end('Ollama is running');
                            return;
                        }

                        let body = '';
                        request.on('data', chunk => {
                            body += chunk;
                        });
                        request.on('end', () => {
                            payload = JSON.parse(body);
                            const content = JSON.stringify([{ subject, body: '', footer: '' }]);
                            response.writeHead(200, {
                                'Content-Type': stream ? 'application/x-ndjson' : 'application/json',
                            });
                            response.end(
                                `${JSON.stringify({
                                    model: 'test-model',
                                    message: { role: 'assistant', content },
                                    done: true,
                                })}\n`
                            );
                        });
                    });
                    const { fixture, aicommit2 } = await createFixture({ 'example.js': 'export const example = () => 1;\n' });

                    try {
                        await new Promise<void>((resolve, reject) => {
                            server.once('error', reject);
                            server.listen(0, '127.0.0.1', resolve);
                        });
                        const address = server.address();
                        if (!address || typeof address === 'string') {
                            throw new Error('Mock Ollama server did not receive a TCP address');
                        }

                        const git = await createGit(fixture.path);
                        await git('add', ['example.js']);
                        await aicommit2([
                            'config',
                            'set',
                            'OLLAMA.model=test-model',
                            `OLLAMA.host=http://127.0.0.1:${address.port}`,
                            `OLLAMA.stream=${stream}`,
                            'OLLAMA.generate=1',
                            ...(think === undefined ? [] : [`OLLAMA.think=${think}`]),
                        ]);

                        const { stdout } = await aicommit2(['--dry-run', '--auto-select'], { timeout: 30_000 });
                        expect(stdout).toContain(subject);
                        expect(payload).toBeDefined();
                        expect(payload?.stream).toBe(stream);
                        if (think === undefined) {
                            expect(payload).not.toHaveProperty('think');
                        } else {
                            expect(payload?.think).toBe(think);
                        }
                    } finally {
                        server.closeAllConnections();
                        await new Promise<void>(resolve => server.close(() => resolve()));
                        await fixture.rm();
                    }
                });
            }
        }
    });
});
