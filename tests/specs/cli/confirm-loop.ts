import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { MOCK_MESSAGE, MOCK_REVIEW_SUMMARY, withMockProviders } from './mock-provider.js';

import type { ExecaChildProcess } from 'execa';

interface Step {
    when: string;
    send: string;
}

/**
 * Answers prompts in order: each step waits for its text to appear after the previous step's
 * match, so a picker that shows the same message twice is answered once per round.
 */
const answerInOrder = (running: ExecaChildProcess, steps: Step[], { endStdin = true } = {}) => {
    let output = '';
    let cursor = 0;
    let answered = 0;
    running.stdout!.on('data', (buffer: Buffer) => {
        output += buffer.toString();
        while (answered < steps.length) {
            const at = output.indexOf(steps[answered].when, cursor);
            if (at < 0) {
                break;
            }
            cursor = at + steps[answered].when.length;
            running.stdin!.write(steps[answered].send);
            answered += 1;
        }
        if (answered === steps.length && endStdin) {
            running.stdin!.end();
        }
    });
    return () => answered;
};

const CONFIRM = 'Use selected message?';
const RETRY = 'Commit failed. Retry?';

// Fails the first commit attempt only, like a lint hook that passes once the file is fixed
const failFirstPreCommit = async (repoPath: string) => {
    const hookPath = path.join(repoPath, '.git/hooks/pre-commit');
    const marker = path.join(repoPath, '.git/hook-ran');
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, `#!/bin/sh\nif [ ! -f '${marker}' ]; then touch '${marker}'; echo HOOK_FAILED >&2; exit 1; fi\n`);
    await fs.chmod(hookPath, 0o755);
};

const failEveryPreCommit = async (repoPath: string) => {
    const hookPath = path.join(repoPath, '.git/hooks/pre-commit');
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, '#!/bin/sh\necho HOOK_FAILED >&2\nexit 1\n');
    await fs.chmod(hookPath, 0o755);
};

const savedMessage = (repoPath: string) => fs.readFile(path.join(repoPath, '.git/AICOMMIT2_MSG'), 'utf8').catch(() => null);

// The root commit has no parent diff, so rewrite needs a second commit
const commitTwice = async (git: (command: string, args: string[]) => Promise<unknown>) => {
    await git('commit', ['-m', 'chore: initial']);
    await git('add', ['data2.json']);
    await git('commit', ['-m', 'chore: second']);
};

// A bare sibling repo as origin, with HEAD pushed, so rewrite shows its already-pushed warning
const pushToBareRemote = async (git: (command: string, args: string[]) => Promise<unknown>, repoPath: string) => {
    const remote = path.join(repoPath, 'remote.git');
    await git('init', ['--bare', '-q', remote]);
    await git('remote', ['add', 'origin', remote]);
    await git('push', ['-q', 'origin', 'HEAD']);
};

const CLOSED = 'Input closed before the prompt was answered';
const countClosedLines = (stderr: string) => stderr.split(CLOSED).length - 1;

// Stands in for $EDITOR: overwrites the message file and counts how often it ran
const writeEditorScript = async (dir: string, message: string) => {
    const script = path.join(dir, 'editor.sh');
    const counter = path.join(dir, 'editor-runs');
    await fs.writeFile(script, `#!/bin/sh\necho run >> '${counter}'\nprintf '%s' '${message}' > "$1"\n`);
    await fs.chmod(script, 0o755);
    const runs = async () => (await fs.readFile(counter, 'utf8').catch(() => '')).split('\n').filter(Boolean).length;
    return { script, runs };
};

