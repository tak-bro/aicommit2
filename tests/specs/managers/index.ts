import { testSuite } from 'manten';

export default testSuite(({ describe }) => {
    describe('Managers', ({ runTestSuite }) => {
        runTestSuite(import('./reactive-prompt-manager.js'));
    });
});
