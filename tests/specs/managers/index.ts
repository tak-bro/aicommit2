import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Managers', ({ runTestSuite }) => {
        runTestSuite(import('./ai-request-manager.js'));
        runTestSuite(import('./reactive-prompt-manager.js'));
    });
});
