import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Copilot SDK', ({ runTestSuite }) => {
        runTestSuite(import('./utils.js'));
        runTestSuite(import('./service.js'));
    });
});
