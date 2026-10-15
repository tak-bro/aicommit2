import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { MOCK_MESSAGE, withMockProviders } from './mock-provider.js';
import { ErrorMessages } from '../../../src/utils/error-messages.js';
import { JujutsuAdapter } from '../../../src/utils/vcs-adapters/jujutsu.adapter.js';

import type { createFixture } from '../../utils.js';

type Fixture = Awaited<ReturnType<typeof createFixture>>['fixture'];

const failPreCommit = async (fixture: Fixture) => {
    const hookPath = path.join(fixture.path, '.git/hooks/pre-commit');
    await fs.mkdir(path.dirname(hookPath), { recursive: true });
    await fs.writeFile(hookPath, '#!/bin/sh\necho HOOK_FAILED >&2\nexit 1\n');
    await fs.chmod(hookPath, 0o755);
};

const removePreCommit = (fixture: Fixture) => fs.rm(path.join(fixture.path, '.git/hooks/pre-commit'));

const readSaved = (filePath: string) => fs.readFile(filePath, 'utf8').catch(() => null);

export default testSuite(({ describe }) => {
    describe('commit recovery per VCS', ({ test }) => {
        // jj describe runs no hooks, so there is no lost message and nothing to save
        test('Jujutsu keeps no saved message', async () => {
            expect(await new JujutsuAdapter().getMessageSavePath()).toBe(null);
        });

        // yadm's repo is outside the $HOME work tree, so a `git commit -F` hint would fail there
        test('the saved-message hint commits with the VCS that failed', () => {
            expect(ErrorMessages.commitFailedMessageSaved('/repo.git/AICOMMIT2_MSG', 'yadm')).toMatch(
                "yadm commit -F '/repo.git/AICOMMIT2_MSG' && rm '/repo.git/AICOMMIT2_MSG'"
            );
        });

        // An unquoted path splits on the space, so the pasted command fails
        test('the saved-message hint quotes paths with spaces and quotes', () => {
            expect(ErrorMessages.commitFailedMessageSaved("/my repo/it's/.git/AICOMMIT2_MSG", 'git')).toMatch(
                "git commit -F '/my repo/it'\\''s/.git/AICOMMIT2_MSG' && rm '/my repo/it'\\''s/.git/AICOMMIT2_MSG'"
            );
        });
    });

    describe('commit recovery', async ({ test }) => {
        // A failing pre-commit hook runs before git records the message, so without this the
        // generated message was gone and the only way back was another round of AI requests
        test('a failed commit keeps the message and prints a git commit -F hint', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture }) => {
                await failPreCommit(fixture);

                const { stdout, stderr, exitCode } = await aicommit2(['--auto-select'], options);

                expect(exitCode).toBe(1);
                expect(stderr).toMatch('HOOK_FAILED');
                const savedPath = path.join(fixture.path, '.git/AICOMMIT2_MSG');
                expect(await readSaved(savedPath)).toBe(MOCK_MESSAGE);
                // printError writes to stdout like every other aicommit2 error (stderr under piped -d)
                expect(stdout).toMatch(`git commit -F '${savedPath}'`);
            });
        });

        test('--retry commits the saved message without asking any provider', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture, git, requests }) => {
                await failPreCommit(fixture);
                await aicommit2(['--auto-select'], options);
                await removePreCommit(fixture);
                const commitRequestsBefore = requests.commit;

                const { stdout, exitCode } = await aicommit2(['--retry'], options);

                expect(exitCode).toBe(0);
                // Printed before git runs; git's own `[master <sha>] <subject>` line comes after
                const printedAt = stdout.indexOf(`\n${MOCK_MESSAGE}\n`);
                expect(printedAt).toBeGreaterThan(-1);
                expect(printedAt).toBeLessThan(stdout.indexOf('[master'));
                expect(requests.commit).toBe(commitRequestsBefore);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(MOCK_MESSAGE);
                expect(await readSaved(path.join(fixture.path, '.git/AICOMMIT2_MSG'))).toBe(null);
            });
        });

        test('--retry passes unknown args through to git commit', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture, git }) => {
                await failPreCommit(fixture);
                await aicommit2(['--auto-select'], options);

                // The hook still fails; only --no-verify reaching git lets this commit
                const { exitCode } = await aicommit2(['--retry', '--no-verify'], options);

                expect(exitCode).toBe(0);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(MOCK_MESSAGE);
            });
        });

        // "Nothing saved" would hide the real problem
        test('--retry reports an unreadable saved message instead of "nothing saved"', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture }) => {
                await fs.mkdir(path.join(fixture.path, '.git/AICOMMIT2_MSG'));

                const { stdout, stderr, exitCode } = await aicommit2(['--retry'], options);

                expect(exitCode).toBe(1);
                expect(`${stdout}${stderr}`).toMatch('EISDIR');
                expect(`${stdout}${stderr}`).not.toMatch('No saved commit message');
            });
        });

        // A retry needs no provider, so a config aicommit2 cannot load must not block it
        test('--retry works when the config file is invalid', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture, git }) => {
                await failPreCommit(fixture);
                await aicommit2(['--auto-select'], options);
                await removePreCommit(fixture);
                await fs.writeFile(path.join(fixture.path, '.aicommit2'), 'maxLength=abc\n');

                const { exitCode } = await aicommit2(['--retry'], options);

                expect(exitCode).toBe(0);
                const { stdout: log } = await git('log', ['--format=%s']);
                expect(log).toBe(MOCK_MESSAGE);
            });
        });

        // Ctrl-C during a slow hook exits from the SIGINT handler, so a save after the rejection never runs
        test('the message is saved before the commit runs its hooks', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture }) => {
                const hookPath = path.join(fixture.path, '.git/hooks/pre-commit');
                await fs.mkdir(path.dirname(hookPath), { recursive: true });
                await fs.writeFile(hookPath, '#!/bin/sh\ncat .git/AICOMMIT2_MSG >&2\nexit 1\n');
                await fs.chmod(hookPath, 0o755);

                const { stderr, exitCode } = await aicommit2(['--auto-select'], options);

                expect(exitCode).toBe(1);
                expect(stderr).toMatch(MOCK_MESSAGE);
            });
        });

        // --retry always commits; honouring it over -d would commit what the user asked only to see
        test('--retry refuses --dry-run and --clipboard', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture, git }) => {
                await failPreCommit(fixture);
                await aicommit2(['--auto-select'], options);
                await removePreCommit(fixture);

                for (const flag of ['-d', '--clipboard']) {
                    const { stdout, stderr, exitCode } = await aicommit2(['--retry', flag], options);

                    expect(exitCode).toBe(1);
                    expect(`${stdout}${stderr}`).toMatch('--retry cannot be combined');
                }
                const { stdout: log } = await git('log', ['--format=%s']).catch(() => ({ stdout: '' }));
                expect(log).not.toMatch(MOCK_MESSAGE);
            });
        });

        test('--retry with nothing saved exits 1', async () => {
            await withMockProviders(true, async ({ aicommit2, options }) => {
                const { stdout, stderr, exitCode } = await aicommit2(['--retry'], options);

                expect(exitCode).toBe(1);
                expect(`${stdout}${stderr}`).toMatch('No saved commit message');
            });
        });

        // Otherwise a later --retry would commit a message from an old, unrelated attempt
        test('a successful commit clears a stale saved message', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture }) => {
                await failPreCommit(fixture);
                await aicommit2(['--auto-select'], options);
                await removePreCommit(fixture);

                const { exitCode } = await aicommit2(['--auto-select'], options);

                expect(exitCode).toBe(0);
                expect(await readSaved(path.join(fixture.path, '.git/AICOMMIT2_MSG'))).toBe(null);
            });
        });

        // The commit failure is what the user must see; a failed save only adds a warning
        test('a save that fails still reports the commit failure', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture }) => {
                await failPreCommit(fixture);
                // A directory in the file's place makes the write fail
                await fs.mkdir(path.join(fixture.path, '.git/AICOMMIT2_MSG'));

                const { stdout, stderr, exitCode } = await aicommit2(['--auto-select'], options);

                expect(exitCode).toBe(1);
                expect(stderr).toMatch('Could not save the commit message');
                expect(`${stdout}${stderr}`).toMatch('Git commit failed');
                expect(`${stdout}${stderr}`).not.toMatch('aicommit2 --retry');
            });
        });

        // Otherwise "the message is not saved" would be false and --retry would commit the old message
        test('a save that fails removes a message saved by an earlier attempt', async () => {
            // root writes through a read-only mode, so the save would not fail
            if (process.getuid?.() === 0) {
                return;
            }
            await withMockProviders(true, async ({ aicommit2, options, fixture }) => {
                await failPreCommit(fixture);
                const savedPath = path.join(fixture.path, '.git/AICOMMIT2_MSG');
                await fs.writeFile(savedPath, 'fix: an older attempt');
                // A read-only file fails the write; removing it needs only the directory to be writable
                await fs.chmod(savedPath, 0o444);

                const { stderr, exitCode } = await aicommit2(['--auto-select'], options);

                expect(exitCode).toBe(1);
                expect(stderr).toMatch('Could not save the commit message');
                expect(await readSaved(savedPath)).toBe(null);
            });
        });

        // In a linked worktree `.git` is a file, so a hand-joined `.git/AICOMMIT2_MSG` breaks
        test('in a linked worktree the message is saved under that worktree gitdir', async () => {
            await withMockProviders(true, async ({ aicommit2, options, fixture, git }) => {
                await git('commit', ['-m', 'chore: initial']);
                await git('worktree', ['add', 'wt']);
                const worktreePath = path.join(fixture.path, 'wt');
                await fs.writeFile(path.join(worktreePath, 'data.json'), '{"a":2}');
                await git('-C', ['wt', 'add', 'data.json']);
                await failPreCommit(fixture);

                const { exitCode } = await aicommit2(['--auto-select'], { ...options, cwd: worktreePath });

                expect(exitCode).toBe(1);
                expect(await readSaved(path.join(fixture.path, '.git/worktrees/wt/AICOMMIT2_MSG'))).toBe(MOCK_MESSAGE);
            });
        });
    });
});
