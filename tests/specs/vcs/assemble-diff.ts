import path from 'path';

import { execa } from 'execa';
import { expect, testSuite } from 'manten';

import { assembleDiff } from '../../../src/utils/vcs-adapters/assemble-diff.js';
import { defaultJjExcludeFilesets } from '../../../src/utils/vcs-adapters/default-excludes.js';
import { GitAdapter } from '../../../src/utils/vcs-adapters/git.adapter.js';
import { createFixture, createGit } from '../../utils.js';

const OMITTED_HEADER = '--- Files Changed (diff omitted: lockfile/generated) ---';

export default testSuite(({ describe }) => {
    describe('assembleDiff', ({ test }) => {
        test('returns null when nothing changed', () => {
            expect(assembleDiff({ nameStatusZ: '', numstatZ: '', diff: '' })).toBe(null);
        });

        test('lists files missing from numstat as omitted, with their status', () => {
            const result = assembleDiff({
                nameStatusZ: 'M\0src/a.ts\0A\0pnpm-lock.yaml\0',
                numstatZ: '1\t0\tsrc/a.ts\0',
                diff: 'diff --git a/src/a.ts b/src/a.ts',
            });

            expect(result?.files).toEqual(['src/a.ts', 'pnpm-lock.yaml']);
            expect(result?.omittedFiles).toEqual(['pnpm-lock.yaml']);
            expect(result?.diff).toMatch(`${OMITTED_HEADER}\npnpm-lock.yaml added\n`);
        });

        // Without -z parsing, numstat prints `a.ts => b.ts` and name-status prints both paths
        // separately, so a rename would have been listed as omitted
        test('keys renames by the new path', () => {
            const result = assembleDiff({
                nameStatusZ: 'R100\0old name.ts\0new name.ts\0',
                numstatZ: '0\t0\t\0old name.ts\0new name.ts\0',
                diff: '',
            });

            expect(result?.files).toEqual(['new name.ts']);
            expect(result?.omittedFiles).toBe(undefined);
        });

        test('keeps paths that contain tabs', () => {
            const result = assembleDiff({
                nameStatusZ: 'M\0tab\tfile.txt\0',
                numstatZ: '1\t0\ttab\tfile.txt\0',
                diff: 'diff --git',
            });

            expect(result?.files).toEqual(['tab\tfile.txt']);
            expect(result?.omittedFiles).toBe(undefined);
        });

        test('reports binary files with their real status', () => {
            const result = assembleDiff({
                nameStatusZ: 'A\0logo.png\0D\0old.png\0',
                numstatZ: '-\t-\tlogo.png\0-\t-\told.png\0',
                diff: '',
            });

            expect(result?.diff).toMatch('Binary file logo.png added\nBinary file old.png deleted\n');
        });
    });

    describe('GitAdapter.getStagedDiff default excludes', ({ test }) => {
        const setup = async () => {
            const { fixture } = await createFixture({
                '.gitattributes': 'gen/** linguist-generated\n',
                'app.ts': 'export const a = 1;\n',
                'gen/client.ts': 'export const GENERATED_MARKER = 1;\n',
                'bundle.min.js': 'var MINIFIED_MARKER=1;\n',
                'pnpm-lock.yaml': 'LOCK_MARKER: 1\n',
                'secret.json': '{"SECRET_MARKER":1}\n',
                'dir with space/ünïcode.ts': 'export const u = 1;\n',
            });
            const git = await createGit(fixture.path);
            await git('add', ['-A']);
            return { fixture, git, adapter: new GitAdapter(fixture.path) };
        };

        test('omits generated/lockfile hunks but lists their names', async () => {
            const { fixture, adapter } = await setup();
            const result = await adapter.getStagedDiff(['secret.json']);
            await fixture.rm();

            expect(result?.diff).toMatch('export const a = 1;');
            expect(result?.diff).not.toMatch('GENERATED_MARKER');
            expect(result?.diff).not.toMatch('MINIFIED_MARKER');
            expect(result?.diff).not.toMatch('LOCK_MARKER');
            expect(result?.omittedFiles?.sort()).toEqual(['bundle.min.js', 'gen/client.ts', 'pnpm-lock.yaml']);
            expect(result?.files).toContain('dir with space/ünïcode.ts');
            expect(result?.omittedFiles).not.toContain('dir with space/ünïcode.ts');
        });

        // User --exclude means "the model must not see this", not even its name
        test('user excludes are invisible, not listed as omitted', async () => {
            const { fixture, adapter } = await setup();
            const result = await adapter.getStagedDiff(['secret.json']);
            await fixture.rm();

            expect(result?.files).not.toContain('secret.json');
            expect(result?.diff).not.toMatch('secret.json');
        });

        test('includeGenerated sends the generated hunks', async () => {
            const { fixture, adapter } = await setup();
            const result = await adapter.getStagedDiff([], [], { includeGenerated: true });
            await fixture.rm();

            expect(result?.diff).toMatch('GENERATED_MARKER');
            expect(result?.diff).toMatch('MINIFIED_MARKER');
            expect(result?.omittedFiles).toEqual(['pnpm-lock.yaml']);
        });

        // Pathspecs are cwd-relative by default; the default excludes must hold repo-wide
        test('default excludes apply repo-wide from a subdirectory and to nested files', async () => {
            const { fixture } = await createFixture({
                '.gitattributes': 'gen/** linguist-generated\n',
                'gen/client.ts': 'export const GENERATED_MARKER = 1;\n',
                'bundle.min.js': 'var MINIFIED_MARKER=1;\n',
                'pnpm-lock.yaml': 'LOCK_MARKER: 1\n',
                'packages/x/package-lock.json': '{"NESTED_LOCK_MARKER":1}\n',
                'sub/code.ts': 'export const s = 1;\n',
            });
            const git = await createGit(fixture.path);
            await git('add', ['-A']);
            const result = await new GitAdapter(path.join(fixture.path, 'sub')).getStagedDiff();
            await fixture.rm();

            expect(result?.diff).toMatch('export const s = 1;');
            expect(result?.diff).not.toMatch('GENERATED_MARKER');
            expect(result?.diff).not.toMatch('MINIFIED_MARKER');
            expect(result?.diff).not.toMatch('LOCK_MARKER');
            expect(result?.omittedFiles?.sort()).toEqual([
                'bundle.min.js',
                'gen/client.ts',
                'packages/x/package-lock.json',
                'pnpm-lock.yaml',
            ]);
        });

        // Used to be "no staged changes"
        test('a lockfile-only change still yields a diff', async () => {
            const { fixture } = await createFixture({ 'pnpm-lock.yaml': 'LOCK_MARKER: 1\n' });
            const git = await createGit(fixture.path);
            await git('add', ['-A']);
            const result = await new GitAdapter(fixture.path).getStagedDiff();
            await fixture.rm();

            expect(result?.files).toEqual(['pnpm-lock.yaml']);
            expect(result?.diff).toMatch(`${OMITTED_HEADER}\npnpm-lock.yaml added`);
        });

        test('a staged rename is not listed as omitted', async () => {
            const { fixture, git, adapter } = await setup();
            await git('commit', ['-m', 'chore: initial']);
            await git('mv', ['app.ts', 'main.ts']);
            const result = await adapter.getStagedDiff();
            await fixture.rm();

            expect(result?.files).toEqual(['main.ts']);
            expect(result?.omittedFiles).toBe(undefined);
        });

        // rewrite and watch mode read a commit through the same assembly
        test('getCommitDiff lists a committed lockfile as omitted and binaries by status', async () => {
            const { fixture, git, adapter } = await setup();
            await git('commit', ['-m', 'chore: initial']);
            await fixture.writeFile('app.ts', 'export const a = 2;\n');
            await fixture.writeFile('pnpm-lock.yaml', 'LOCK_MARKER: 2\n');
            // A NUL byte makes git treat the file as binary
            await fixture.writeFile('logo.png', 'PNG\0\x01\x02');
            await git('add', ['-A']);
            await git('commit', ['-m', 'feat: second']);
            const result = await adapter.getCommitDiff('HEAD');
            await fixture.rm();

            expect(result?.diff).toMatch('export const a = 2;');
            expect(result?.diff).not.toMatch('LOCK_MARKER');
            expect(result?.diff).toMatch('Binary file logo.png added');
            expect(result?.omittedFiles).toEqual(['pnpm-lock.yaml']);
            expect(result?.files.sort()).toEqual(['app.ts', 'logo.png', 'pnpm-lock.yaml']);
        });
    });

    describe('Jujutsu default excludes', ({ test }) => {
        test('are root-anchored filesets that match at any depth', () => {
            expect(defaultJjExcludeFilesets()).toContain('~root-glob:"**/*.min.js"');
            expect(defaultJjExcludeFilesets(true)).not.toContain('~root-glob:"**/*.min.js"');
            expect(defaultJjExcludeFilesets(true)).toContain('~root-glob:"**/pnpm-lock.yaml"');
        });

        // `glob:` is cwd-relative and one level deep, which is what went wrong; CI has no jj
        test('jj drops them from a subdirectory and in nested directories', async () => {
            const hasJj = await execa('jj', ['--version']).then(
                () => true,
                () => false
            );
            if (!hasJj) {
                return;
            }
            const { fixture } = await createFixture({
                'pnpm-lock.yaml': 'a\n',
                'a.min.js': 'b\n',
                'packages/x/package-lock.json': 'c\n',
                'packages/x/b.min.js': 'd\n',
                'sub/code.ts': 'e\n',
            });
            await execa('jj', ['git', 'init'], { cwd: fixture.path });
            const fileset = ['all()', ...defaultJjExcludeFilesets()].join(' & ');
            const { stdout } = await execa('jj', ['diff', '--name-only', fileset], { cwd: path.join(fixture.path, 'sub') });
            await fixture.rm();

            expect(stdout.trim()).toBe('code.ts');
        });
    });
});
