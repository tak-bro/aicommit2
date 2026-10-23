import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { MOCK_MESSAGE, MOCK_REVIEW_SUMMARY, withMockProviders } from './mock-provider.js';

export default testSuite(({ describe }) => {
    describe('core loop', async ({ test }) => {
        // `-a` means `git commit -a`: tracked changes only. It staged untracked files as a side
        // effect of the YADM support change, which could sweep a stray `.env` into a commit.
        test('--all stages tracked changes and leaves untracked files alone', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { stderr, exitCode } = await aicommit2(['--all', '--auto-select'], options);

                expect(exitCode).toBe(0);
                const { stdout: status } = await git('status', ['--short']);
                expect(status).toMatch('?? data2.json');
                const { stdout: committed } = await git('show', ['--name-only', '--format=', 'HEAD']);
                expect(committed.trim()).toBe('data.json');
                expect(stderr).toMatch('untracked file');
            });
        });

        // `git add --update` without a pathspec is repo-wide, so running from a subdirectory
        // still picks up tracked changes elsewhere in the tree
        test('--all from a subdirectory stages tracked changes repo-wide', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fs.mkdir(`${fixture.path}/sub`);
                await fixture.writeFile('sub/keep.txt', 'x');
                await git('add', ['sub/keep.txt']);
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { stderr, exitCode } = await aicommit2(['--all', '--auto-select'], { ...options, cwd: `${fixture.path}/sub` });

                expect(exitCode).toBe(0);
                // cwd-relative like `git status`, so the path pastes straight into `git add`
                expect(stderr).toMatch(/^ {2}\.\.\/data2\.json$/m);
                const { stdout: committed } = await git('show', ['--name-only', '--format=', 'HEAD']);
                expect(committed.trim()).toBe('data.json');
            });
        });

        test('--all prints no untracked hint when there is nothing untracked', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fixture.writeFile('.gitignore', '.aicommit2\ndata2.json\nLibrary/\n.config/\n');
                await git('add', ['.gitignore']);
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { stderr, exitCode } = await aicommit2(['--all', '--auto-select'], options);

                expect(exitCode).toBe(0);
                expect(stderr).not.toMatch('not staged');
            });
        });

        // A bare count read as "-a dropped my files" (#278): name what was left out and how to add it
        test('--all lists untracked file names with a staging hint', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { stderr } = await aicommit2(['--all', '--auto-select'], options);

                expect(stderr).toMatch(/^ {2}data2\.json$/m);
                expect(stderr).toMatch('git add <path>');
                expect(stderr).not.toMatch('git add -A');
            });
        });

        describe('untracked notice shape', ({ test }) => {
            // Hide the fixture's own untracked files so each test controls the full list
            const ignoreFixtureNoise = '.aicommit2\ndata2.json\nLibrary/\n.config/\n';
            const runWithUntracked = async (files: Record<string, string>) => {
                let stderr = '';
                await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                    await fixture.writeFile('.gitignore', ignoreFixtureNoise);
                    await git('add', ['.gitignore']);
                    await git('commit', ['-m', 'chore: initial']);
                    for (const [name, content] of Object.entries(files)) {
                        await fs.mkdir(path.dirname(`${fixture.path}/${name}`), { recursive: true });
                        await fixture.writeFile(name, content);
                    }
                    await fixture.writeFile('data.json', '{"a":2}');
                    ({ stderr } = await aicommit2(['--all', '--auto-select'], options));
                });
                return stderr;
            };
            const numbered = (count: number) => Object.fromEntries(Array.from({ length: count }, (_, i) => [`u${i + 1}.txt`, 'x']));

            test('caps the list at 5 names and counts the rest', async () => {
                const stderr = await runWithUntracked(numbered(6));

                expect(stderr).toMatch('6 untracked files not staged');
                for (const name of ['u1.txt', 'u2.txt', 'u3.txt', 'u4.txt', 'u5.txt']) {
                    expect(stderr).toMatch(`  ${name}\n`);
                }
                expect(stderr).not.toMatch('u6.txt');
                expect(stderr).toMatch('… and 1 more');
            });

            test('prints every name with no remainder line at exactly 5', async () => {
                const stderr = await runWithUntracked(numbered(5));

                expect(stderr).toMatch('  u5.txt\n');
                expect(stderr).not.toMatch('… and');
            });

            test('collapses a wholly untracked directory into one singular entry', async () => {
                const stderr = await runWithUntracked({ 'newdir/a.txt': 'x', 'newdir/b.txt': 'x' });

                expect(stderr).toMatch('1 untracked file not staged');
                expect(stderr).toMatch(/^ {2}newdir\/$/m);
                expect(stderr).not.toMatch('newdir/a.txt');
            });

            // git C-quotes control characters without -z, so a name cannot smuggle terminal escapes
            test('prints a name with a control character git-quoted', async () => {
                const stderr = await runWithUntracked({ 'tab\there.txt': 'x' });

                expect(stderr).toMatch('  "tab\\there.txt"\n');
                expect(stderr).not.toMatch('tab\there');
            });
        });

        test('--all --output json keeps the untracked notice off stdout', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { stdout, stderr, exitCode } = await aicommit2(['--all', '--output', 'json'], options);

                expect(exitCode).toBe(0);
                expect(stderr).toMatch('data2.json');
                const lines = stdout.split('\n').filter(Boolean);
                expect(lines.length).toBeGreaterThan(0);
                for (const line of lines) {
                    expect(() => JSON.parse(line)).not.toThrow();
                }
            });
        });

        test('--all with only untracked files does not suggest --all again', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await git('commit', ['-m', 'chore: initial']);

                const { stdout, stderr, exitCode } = await aicommit2(['--all'], options);

                expect(exitCode).toBe(1);
                expect(stdout).toMatch('No staged changes found');
                expect(stderr).toMatch('data2.json');
                expect(`${stdout}${stderr}`).not.toMatch('aicommit2 --all');
            });
        });
        // Declining is not success: `aicommit2 && git push` must stop when nothing was committed
        test('declining the confirmation exits 1 without committing', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);

                const running = aicommit2([], options);
                let picked = false;
                let declined = false;
                running.stdout!.on('data', (buffer: Buffer) => {
                    const stdout = buffer.toString();
                    if (!picked && stdout.includes(MOCK_MESSAGE)) {
                        picked = true;
                        running.stdin!.write('\r');
                    }
                    if (!declined && stdout.includes('Use selected message?')) {
                        declined = true;
                        running.stdin!.write('n\n');
                        running.stdin!.end();
                    }
                });

                const { exitCode } = await running;

                expect(declined).toBe(true);
                expect(exitCode).toBe(1);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe('chore: initial');
            });
        });

        // Sent from outside. A real Ctrl-C at the prompt goes through inquirer (baseUI.js), which
        // re-raises SIGINT on the process and ends in the same handler; a raw-mode TTY is not
        // drivable here.
        test('SIGINT exits 130', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);

                const running = aicommit2([], options);
                running.stdout!.on('data', (buffer: Buffer) => {
                    if (buffer.toString().includes(MOCK_MESSAGE)) {
                        running.kill('SIGINT');
                    }
                });

                const { exitCode } = await running;
                expect(exitCode).toBe(130);
            });
        });
        test('SIGTERM exits 143', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);

                const running = aicommit2([], options);
                running.stdout!.on('data', (buffer: Buffer) => {
                    if (buffer.toString().includes(MOCK_MESSAGE)) {
                        running.kill('SIGTERM');
                    }
                });

                const { exitCode } = await running;
                expect(exitCode).toBe(143);
            });
        });

        // Watch mode's own handler runs first, so Ctrl-C there stays a normal stop
        test('SIGINT in watch mode exits 0', async () => {
            await withMockProviders(
                true,
                async ({ aicommit2, options, git }) => {
                    await git('commit', ['-m', 'chore: initial']);

                    const running = aicommit2(['--watch-commit'], options);
                    let signalled = false;
                    const onOutput = (buffer: Buffer) => {
                        if (!signalled && buffer.toString().includes('Watching for new Git commits')) {
                            signalled = true;
                            running.kill('SIGINT');
                        }
                    };
                    running.stdout!.on('data', onOutput);
                    running.stderr!.on('data', onOutput);

                    const { exitCode } = await running;
                    expect(signalled).toBe(true);
                    expect(exitCode).toBe(0);
                },
                { generalConfig: 'watchMode=true\n' }
            );
        });

        test('declining the code review prompt exits 1 without committing', async () => {
            await withMockProviders(
                true,
                async ({ aicommit2, options, git }) => {
                    await git('commit', ['-m', 'chore: initial']);
                    await git('add', ['data2.json']);

                    const running = aicommit2([], options);
                    let picked = false;
                    let declined = false;
                    running.stdout!.on('data', (buffer: Buffer) => {
                        const stdout = buffer.toString();
                        if (!picked && stdout.includes(MOCK_REVIEW_SUMMARY)) {
                            picked = true;
                            running.stdin!.write('\r');
                        }
                        if (!declined && stdout.includes('Will you continue without changing the code?')) {
                            declined = true;
                            running.stdin!.write('n\n');
                            running.stdin!.end();
                        }
                    });

                    const { exitCode } = await running;

                    expect(declined).toBe(true);
                    expect(exitCode).toBe(1);
                    const { stdout: log } = await git('log', ['--format=%s']);
                    expect(log).toBe('chore: initial');
                },
                { generalConfig: 'codeReview=true\n' }
            );
        });
        // `msg=$(aicommit2 -d)`: stdout is captured, so nobody can drive the picker and the
        // captured text must be the message alone
        test('--dry-run with piped stdout prints only the message, without prompting', async () => {
            await withMockProviders(true, async ({ aicommit2, options }) => {
                const { stdout, stderr, exitCode } = await aicommit2(['--dry-run'], options);

                expect(exitCode).toBe(0);
                expect(stdout).toBe(MOCK_MESSAGE);
                expect(stderr).toMatch('data.json');
            });
        });

        test('rewrite --dry-run with piped stdout prints only the message, without prompting', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await git('commit', ['-m', 'chore: second']);

                const { stdout, exitCode } = await aicommit2(['rewrite', '--dry-run'], options);

                expect(exitCode).toBe(0);
                expect(stdout).toBe(MOCK_MESSAGE);
            });
        });
        test('marks lockfile/generated files as diff omitted in the staged preview', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fixture.writeFile('bundle.min.js', 'var a=1;');
                await git('add', ['bundle.min.js']);

                const { stderr, exitCode } = await aicommit2(['--dry-run'], options);

                expect(exitCode).toBe(0);
                expect(stderr).toMatch('bundle.min.js (diff omitted)');
                expect(stderr).not.toMatch('data.json (diff omitted)');
            });
        });

        test('--include-generated sends generated diffs', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fixture.writeFile('bundle.min.js', 'var a=1;');
                await git('add', ['bundle.min.js']);

                const { stderr, exitCode } = await aicommit2(['--dry-run', '--include-generated'], options);

                expect(exitCode).toBe(0);
                expect(stderr).toMatch('bundle.min.js');
                expect(stderr).not.toMatch('(diff omitted)');
            });
        });

        // The picker marks subjects past 72 chars; scripts reading -d or json stdout must never see it
        describe('over-length subject marker stays out of stdout', ({ test }) => {
            const longSubject = `feat: ${'a'.repeat(74)}`;

            test('piped -d prints the subject only', async () => {
                await withMockProviders(
                    true,
                    async ({ aicommit2, options }) => {
                        const { stdout, exitCode } = await aicommit2(['--dry-run'], options);

                        expect(exitCode).toBe(0);
                        expect(stdout).toBe(longSubject);
                    },
                    { commitSubject: longSubject }
                );
            });

            test('--output json subjects carry no marker', async () => {
                await withMockProviders(
                    true,
                    async ({ aicommit2, options }) => {
                        const { stdout, exitCode } = await aicommit2(['--output', 'json'], options);

                        expect(exitCode).toBe(0);
                        const subjects = stdout.split('\n').map(line => JSON.parse(line).subject);
                        expect(subjects).toEqual([longSubject, longSubject]);
                    },
                    { commitSubject: longSubject }
                );
            });
        });
    });
});
