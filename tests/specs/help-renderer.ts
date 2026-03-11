import { expect, testSuite } from 'manten';

import { createFixture } from '../utils.js';

export default testSuite(({ describe }) => {
    describe('help renderer - flag grouping', async ({ test }) => {
        test('help displays grouped flags', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);

            // Check flag group headers
            expect(stdout).toMatch('Flags - Message Options:');
            expect(stdout).toMatch('Behavior:');
            expect(stdout).toMatch('VCS Selection:');
            expect(stdout).toMatch('Hook Integration:');
            expect(stdout).toMatch('Formatting:');
            expect(stdout).toMatch('Debug:');
            await fixture.rm();
        });

        test('help displays commands', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);

            // Check commands section
            expect(stdout).toMatch('Commands:');
            expect(stdout).toMatch('config');
            expect(stdout).toMatch('doctor');
            expect(stdout).toMatch('stats');
            expect(stdout).toMatch('hook');
            expect(stdout).toMatch('log');
            await fixture.rm();
        });

        test('flags are in correct groups', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);

            // Message Options should contain locale, generate, type
            const messageOptionsSection = stdout.split('Behavior:')[0];
            expect(messageOptionsSection).toMatch('--locale');
            expect(messageOptionsSection).toMatch('--generate');
            expect(messageOptionsSection).toMatch('--type');

            // VCS Selection should contain git, yadm, jj
            const vcsSection = stdout.split('VCS Selection:')[1]?.split('Hook Integration:')[0] || '';
            expect(vcsSection).toMatch('--git');
            expect(vcsSection).toMatch('--yadm');
            expect(vcsSection).toMatch('--jj');

            await fixture.rm();
        });
    });
});
