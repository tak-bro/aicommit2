import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Services', ({ runTestSuite }) => {
        runTestSuite(import('./streaming-abort.js'));
    });
});
