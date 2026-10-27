import { execa } from 'execa';
import { expect, testSuite } from 'manten';

import { withMockProviders } from './mock-provider.js';
import { createFixture } from '../../utils.js';

// The fixture is also $HOME, so the config file and the app's own dirs would ride along with `-A`
const ignoreFixtureNoise = '.aicommit2\nLibrary/\n.config/\n';

const hasYadm = await execa('yadm', ['version']).then(
    () => true,
    () => false
);

export default testSuite(({ describe }) => {
    // `-A` is `git add -A`: the old one-step flow for users who want new files too (#278)
    describe('add-all', ({ test }) => {
        test('-A commits untracked files without the untracked notice', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fixture.writeFile('.gitignore', ignoreFixtureNoise);
                await git('add', ['.gitignore']);
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { stderr, exitCode } = await aicommit2(['-A', '--auto-select'], options);

                expect(exitCode).toBe(0);
                const { stdout: committed } = await git('show', ['--name-only', '--format=', 'HEAD']);
                expect(committed.trim().split('\n').sort()).toEqual(['data.json', 'data2.json']);
                expect(stderr).not.toMatch('not staged');
            });
        });

        test('-a with -A stages untracked files too', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fixture.writeFile('.gitignore', ignoreFixtureNoise);
                await git('add', ['.gitignore']);
                await git('commit', ['-m', 'chore: initial']);
                await fixture.writeFile('data.json', '{"a":2}');

                const { exitCode } = await aicommit2(['-a', '-A', '--auto-select'], options);

                expect(exitCode).toBe(0);
                const { stdout: committed } = await git('show', ['--name-only', '--format=', 'HEAD']);
                expect(committed.trim().split('\n').sort()).toEqual(['data.json', 'data2.json']);
            });
        });

        // Nothing is left for `--all` to pick up once `-A` has run, so the hint would be a dead end
        test('-A with nothing to stage suggests no other aicommit2 flag', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git, fixture }) => {
                await fixture.writeFile('.gitignore', `${ignoreFixtureNoise}data2.json\n`);
                await git('add', ['.gitignore']);
                await git('commit', ['-m', 'chore: initial']);

                const { stdout, exitCode } = await aicommit2(['-A'], options);

                expect(exitCode).toBe(1);
                expect(stdout).toMatch('No staged changes found');
                expect(stdout).not.toMatch('aicommit2 --all');
                expect(stdout).not.toMatch('aicommit2 -A');
            });
        });

        // yadm's work tree is $HOME: `yadm add -A` would stage every file there, its own repo included
        if (!hasYadm) {
            console.warn('add-all: yadm not found, skipping the yadm --add-all guard test');
        } else {
            test('-A in a yadm repo fails before staging', async () => {
                const { fixture, aicommit2 } = await createFixture({ '.zshrc': 'a', 'new.txt': 'x' });
                // Same env the CLI run gets, so yadm finds the repo it just made under the fixture $HOME
                const yadmEnv = { HOME: fixture.path, PATH: process.env.PATH };
                const yadm = (args: string[]) => execa('yadm', args, { cwd: fixture.path, extendEnv: false, env: yadmEnv });
                try {
                    await yadm(['init', '-w', fixture.path]);
                    await yadm(['add', '.zshrc']);

                    const { stdout, exitCode } = await aicommit2(['-A'], { reject: false, env: { PATH: process.env.PATH } });

                    expect(exitCode).toBe(1);
                    expect(stdout).toMatch('yadm add <path>');
                    const { stdout: staged } = await yadm(['diff', '--cached', '--name-only']);
                    expect(staged.trim()).toBe('.zshrc');
                } finally {
                    await fixture.rm();
                }
            });
        }
    });
});
