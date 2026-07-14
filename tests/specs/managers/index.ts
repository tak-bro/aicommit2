import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Managers', ({ runTestSuite }) => {
        runTestSuite(import('./ai-request-manager.js'));
        runTestSuite(import('./progress-animator.js'));
        runTestSuite(import('./reactive-prompt-manager.js'));
    });
});
