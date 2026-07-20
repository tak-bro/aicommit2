import { expect, testSuite } from 'manten';

import { getAvailableAIs } from '../../../src/commands/get-available-ais.js';
import {
    buildCopilotSdkClientOptions,
    getCopilotSdkModelCandidates,
    isCopilotSdkAuthError,
    isCopilotSdkClassicPatError,
    isCopilotSdkCliNotFoundError,
    isCopilotSdkModelAccessError,
    isCopilotSdkPackageInstalled,
    normalizeCopilotSdkModel,
    resolveCopilotSdkToken,
} from '../../../src/services/ai/copilot-sdk.utils.js';

export default testSuite(({ describe }) => {
    describe('copilot sdk utils', ({ test }) => {
        test('normalizes model aliases and provider-prefixed IDs', () => {
            expect(normalizeCopilotSdkModel('openai/gpt-4.1')).toBe('gpt-4.1');
            expect(normalizeCopilotSdkModel('openai/gpt-5-mini')).toBe('gpt-5-mini');
            expect(normalizeCopilotSdkModel('anthropic/claude-haiku-4.5')).toBe('claude-haiku-4.5');
        });

        test('builds deduplicated fallback candidates', () => {
            expect(getCopilotSdkModelCandidates('openai/gpt-4.1')).toEqual(['gpt-4.1', 'gpt-4o', 'gpt-5-mini']);
            expect(getCopilotSdkModelCandidates('gpt-5-mini')).toEqual(['gpt-5-mini', 'gpt-4.1', 'gpt-4o']);
        });

        test('detects common model access errors', () => {
            expect(isCopilotSdkModelAccessError('Unknown model: gpt-5')).toBe(true);
            expect(isCopilotSdkModelAccessError('unavailable_model')).toBe(true);
            expect(isCopilotSdkModelAccessError('model not found')).toBe(true);
            expect(isCopilotSdkModelAccessError('network timeout')).toBe(false);
        });

        test('detects classic PAT auth errors', () => {
            expect(isCopilotSdkClassicPatError('Classic Personal Access Tokens (ghp_) are not supported by Copilot.')).toBe(true);
            expect(isCopilotSdkClassicPatError('No authentication information found.')).toBe(false);
        });

        test('classifies a missing bundled CLI as install breakage, not an auth error (issue #259)', () => {
            // copilot-sdk 0.2.0 mis-resolved the bundled CLI path against
            // @github/copilot >=1.0.39 layouts; the resulting "Copilot CLI not
            // found" was reported as an authentication failure, sending users
            // through login flows that could never fix it.
            const sdkPathError = 'Copilot CLI not found at /x/node_modules/@github/index.js. Ensure @github/copilot is installed.';
            const sdkResolveError = 'Could not find @github/copilot package. Searched 3 paths.';

            expect(isCopilotSdkCliNotFoundError(sdkPathError)).toBe(true);
            expect(isCopilotSdkCliNotFoundError(sdkResolveError)).toBe(true);
            expect(isCopilotSdkAuthError(sdkPathError)).toBe(false);

            expect(isCopilotSdkCliNotFoundError('No authentication information found.')).toBe(false);
            expect(isCopilotSdkAuthError('No authentication information found.')).toBe(true);
        });

        test('builds client options with COPILOT_GITHUB_TOKEN and strips generic GitHub envs', () => {
            const options = buildCopilotSdkClientOptions({
                COPILOT_GITHUB_TOKEN: 'github_pat_test',
                GH_TOKEN: 'ghp_bad',
                GITHUB_TOKEN: 'ghp_bad_2',
            });

            expect(options.gitHubToken).toBe('github_pat_test');
            expect(options.useLoggedInUser).toBe(false);
            expect(options.env?.COPILOT_GITHUB_TOKEN).toBe('github_pat_test');
            expect(options.env?.GH_TOKEN).toBe(undefined);
            expect(options.env?.GITHUB_TOKEN).toBe(undefined);
        });

        test('sets NODE_NO_WARNINGS in env to suppress SQLite experimental warning in subprocess', () => {
            const options = buildCopilotSdkClientOptions({});
            expect(options.env?.NODE_NO_WARNINGS).toBe('1');
        });

        test('builds client options using logged-in user when COPILOT_GITHUB_TOKEN is missing', () => {
            const options = buildCopilotSdkClientOptions({
                GH_TOKEN: 'ghp_bad',
                GITHUB_TOKEN: 'ghp_bad_2',
            });

            expect(options.gitHubToken).toBe(undefined);
            expect(options.useLoggedInUser).toBe(true);
            expect(options.env?.COPILOT_GITHUB_TOKEN).toBe(undefined);
            expect(options.env?.GH_TOKEN).toBe(undefined);
            expect(options.env?.GITHUB_TOKEN).toBe(undefined);
        });

        test('builds client options from an explicit resolved token without reading env', () => {
            const options = buildCopilotSdkClientOptions({ GH_TOKEN: 'ghp_bad' }, 'gho_from_gh');
            expect(options.gitHubToken).toBe('gho_from_gh');
            expect(options.useLoggedInUser).toBe(false);
            expect(options.env?.COPILOT_GITHUB_TOKEN).toBe('gho_from_gh');
            expect(options.env?.GH_TOKEN).toBe(undefined);
        });

        test('resolveCopilotSdkToken prefers COPILOT_GITHUB_TOKEN and skips gh', () => {
            let ghCalled = false;
            const ghReader = () => {
                ghCalled = true;
                return 'gho_gh';
            };
            const token = resolveCopilotSdkToken({ COPILOT_GITHUB_TOKEN: 'github_pat_env' }, ghReader);
            expect(token).toBe('github_pat_env');
            expect(ghCalled).toBe(false);
        });

        test('resolveCopilotSdkToken falls back to the gh reader when no env token', () => {
            const token = resolveCopilotSdkToken({}, () => 'gho_gh');
            expect(token).toBe('gho_gh');
        });

        test('resolveCopilotSdkToken returns undefined when neither env nor gh yields a token', () => {
            const token = resolveCopilotSdkToken({ COPILOT_GITHUB_TOKEN: '   ' }, () => undefined);
            expect(token).toBe(undefined);
        });

        test('COPILOT_SDK is available without API key when model is configured', () => {
            const config = {
                codeReview: true,
                watchMode: true,
                COPILOT_SDK: {
                    model: ['gpt-4.1'],
                    key: '',
                },
            } as any;

            const commitAIs = getAvailableAIs(config, 'commit');
            const reviewAIs = getAvailableAIs(config, 'review');
            const watchAIs = getAvailableAIs(config, 'watch');

            expect(commitAIs).toContain('COPILOT_SDK');
            expect(reviewAIs).toContain('COPILOT_SDK');
            expect(watchAIs).toContain('COPILOT_SDK');
        });

        const withCopilotToken = (token: string | undefined, run: () => void) => {
            const originalToken = process.env.COPILOT_GITHUB_TOKEN;
            if (token === undefined) {
                delete process.env.COPILOT_GITHUB_TOKEN;
            } else {
                process.env.COPILOT_GITHUB_TOKEN = token;
            }
            try {
                run();
            } finally {
                if (originalToken === undefined) {
                    delete process.env.COPILOT_GITHUB_TOKEN;
                } else {
                    process.env.COPILOT_GITHUB_TOKEN = originalToken;
                }
            }
        };

        test('COPILOT_SDK is not available without an explicit opt-in signal', () => {
            withCopilotToken(undefined, () => {
                const config = {
                    codeReview: true,
                    watchMode: true,
                    COPILOT_SDK: {
                        model: [],
                        key: '',
                    },
                } as any;

                const commitAIs = getAvailableAIs(config, 'commit');
                const reviewAIs = getAvailableAIs(config, 'review');
                const watchAIs = getAvailableAIs(config, 'watch');

                expect(commitAIs).not.toContain('COPILOT_SDK');
                expect(reviewAIs).not.toContain('COPILOT_SDK');
                expect(watchAIs).not.toContain('COPILOT_SDK');
            });
        });

        test('COPILOT_SDK is available when COPILOT_GITHUB_TOKEN is set', () => {
            withCopilotToken('github_pat_test', () => {
                const config = {
                    COPILOT_SDK: {
                        model: [],
                        key: '',
                    },
                } as any;

                const commitAIs = getAvailableAIs(config, 'commit');

                expect(commitAIs).toContain('COPILOT_SDK');
            });
        });

        test('COPILOT_SDK is available when key is configured', () => {
            withCopilotToken(undefined, () => {
                const config = {
                    COPILOT_SDK: {
                        model: [],
                        key: 'github_pat_test',
                    },
                } as any;

                const commitAIs = getAvailableAIs(config, 'commit');

                expect(commitAIs).toContain('COPILOT_SDK');
            });
        });

        test('COPILOT_SDK availability does not depend on the optional SDK package (issue #256)', () => {
            // Reproduces the reporter config: a single configured model, no key.
            // Availability must be driven by the opt-in signal alone; probing for
            // the optional @github/copilot-sdk package silently dropped the
            // provider on Homebrew / --omit=optional installs even though doctor
            // reported it healthy.
            withCopilotToken(undefined, () => {
                const config = {
                    codeReview: true,
                    watchMode: true,
                    COPILOT_SDK: {
                        model: ['claude-sonnet-4.5'],
                        key: '',
                    },
                } as any;

                expect(getAvailableAIs(config, 'commit')).toContain('COPILOT_SDK');
                expect(getAvailableAIs(config, 'review')).toContain('COPILOT_SDK');
                expect(getAvailableAIs(config, 'watch')).toContain('COPILOT_SDK');
            });
        });

        test('isCopilotSdkPackageInstalled resolves the bundled optional dependency', () => {
            // The package is a devDependency-installed optionalDependency in this
            // repo, so it must resolve here. In the field it may be absent, which
            // doctor surfaces as a warning rather than a silent failure.
            expect(isCopilotSdkPackageInstalled()).toBe(true);
        });
    });
});
