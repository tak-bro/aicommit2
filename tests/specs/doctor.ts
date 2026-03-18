import { expect, testSuite } from 'manten';

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
    });
});
