import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Utils', ({ runTestSuite }) => {
        runTestSuite(import('./subscription-manager.js'));
    });
});
