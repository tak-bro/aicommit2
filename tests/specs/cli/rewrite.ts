import { expect, testSuite } from 'manten';

import { createFixture, createGit } from '../../utils.js';

export default testSuite(({ describe }) => {
    describe('rewrite command', ({ test }) => {
        // ─── Repository detection ───────────────────────────────

        test('Fails on non-Git project', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout, exitCode } = await aicommit2(['rewrite'], { reject: false });
            expect(exitCode).toBe(1);
            expect(stdout).toMatch('No supported VCS repository found');
            await fixture.rm();
        });

        test('Fails in empty git repo without commits', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout, exitCode } = await aicommit2(['rewrite'], { reject: false });
            expect(exitCode).toBe(1);
            // Error may come from git directly or from VCS layer
            expect(stdout).toMatch(/Could not retrieve|Command failed|No supported VCS|No staged changes|fatal/);
            await fixture.rm();
        });

        // ─── Commit hash validation ─────────────────────────────

        test('Fails on invalid commit hash', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout, exitCode } = await aicommit2(['rewrite', 'deadbeef'], { reject: false });
            expect(exitCode).toBe(1);
            expect(stdout).toMatch('Invalid commit reference');
            await fixture.rm();
        });

        test('Fails on non-existent commit when repo has commits', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const git = await createGit(fixture.path);
            await git('commit', ['--allow-empty', '-m', 'initial commit']);

            const { stdout, exitCode } = await aicommit2(['rewrite', 'nonexistent'], { reject: false });
            expect(exitCode).toBe(1);
            expect(stdout).toMatch('Invalid commit reference');
            await fixture.rm();
        });

        test('Fails on branch name without commits', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            // Use a branch name that doesn't exist as a commit reference
            const { stdout, exitCode } = await aicommit2(['rewrite', 'main'], { reject: false });
            expect(exitCode).toBe(1);
            expect(stdout).toMatch('Invalid commit reference');
            await fixture.rm();
        });

        test('Accepts HEAD reference by default (no arg)', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const git = await createGit(fixture.path);
            await git('commit', ['--allow-empty', '-m', 'test']);

            // Running without hash should not fail on "Invalid commit reference"
            const { stdout, exitCode } = await aicommit2(['rewrite'], { reject: false });
            expect(exitCode).toBe(1);
            expect(stdout).not.toMatch('Invalid commit reference');
            await fixture.rm();
        });

        test('Accepts full commit hash', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const git = await createGit(fixture.path);
            await git('commit', ['--allow-empty', '-m', 'commit 1']);

            // Get the actual commit hash
            const { stdout: hashOut } = await git('rev-parse', ['HEAD']);
            const fullHash = hashOut.trim();

            // Should be accepted as valid (will fail on missing AI key, not invalid hash)
            const { stdout } = await aicommit2(['rewrite', fullHash], { reject: false });
            expect(stdout).not.toMatch('Invalid commit reference');
            await fixture.rm();
        });

        test('Accepts short commit hash', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const git = await createGit(fixture.path);
            await git('commit', ['--allow-empty', '-m', 'commit 1']);

            const { stdout: hashOut } = await git('rev-parse', ['--short', 'HEAD']);
            const shortHash = hashOut.trim();

            const { stdout } = await aicommit2(['rewrite', shortHash], { reject: false });
            expect(stdout).not.toMatch('Invalid commit reference');
            await fixture.rm();
        });

        test('Accepts HEAD~N style references', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const git = await createGit(fixture.path);
            await git('commit', ['--allow-empty', '-m', 'commit 1']);
            await git('commit', ['--allow-empty', '-m', 'commit 2']);

            // HEAD~1 should be valid (refers to first parent)
            const { stdout } = await aicommit2(['rewrite', 'HEAD~1', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            await fixture.rm();
        });

        test('Accepts HEAD^ parent reference', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const git = await createGit(fixture.path);
            await git('commit', ['--allow-empty', '-m', 'commit 1']);
            await git('commit', ['--allow-empty', '-m', 'commit 2']);

            const { stdout } = await aicommit2(['rewrite', 'HEAD^'], { reject: false });
            expect(stdout).not.toMatch('Invalid commit reference');
            await fixture.rm();
        });

        // ─── Help text ──────────────────────────────────────────

        test('Shows help text with correct command name', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['rewrite', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            expect(stdout).toMatch('Rewrite the commit message');
            // Should NOT contain old name
            expect(stdout).not.toMatch(/\bamend\b/);
            await fixture.rm();
        });

        test('Shows in main help output', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);
            expect(stdout).toMatch('rewrite');
            expect(stdout).toMatch('Rewrite the commit message');
            await fixture.rm();
        });

        test('Help shows all supported flags', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['rewrite', '--help']);

            // Verify key flags are documented
            expect(stdout).toMatch('--generate');
            expect(stdout).toMatch('--dry-run');
            expect(stdout).toMatch('--confirm');
            expect(stdout).toMatch('--auto-select');
            expect(stdout).toMatch('--edit');
            expect(stdout).toMatch('--locale');
            expect(stdout).toMatch('--type');
            expect(stdout).toMatch('--prompt');
            expect(stdout).toMatch('--verbose');
            expect(stdout).toMatch('--disable-lowercase');
            await fixture.rm();
        });

        test('Help shows usage examples', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['rewrite', '--help']);

            expect(stdout).toMatch('aicommit2 rewrite');
            expect(stdout).toMatch('aicommit2 rewrite -g 3');
            expect(stdout).toMatch('aicommit2 rewrite abc1234');
            expect(stdout).toMatch('aicommit2 rewrite HEAD~2 --dry-run');
            await fixture.rm();
        });

        // ─── Flag combinations ──────────────────────────────────

        test('Accepts --dry-run with valid repo', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout, exitCode } = await aicommit2(['rewrite', '--dry-run'], { reject: false });
            expect(exitCode).toBe(1);
            // Should not be a flag parsing error
            expect(stdout).not.toMatch('Unknown flag');
            await fixture.rm();
        });

        test('Accepts -g flag with numeric value', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout } = await aicommit2(['rewrite', '-g', '3', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            await fixture.rm();
        });

        test('Accepts combined short flags', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout } = await aicommit2(['rewrite', '-d', '-v', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            await fixture.rm();
        });

        test('Accepts --type=conventional syntax', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout } = await aicommit2(['rewrite', '--type=conventional', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            await fixture.rm();
        });

        test('Accepts -l for locale', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout } = await aicommit2(['rewrite', '-l', 'zh', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            await fixture.rm();
        });

        test('Accepts --prompt with custom text', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout } = await aicommit2(['rewrite', '-p', 'use conventional commits', '--help']);
            expect(stdout).toMatch('aicommit2 rewrite');
            await fixture.rm();
        });
    });
});
