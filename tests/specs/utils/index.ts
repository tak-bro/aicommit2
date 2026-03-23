import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Utils', ({ runTestSuite }) => {
        runTestSuite(import('./subscription-manager.js'));
        runTestSuite(import('./stream-json-parser.js'));
    });
});
