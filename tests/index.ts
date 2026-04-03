import { describe } from 'manten';

describe('aicommit2', ({ runTestSuite }) => {
    runTestSuite(import('./specs/cli/index.js'));
    runTestSuite(import('./specs/openai/index.js'));
    runTestSuite(import('./specs/github-models/index.js'));
    runTestSuite(import('./specs/copilot-sdk/index.js'));
    runTestSuite(import('./specs/openrouter/index.js'));
    runTestSuite(import('./specs/bedrock/index.js'));
    runTestSuite(import('./specs/config.js'));
    runTestSuite(import('./specs/config-env.js'));
    runTestSuite(import('./specs/git-hook.js'));
    runTestSuite(import('./specs/vcs/index.js'));
    runTestSuite(import('./specs/managers/index.js'));
    runTestSuite(import('./specs/utils/index.js'));
    runTestSuite(import('./specs/doctor.js'));
    runTestSuite(import('./specs/stats.js'));
});
