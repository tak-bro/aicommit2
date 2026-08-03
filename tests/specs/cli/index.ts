import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('CLI', ({ runTestSuite }) => {
        runTestSuite(import('./error-cases.js'));
        runTestSuite(import('./auto-select.js'));
        runTestSuite(import('./commits.js'));
        runTestSuite(import('./rewrite.js'));
    });
});
