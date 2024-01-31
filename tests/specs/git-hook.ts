import path from 'path';

import { expect, testSuite } from 'manten';

import { assertOpenAiToken, createFixture, createGit, files } from '../utils.js';

export default testSuite(({ describe }) => {
    describe('Git hook', ({ test }) => {
        assertOpenAiToken();

        test('errors when not in Git repo', async () => {
            const { fixture, aicommit2 } = await createFixture(files);
            const { exitCode, stderr } = await aicommit2(['hook', 'install'], {
                reject: false,
            });

            expect(exitCode).toBe(1);
            expect(stderr).toMatch('The current directory must be a Git repository');

            await fixture.rm();
        });

        test('installs from Git repo subdirectory', async () => {
            const { fixture, aicommit2 } = await createFixture({
                ...files,
                'some-dir': {
                    'file.txt': '',
                },
            });
            await createGit(fixture.path);

            const { stdout } = await aicommit2(['hook', 'install'], {
                cwd: path.join(fixture.path, 'some-dir'),
            });
            expect(stdout).toMatch('Hook installed');

            expect(await fixture.exists('.git/hooks/prepare-commit-msg')).toBe(true);

            await fixture.rm();
        });

        test('Commits', async () => {
            const { fixture, aicommit2 } = await createFixture(files);
            const git = await createGit(fixture.path);

            const { stdout } = await aicommit2(['hook', 'install']);
            expect(stdout).toMatch('Hook installed');

            await git('add', ['data.json']);
            await git('commit', ['--no-edit'], {
                env: {
                    HOME: fixture.path,
                    USERPROFILE: fixture.path,
                },
            });

            const { stdout: commitMessage } = await git('log', ['--pretty=%B']);
            console.log('Committed with:', commitMessage);
            expect(commitMessage.startsWith('# ')).not.toBe(true);

            await fixture.rm();
        });
    });
});
