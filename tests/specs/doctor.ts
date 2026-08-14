import { expect, testSuite } from 'manten';

import { summarizeOpenRouterCapabilities } from '../../src/commands/doctor.js';
import { createFixture } from '../utils.js';

// doctor prints one line per provider; assertions target that line so a message
// belonging to another provider cannot satisfy them.
const providerLine = (stdout: string, provider: string): string => stdout.split('\n').find(line => line.includes(provider)) || '';

export default testSuite(({ describe }) => {
    describe('doctor command', async ({ test }) => {
        test('doctor shows health check output', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['doctor']);

            expect(stdout).toMatch('aicommit2 Health Check');
            expect(stdout).toMatch('Providers:');
            expect(stdout).toMatch('Summary:');
            await fixture.rm();
        });

        test('doctor shows skipped for unconfigured providers', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['doctor']);

            // Without any config, most providers should be skipped
            expect(stdout).toMatch('Not configured');
            await fixture.rm();
        });

        test('doctor help shows description', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['doctor', '--help']);

            expect(stdout).toMatch('Check health status');
            await fixture.rm();
        });

        test('doctor warns when GitHub Models has invalid model ID format', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await aicommit2(['config', 'set', 'GITHUB_MODELS.key=github_pat_test']);
            await aicommit2(['config', 'set', 'GITHUB_MODELS.model=gpt-4o-mini']);

            const { stdout } = await aicommit2(['doctor']);
            expect(stdout).toMatch('GITHUB_MODELS');
            expect(stdout).toMatch('Invalid model ID format');
            expect(stdout).toMatch('publisher/model');
            await fixture.rm();
        });

        // Subscription-CLI providers have no API key, so doctor must gate them on a
        // configured model like the runtime does. Regression guard for issue #268,
        // where both fell through to the API key check and reported "Not configured"
        // while generation worked fine.
        test('doctor reports subscription-CLI providers as healthy when a model is configured', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await aicommit2(['config', 'set', 'CLAUDE_CODE.model=sonnet']);
            await aicommit2(['config', 'set', 'GEMINI_CLI.model=gemini-2.5-pro']);

            const { stdout } = await aicommit2(['doctor']);

            expect(providerLine(stdout, 'CLAUDE_CODE')).toMatch('Model configured');
            expect(providerLine(stdout, 'CLAUDE_CODE')).toMatch('Model: sonnet');
            expect(providerLine(stdout, 'CLAUDE_CODE')).not.toMatch('Not configured');

            expect(providerLine(stdout, 'GEMINI_CLI')).toMatch('Model configured');
            expect(providerLine(stdout, 'GEMINI_CLI')).not.toMatch('Not configured');
            await fixture.rm();
        });

        test('doctor reports subscription-CLI providers as missing models, not missing keys', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['doctor']);

            expect(providerLine(stdout, 'CLAUDE_CODE')).toMatch('No models configured');
            expect(providerLine(stdout, 'GEMINI_CLI')).toMatch('No models configured');
            await fixture.rm();
        });

        // COPILOT_SDK opts in on a model OR a key OR COPILOT_GITHUB_TOKEN, so gating
        // doctor on the model alone reported an env-token-only setup as unconfigured
        // while generation worked — the same divergence as issue #268.
        test('doctor runs the COPILOT_SDK environment check once the provider is opted in', async () => {
            const { fixture, aicommit2 } = await createFixture();
            await aicommit2(['config', 'set', 'COPILOT_SDK.model=gpt-4.1']);
            const { stdout } = await aicommit2(['doctor'], { env: { COPILOT_GITHUB_TOKEN: 'ghp_classicTokenForTest' } });

            // The classic-PAT rejection sits behind both gates and needs no network. Reaching
            // it also pins branch order: the shared subscription-CLI gate runs after this one,
            // and would have reported the configured model as healthy instead.
            expect(providerLine(stdout, 'COPILOT_SDK')).toMatch('Unsupported classic PAT');
            expect(providerLine(stdout, 'COPILOT_SDK')).not.toMatch('Model configured');
            await fixture.rm();
        });

        // The fan-out is one request per configured model, so opting in without a model
        // selects the provider and then sends nothing. Reporting that as healthy would be
        // the #268 false report pointed the other way.
        test('doctor warns when COPILOT_SDK is opted in by token but has no model', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['doctor'], { env: { COPILOT_GITHUB_TOKEN: 'github_pat_tokenForTest' } });

            expect(providerLine(stdout, 'COPILOT_SDK')).toMatch('no model configured');
            expect(providerLine(stdout, 'COPILOT_SDK')).not.toMatch('Not configured (needs');
            await fixture.rm();
        });

        // The skip message names all three opt-in signals: after the gate widened, telling
        // the user to configure a model would hide the key and token paths.
        test('doctor still skips COPILOT_SDK when no opt-in signal is present', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['doctor']);

            expect(providerLine(stdout, 'COPILOT_SDK')).toMatch('Not configured (needs model, key, or COPILOT_GITHUB_TOKEN)');
            await fixture.rm();
        });

        test('summarize OpenRouter capabilities for commit-safe models', async () => {
            const notes = summarizeOpenRouterCapabilities(
                {
                    model: ['stepfun/step-3.5-flash:free'],
                    responseFormat: { type: 'json_object' },
                    reasoning: { effort: 'low' },
                } as any,
                [
                    {
                        id: 'stepfun/step-3.5-flash:free',
                        canonical_slug: 'stepfun/step-3.5-flash:free',
                        name: 'Step-3.5 Flash Free',
                        context_length: 4096,
                        supported_parameters: ['response_format', 'reasoning'],
                    },
                ]
            );

            expect(notes).toEqual(['stepfun/step-3.5-flash:free (4096 ctx; supports: response_format, reasoning)']);
        });

        test('summarize OpenRouter capabilities warns when the model lacks structured output support', async () => {
            const notes = summarizeOpenRouterCapabilities(
                {
                    model: ['stepfun/step-3.5-flash:free'],
                    responseFormat: { type: 'json_object' },
                } as any,
                [
                    {
                        id: 'stepfun/step-3.5-flash:free',
                        canonical_slug: 'stepfun/step-3.5-flash:free',
                        name: 'Step-3.5 Flash Free',
                        context_length: 4096,
                        supported_parameters: ['temperature', 'top_p', 'max_tokens'],
                    },
                ]
            );

            expect(notes).toEqual([
                'stepfun/step-3.5-flash:free: consider removing OPENROUTER.responseFormat; 4096 ctx; supports: temperature, top_p, max_tokens',
            ]);
        });

        test('summarize OpenRouter capabilities recommends removing unsupported reasoning config', async () => {
            const notes = summarizeOpenRouterCapabilities(
                {
                    model: ['stepfun/step-3.5-flash:free'],
                    reasoning: { effort: 'low' },
                } as any,
                [
                    {
                        id: 'stepfun/step-3.5-flash:free',
                        canonical_slug: 'stepfun/step-3.5-flash:free',
                        name: 'Step-3.5 Flash Free',
                        context_length: 4096,
                        supported_parameters: ['temperature', 'top_p', 'max_tokens'],
                    },
                ]
            );

            expect(notes).toEqual([
                'stepfun/step-3.5-flash:free: consider removing OPENROUTER.reasoning; 4096 ctx; supports: temperature, top_p, max_tokens',
            ]);
        });
    });
});
