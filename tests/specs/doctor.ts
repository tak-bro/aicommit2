import { expect, testSuite } from 'manten';

import { summarizeOpenRouterCapabilities } from '../../src/commands/doctor.js';
import { createFixture } from '../utils.js';

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