export default testSuite(({ describe }) => {
    describe('confirm loop', async ({ test }) => {
        test('r regenerates with a fresh picker, without a second code review', async () => {
            await withMockProviders(
                true,
                async ({ aicommit2, options, git, requests }) => {
                    await git('commit', ['-m', 'chore: initial']);
                    await git('add', ['data2.json']);

                    const running = aicommit2([], options);
                    const answered = answerInOrder(running, [
                        { when: MOCK_REVIEW_SUMMARY, send: '\r' },
                        { when: 'Will you continue without changing the code?', send: 'y\n' },
                        { when: MOCK_MESSAGE, send: '\r' },
                        { when: CONFIRM, send: 'r\n' },
                        { when: MOCK_MESSAGE, send: '\r' },
                        { when: CONFIRM, send: '\r' },
                    ]);

                    const { exitCode } = await running;

                    expect(answered()).toBe(6);
                    expect(exitCode).toBe(0);
                    // Two providers, two rounds of commit messages, one round of reviews
                    expect(requests.commit).toBe(4);
                    expect(requests.review).toBe(2);
                    const { stdout: log } = await git('log', ['--format=%s']);
                    expect(log).toBe(`${MOCK_MESSAGE}\nchore: initial`);
                },
                { generalConfig: 'codeReview=true\n' }
            );
        });

        test('e opens the editor and commits the edited message', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture, requests }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                const editor = await writeEditorScript(fixture.path, 'feat: edited by hand');

                const running = aicommit2([], { ...options, env: { ...options.env, EDITOR: editor.script } });
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'e\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(2);
                expect(exitCode).toBe(0);
                expect(await editor.runs()).toBe(1);
                expect(requests.commit).toBe(2);
                const { stdout: log } = await git('log', ['-1', '--format=%s']);
                expect(log).toBe('feat: edited by hand');
            });
        });

        test('e with an emptied message exits 1 without committing', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                const editor = await writeEditorScript(fixture.path, '');

                const running = aicommit2([], { ...options, env: { ...options.env, EDITOR: editor.script } });
                answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'e\n' },
                ]);

                const { exitCode } = await running;

                expect(exitCode).toBe(1);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: initial');
            });
        });

        // `-e` edits each pick; r must reopen the editor on the new pick, once per round
        test('with -e, r reopens the editor on the new pick', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                const editor = await writeEditorScript(fixture.path, 'feat: edited on every round');

                const running = aicommit2(['--edit'], { ...options, env: { ...options.env, EDITOR: editor.script } });
                answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'r\n' },
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: '\r' },
                ]);

                const { exitCode } = await running;

                expect(exitCode).toBe(0);
                expect(await editor.runs()).toBe(2);
                const { stdout: log } = await git('log', ['-1', '--format=%s']);
                expect(log).toBe('feat: edited on every round');
            });
        });

        // Each round must tear down its picker; a leaked readline or signal listener shows up
        // as Node's MaxListenersExceededWarning once more than 10 pile up on one emitter
        test('many regenerate rounds leak no listeners', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, requests }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                const rounds = 11;
                const regenerateSteps = Array.from({ length: rounds }, () => [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'r\n' },
                ]).flat();

                const running = aicommit2([], options);
                answerInOrder(running, [...regenerateSteps, { when: MOCK_MESSAGE, send: '\r' }, { when: CONFIRM, send: 'n\n' }]);

                const { stderr, exitCode } = await running;

                expect(exitCode).toBe(1);
                expect(requests.commit).toBe(2 * (rounds + 1));
                expect(stderr).not.toMatch('MaxListenersExceededWarning');
            });
        });

        test('the prompt lists the keys', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);

                const running = aicommit2([], options);
                answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'n\n' },
                ]);

                const { stdout, exitCode } = await running;

                expect(exitCode).toBe(1);
                expect(stdout).toMatch(`${CONFIRM} (Ynerh)`);
            });
        });
    });

    describe('retry prompt after a failed commit', async ({ test }) => {
        // The user fixes what the hook complained about, then answers r: same message, no AI call
        test('r commits the same message again without a provider request', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture, requests }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failFirstPreCommit(fixture.path);

                const running = aicommit2([], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: '\r' },
                    { when: RETRY, send: 'r\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(3);
                expect(exitCode).toBe(0);
                expect(requests.commit).toBe(2);
                const { stdout: log } = await git('log', ['-1', '--format=%s']);
                expect(log).toBe(MOCK_MESSAGE);
                expect(await savedMessage(fixture.path)).toBe(null);
            });
        });

        test('q exits 1 and keeps the saved message', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);

                const running = aicommit2([], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: '\r' },
                    { when: RETRY, send: 'q\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(3);
                expect(exitCode).toBe(1);
                expect(await savedMessage(fixture.path)).toBe(MOCK_MESSAGE);
            });
        });

        // A hook that still fails after r must ask again, not exit or commit
        test('r while the hook still fails asks again', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);

                const running = aicommit2([], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: '\r' },
                    { when: RETRY, send: 'r\n' },
                    { when: RETRY, send: 'q\n' },
                ]);

                const { stderr, exitCode } = await running;

                expect(answered()).toBe(4);
                expect(exitCode).toBe(1);
                expect(stderr.split('HOOK_FAILED').length - 1).toBe(2);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: initial');
            });
        });

        // Nothing on disk means quitting loses the message; the label must not claim otherwise
        test('when the save fails, the quit option says the message is not saved', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);
                await fs.mkdir(path.join(fixture.path, '.git/AICOMMIT2_MSG'));

                const running = aicommit2([], options);
                answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: '\r' },
                    { when: RETRY, send: 'h\n' },
                    { when: 'not saved', send: 'q\n' },
                ]);

                const { stdout, exitCode } = await running;

                expect(exitCode).toBe(1);
                expect(stdout).toMatch('Quit (the message is not saved)');
                expect(stdout).not.toMatch('the message stays saved');
            });
        });

        // `e` commits through the same path, so its failure gets the same prompt
        test('a commit after e also offers the retry prompt', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);
                const editor = await writeEditorScript(fixture.path, 'feat: edited then failed');

                const running = aicommit2([], { ...options, env: { ...options.env, EDITOR: editor.script } });
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'e\n' },
                    { when: RETRY, send: 'q\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(3);
                expect(exitCode).toBe(1);
                expect(await savedMessage(fixture.path)).toBe('feat: edited then failed');
            });
        });

        // The message is written before the prompt appears, so Ctrl-C there loses nothing
        test('Ctrl-C at the retry prompt exits 130 with the message saved', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);

                const running = aicommit2([], options);
                // stdin stays open: closing it would end the prompt before the signal lands
                answerInOrder(
                    running,
                    [
                        { when: MOCK_MESSAGE, send: '\r' },
                        { when: CONFIRM, send: '\r' },
                    ],
                    { endStdin: false }
                );
                let interrupted = false;
                running.stdout!.on('data', (buffer: Buffer) => {
                    if (!interrupted && buffer.toString().includes(RETRY)) {
                        interrupted = true;
                        running.kill('SIGINT');
                    }
                });

                const { exitCode } = await running;

                expect(interrupted).toBe(true);
                expect(exitCode).toBe(130);
                expect(await savedMessage(fixture.path)).toBe(MOCK_MESSAGE);
            });
        });

        // With stdin gone the prompt can never be answered and Node drains out on its own
        test('stdin closing at the retry prompt exits 1, not 0', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);

                const running = aicommit2([], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: '\r' },
                    { when: RETRY, send: '' },
                ]);

                const { stderr, exitCode } = await running;

                expect(answered()).toBe(3);
                expect(exitCode).toBe(1);
                expect(countClosedLines(stderr)).toBe(1);
                expect(await savedMessage(fixture.path)).toBe(MOCK_MESSAGE);
            });
        });

        // -y has nobody to ask: fail, save, exit 1
        test('--confirm fails without a retry prompt', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await failEveryPreCommit(fixture.path);

                const running = aicommit2(['--confirm'], options);
                answerInOrder(running, [{ when: MOCK_MESSAGE, send: '\r' }]);

                const { stdout, exitCode } = await running;

                expect(exitCode).toBe(1);
                expect(stdout).not.toMatch(RETRY);
                expect(await savedMessage(fixture.path)).toBe(MOCK_MESSAGE);
            });
        });
    });

    describe('rewrite editor', async ({ test }) => {
        test('rewrite -e rewrites HEAD with the edited message', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await commitTwice(git);
                const editor = await writeEditorScript(fixture.path, 'feat: rewritten by hand');

                const { exitCode } = await aicommit2(['rewrite', '--auto-select', '--edit'], {
                    ...options,
                    env: { ...options.env, EDITOR: editor.script },
                });

                expect(exitCode).toBe(0);
                expect(await editor.runs()).toBe(1);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('feat: rewritten by hand\nchore: initial');
            });
        });

        // Quitting the editor with an error (vim `:cq`) is a cancel, not a failure to start it
        test('rewrite -e with an editor that exits non-zero reports a cancel', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await commitTwice(git);
                const script = path.join(fixture.path, 'quit-editor.sh');
                await fs.writeFile(script, '#!/bin/sh\nexit 1\n');
                await fs.chmod(script, 0o755);

                const { stdout, stderr, exitCode } = await aicommit2(['rewrite', '--auto-select', '--edit'], {
                    ...options,
                    env: { ...options.env, EDITOR: script },
                });

                expect(exitCode).toBe(1);
                expect(`${stdout}${stderr}`).toMatch('Rewrite cancelled');
                expect(`${stdout}${stderr}`).not.toMatch('Failed to open editor');
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: second\nchore: initial');
            });
        });

        // A killed editor (closed terminal, SIGTERM) ran, so it is a cancel too
        test('rewrite -e with an editor killed by a signal reports a cancel', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await commitTwice(git);
                const script = path.join(fixture.path, 'killed-editor.sh');
                await fs.writeFile(script, '#!/bin/sh\nkill -TERM $$\n');
                await fs.chmod(script, 0o755);

                const { stdout, stderr, exitCode } = await aicommit2(['rewrite', '--auto-select', '--edit'], {
                    ...options,
                    env: { ...options.env, EDITOR: script },
                });

                expect(exitCode).toBe(1);
                expect(`${stdout}${stderr}`).toMatch('Rewrite cancelled');
                expect(`${stdout}${stderr}`).not.toMatch('Failed to open editor');
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: second\nchore: initial');
            });
        });

        test('rewrite -e with an editor that cannot start exits 1 and leaves HEAD', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await commitTwice(git);

                const { stdout, stderr, exitCode } = await aicommit2(['rewrite', '--auto-select', '--edit'], {
                    ...options,
                    env: { ...options.env, EDITOR: 'aicommit2-no-such-editor' },
                });

                expect(exitCode).toBe(1);
                expect(`${stdout}${stderr}`).toMatch('Failed to open editor');
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: second\nchore: initial');
            });
        });
    });

    describe('rewrite confirm', async ({ test }) => {
        test('y rewrites HEAD with the picked message and exits 0', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await commitTwice(git);

                const running = aicommit2(['rewrite'], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'y\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(2);
                expect(exitCode).toBe(0);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(`${MOCK_MESSAGE}\nchore: initial`);
            });
        });

        // Nothing was rewritten, so `aicommit2 rewrite && git push -f` must stop
        test('n exits 1 and leaves HEAD unchanged', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await commitTwice(git);

                const running = aicommit2(['rewrite'], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'n\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(2);
                expect(exitCode).toBe(1);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: second\nchore: initial');
            });
        });

        test('e rewrites HEAD with the edited message', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await commitTwice(git);
                const editor = await writeEditorScript(fixture.path, 'fix: edited in rewrite');

                const running = aicommit2(['rewrite'], { ...options, env: { ...options.env, EDITOR: editor.script } });
                answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'e\n' },
                ]);

                const { exitCode } = await running;

                expect(exitCode).toBe(0);
                expect(await editor.runs()).toBe(1);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('fix: edited in rewrite\nchore: initial');
            });
        });

        test('r asks the providers again, then y rewrites with the new pick', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, requests }) => {
                await commitTwice(git);

                const running = aicommit2(['rewrite'], options);
                const answered = answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'r\n' },
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'y\n' },
                ]);

                const { exitCode } = await running;

                expect(answered()).toBe(4);
                expect(exitCode).toBe(0);
                // Two providers, two rounds
                expect(requests.commit).toBe(4);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(`${MOCK_MESSAGE}\nchore: initial`);
            });
        });

        // -y means "no confirm prompt": pick, then rewrite
        test('-y rewrites after the pick without the confirm prompt', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await commitTwice(git);

                const running = aicommit2(['rewrite', '--confirm'], options);
                answerInOrder(running, [{ when: MOCK_MESSAGE, send: '\r' }]);

                const { stdout, exitCode } = await running;

                expect(exitCode).toBe(0);
                expect(stdout).not.toMatch(CONFIRM);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(`${MOCK_MESSAGE}\nchore: initial`);
            });
        });

        test('h lists rewrite labels, not commit labels', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await commitTwice(git);

                const running = aicommit2(['rewrite'], options);
                answerInOrder(running, [
                    { when: MOCK_MESSAGE, send: '\r' },
                    { when: CONFIRM, send: 'h\n' },
                    { when: 'Answer', send: 'n\n' },
                ]);

                const { stdout } = await running;

                expect(stdout).toMatch('Yes, rewrite');
                expect(stdout).toMatch('Edit, then rewrite');
                expect(stdout).not.toMatch('Yes, commit');
            });
        });

        test('declining the already-pushed warning exits 1 and keeps the commit', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await commitTwice(git);
                await pushToBareRemote(git, fixture.path);
                const { stdout: before } = await git('rev-parse', ['HEAD']);

                const running = aicommit2(['rewrite', '--auto-select'], options);
                const answered = answerInOrder(running, [{ when: 'Continue with rewrite anyway?', send: 'n\n' }]);

                const { exitCode } = await running;

                expect(answered()).toBe(1);
                expect(exitCode).toBe(1);
                const { stdout: after } = await git('rev-parse', ['HEAD']);
                expect(after).toBe(before);
            });
        });
    });

    // Closed stdin leaves a prompt pending forever; Node then drains and exited 0 without
    // committing, so `aicommit2 < /dev/null && git push` read a no-op as success
    describe('closed input', async ({ test }) => {
        // Answers `steps`, then closes stdin once `closeAt` shows up
        const closeAt = (running: ExecaChildProcess, steps: Step[], closeAtText: string) =>
            answerInOrder(running, [...steps, { when: closeAtText, send: '' }]);

        const commitCases: { name: string; steps: Step[]; closeAtText: string; generalConfig?: string }[] = [
            { name: 'the message picker', steps: [], closeAtText: MOCK_MESSAGE },
            { name: 'the code review list', steps: [], closeAtText: MOCK_REVIEW_SUMMARY, generalConfig: 'codeReview=true\n' },
            {
                name: 'the review continue prompt',
                steps: [{ when: MOCK_REVIEW_SUMMARY, send: '\r' }],
                closeAtText: 'Will you continue without changing the code?',
                generalConfig: 'codeReview=true\n',
            },
            { name: 'the confirm prompt', steps: [{ when: MOCK_MESSAGE, send: '\r' }], closeAtText: CONFIRM },
        ];

        for (const { name, steps, closeAtText, generalConfig } of commitCases) {
            test(`at ${name}: exits 1 without committing`, async () => {
                await withMockProviders(
                    true,
                    async ({ aicommit2, options, git }) => {
                        await git('commit', ['-m', 'chore: initial']);
                        await git('add', ['data2.json']);

                        const running = aicommit2([], options);
                        const answered = closeAt(running, steps, closeAtText);

                        const { stderr, exitCode } = await running;

                        expect(answered()).toBe(steps.length + 1);
                        expect(exitCode).toBe(1);
                        expect(countClosedLines(stderr)).toBe(1);
                        const { stdout: log } = await git('log', ['--format=%s']);
                        expect(log).toBe('chore: initial');
                    },
                    { generalConfig }
                );
            });
        }

        // The last prompt before rewrite drains the loop on its own: a guard left behind here
        // would turn a finished rewrite into exit 1
        test('answering y at the already-pushed warning rewrites and exits 0', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await commitTwice(git);
                await pushToBareRemote(git, fixture.path);

                const running = aicommit2(['rewrite', '--auto-select'], options);
                const answered = answerInOrder(running, [{ when: 'Continue with rewrite anyway?', send: 'y\n' }]);

                const { stderr, exitCode } = await running;

                expect(answered()).toBe(1);
                expect(exitCode).toBe(0);
                expect(countClosedLines(stderr)).toBe(0);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(`${MOCK_MESSAGE}\nchore: initial`);
            });
        });

        const rewriteCases: { name: string; args: string[]; steps: Step[]; closeAtText: string; pushed?: boolean }[] = [
            { name: 'the rewrite picker', args: [], steps: [], closeAtText: MOCK_MESSAGE },
            { name: 'the rewrite confirm prompt', args: [], steps: [{ when: MOCK_MESSAGE, send: '\r' }], closeAtText: CONFIRM },
            {
                name: 'the already-pushed warning',
                args: ['--auto-select'],
                steps: [],
                closeAtText: 'Continue with rewrite anyway?',
                pushed: true,
            },
        ];

        for (const { name, args, steps, closeAtText, pushed } of rewriteCases) {
            test(`at ${name}: exits 1 and leaves HEAD`, async () => {
                await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                    await commitTwice(git);
                    if (pushed) {
                        await pushToBareRemote(git, fixture.path);
                    }
                    const { stdout: before } = await git('rev-parse', ['HEAD']);

                    const running = aicommit2(['rewrite', ...args], options);
                    const answered = closeAt(running, steps, closeAtText);

                    const { stderr, exitCode } = await running;

                    expect(answered()).toBe(steps.length + 1);
                    expect(exitCode).toBe(1);
                    expect(countClosedLines(stderr)).toBe(1);
                    const { stdout: after } = await git('rev-parse', ['HEAD']);
                    expect(after).toBe(before);
                });
            });
        }
    });
});
