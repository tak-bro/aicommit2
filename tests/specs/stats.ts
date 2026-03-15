
import { expect, testSuite } from 'manten';

import { createFixture } from '../utils.js';

export default testSuite(({ describe }) => {
    describe('stats command', async ({ test }) => {
        test('stats shows no data message when empty', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['stats']);

            expect(stdout).toMatch('No statistics recorded yet');
            await fixture.rm();
        });

        test('stats clear works on empty stats', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['stats', 'clear']);

            expect(stdout).toMatch('Statistics cleared successfully');
            await fixture.rm();
        });

        test('stats with days option', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['stats', '-d', '7']);

            expect(stdout).toMatch('No statistics recorded yet');
            await fixture.rm();
        });

        test('stats help shows options', async () => {
            const { fixture, aicommit2 } = await createFixture();
            const { stdout } = await aicommit2(['stats', '--help']);

            expect(stdout).toMatch('View AI request statistics');
            expect(stdout).toMatch('--days');
            expect(stdout).toMatch('stats clear');
            await fixture.rm();
        });
    });
});
