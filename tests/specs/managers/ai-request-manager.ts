import { expect, testSuite } from 'manten';

import { AIRequestManager } from '../../../src/managers/ai-request.manager.js';
import { ModelName, ValidConfig } from '../../../src/utils/config.js';
import { GitDiff } from '../../../src/utils/vcs.js';

const emptyDiff: GitDiff = { files: [], diff: '' };

const buildManager = (models: Record<string, string | string[]>) => {
    const config = Object.fromEntries(Object.entries(models).map(([name, model]) => [name, { model }])) as unknown as ValidConfig;
    return new AIRequestManager(config, emptyDiff);
};

export default testSuite(({ describe }) => {
    describe('AIRequestManager', ({ describe: describeGroup }) => {
        describeGroup('countRequests', ({ test }) => {
            test('counts one request per provider with a single model', () => {
                const manager = buildManager({ OPENAI: 'gpt-4o', GEMINI: 'gemini-2.0-flash' });

                expect(manager.countRequests(['OPENAI', 'GEMINI'] as ModelName[])).toBe(2);
            });

            test('counts every model of a multi-model provider', () => {
                const manager = buildManager({ OPENAI: ['gpt-4o', 'gpt-4o-mini', 'o3'], GEMINI: 'gemini-2.0-flash' });

                expect(manager.countRequests(['OPENAI', 'GEMINI'] as ModelName[])).toBe(4);
            });

            test('counts only the providers it is given', () => {
                const manager = buildManager({ OPENAI: ['gpt-4o', 'o3'], GEMINI: 'gemini-2.0-flash' });

                expect(manager.countRequests(['GEMINI'] as ModelName[])).toBe(1);
            });

            test('returns zero for no providers', () => {
                const manager = buildManager({ OPENAI: 'gpt-4o' });

                expect(manager.countRequests([])).toBe(0);
            });
        });
    });
});
