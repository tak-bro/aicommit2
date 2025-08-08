import { describe } from 'manten';

describe('VCS Adapters', ({ runTestSuite }) => {
    runTestSuite(import('./vcs-detection.js'));
    runTestSuite(import('./git-adapter.js'));
    runTestSuite(import('./jujutsu-adapter.js'));
    runTestSuite(import('./jujutsu-integration.js'));
});
