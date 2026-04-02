import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('GitHub Models', ({ runTestSuite }) => {
        runTestSuite(import('./utils.js'));
        runTestSuite(import('./service.js'));
    });
});
