import { expect, testSuite } from 'manten';

import { createFixture, createGit } from '../../utils.js';

export default testSuite(({ describe }) => {
    describe('Error cases', async ({ test }) => {
        test('Fails on non-Git project', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout, exitCode } = await aicommit2([], { reject: false });
            expect(exitCode).toBe(1);
            // Updated to match new VCS abstraction error message
            expect(stdout).toMatch('No supported VCS repository found');
            await fixture.rm();
        });

        test('Fails on no staged files', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await createGit(fixture.path);

            const { stdout, exitCode } = await aicommit2([], { reject: false });
            expect(exitCode).toBe(1);
            expect(stdout).toMatch(
                'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.'
            );
            await fixture.rm();
        });
    });
});
