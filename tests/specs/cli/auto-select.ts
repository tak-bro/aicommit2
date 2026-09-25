import { expect, testSuite } from 'manten';

import { MOCK_MESSAGE, MOCK_REVIEW_SUMMARY, withMockProviders } from './mock-provider.js';

export default testSuite(({ describe }) => {
    describe('auto-select', async ({ test }) => {
        // Issue #262: `--auto-select` used to be ignored unless exactly one provider was
        // configured, so a non-interactive run fell through to the picker and waited for Enter.
        test('selects a message without prompting when several providers are configured', async () => {
            await withMockProviders(true, async ({ aicommit2, options }) => {
                const { stdout, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], options);

                expect(exitCode).toBe(0);
                expect(stdout).toMatch(MOCK_MESSAGE);
            });
        });

        test('commits without asking for confirmation', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                const { exitCode } = await aicommit2(['--all', '--auto-select'], options);
                expect(exitCode).toBe(0);

                const { stdout: commitMessage } = await git('log', ['--pretty=format:%s']);
                expect(commitMessage).toBe(MOCK_MESSAGE);
            });
        });

        // `rewrite` owns a second copy of the flag, so it needs its own coverage — the gate
        // was originally fixed in only one of the two commands.
        test('rewrite selects a message without prompting', async () => {
            await withMockProviders(true, async ({ aicommit2, options, git }) => {
                // Two commits: the root commit has no parent, so it has no diff to rewrite from
                await git('commit', ['-m', 'chore: initial']);
                await git('add', ['data2.json']);
                await git('commit', ['-m', 'chore: second']);

                const { stdout, exitCode } = await aicommit2(['rewrite', '--dry-run', '--auto-select'], options);

                expect(exitCode).toBe(0);
                expect(stdout).toMatch(MOCK_MESSAGE);
            });
        });

        // The code review picker had no `--auto-select` check of its own, so an opted-in
        // review parked the run at a list plus a confirmation before generation even started.
        test('prints the code review without prompting', async () => {
            await withMockProviders(
                true,
                async ({ aicommit2, options }) => {
                    const { stdout, stderr, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], options);

                    // Piped --dry-run keeps stdout for the message; everything else goes to stderr
                    expect(exitCode).toBe(0);
                    expect(stderr).toMatch(MOCK_REVIEW_SUMMARY);
                    expect(stderr).toMatch('Mock finding');
                    expect(stdout).toBe(MOCK_MESSAGE);
                },
                { generalConfig: 'codeReview=true\n' }
            );
        });

        // The picker asks whether to continue on critical findings. Nothing can answer that
        // here, so the finding has to be visible in the output instead.
        test('warns about a critical code review finding and still generates a message', async () => {
            await withMockProviders(
                true,
                async ({ aicommit2, options }) => {
                    const { stdout, stderr, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], options);

                    expect(exitCode).toBe(0);
                    expect(stderr).toMatch('Critical issues found in code review');
                    expect(stdout).toBe(MOCK_MESSAGE);
                },
                { generalConfig: 'codeReview=true\n', reviewSeverity: 'critical' }
            );
        });

        // Nothing renders the per-model error lines in auto-select mode, so they used to be
        // swallowed entirely and the run ended with no explanation.
        test('prints the per-model errors when every provider fails', async () => {
            await withMockProviders(false, async ({ aicommit2, options }) => {
                const { stdout, stderr, exitCode } = await aicommit2(['--all', '--dry-run', '--auto-select'], options);

                expect(exitCode).toBe(1);
                expect(stderr).toMatch('M1');
                expect(stderr).toMatch('M2');
                expect(stderr).toMatch('No valid commit message was generated');
                expect(stdout).toBe('');
            });
        });
    });
});
