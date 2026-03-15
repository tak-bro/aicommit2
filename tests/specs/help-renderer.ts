import { expect, testSuite } from 'manten';

import { createFixture } from '../utils.js';

// Strip ANSI escape codes for matching
// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string): string => str.replace(/\x1B\[[0-9;]*m/g, '');

export default testSuite(({ describe }) => {
    describe('help renderer - flag grouping', async ({ test }) => {
        test('help displays grouped flags', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);
            const output = stripAnsi(stdout);

            // Check flag group headers
            expect(output).toMatch('Flags - Message Options:');
            expect(output).toMatch('Behavior:');
            expect(output).toMatch('VCS Selection:');
            expect(output).toMatch('Hook Integration:');
            expect(output).toMatch('Formatting:');
            expect(output).toMatch('Debug:');
            await fixture.rm();
        });

        test('help displays commands', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);
            const output = stripAnsi(stdout);

            // Check commands section
            expect(output).toMatch('Commands:');
            expect(output).toMatch('config');
            expect(output).toMatch('doctor');
            expect(output).toMatch('stats');
            expect(output).toMatch('hook');
            expect(output).toMatch('log');
            await fixture.rm();
        });

        test('flags are in correct groups', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['--help']);
            const output = stripAnsi(stdout);

            // Message Options should contain locale, generate, type
            const messageOptionsSection = output.split('Behavior:')[0];
            expect(messageOptionsSection).toMatch('--locale');
            expect(messageOptionsSection).toMatch('--generate');
            expect(messageOptionsSection).toMatch('--type');

            // VCS Selection should contain git, yadm, jj
            const vcsSection = output.split('VCS Selection:')[1]?.split('Hook Integration:')[0] || '';
            expect(vcsSection).toMatch('--git');
            expect(vcsSection).toMatch('--yadm');
            expect(vcsSection).toMatch('--jj');

            await fixture.rm();
        });
    });
});
