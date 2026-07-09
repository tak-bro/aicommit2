import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { expect, testSuite } from 'manten';
import { Observable, of, throwError } from 'rxjs';

import { AIRequestManager } from '../../../src/managers/ai-request.manager.js';

import type { ModelName, ValidConfig } from '../../../src/utils/config.js';
import type { GitDiff } from '../../../src/utils/vcs.js';

const emptyDiff: GitDiff = { files: [], diff: '' };

// countRequests only reads `config[ai].model`; building a full ValidConfig here would
// add ~40 unrelated keys per provider without changing what is under test.
const configWithModels = (models: Record<string, string | string[]>): ValidConfig =>
    Object.fromEntries(Object.entries(models).map(([ai, model]) => [ai, { model }])) as unknown as ValidConfig;

/**
 * `createModelRequest$` is an instance arrow property, so it can be replaced to observe
 * how many times the settle callback fires without reaching a provider SDK.
 */
type StubbableManager = {
    createModelRequest$: (ai: ModelName, model: string, requestType: string) => Observable<ReactiveListChoice>;
};

const stubModelRequests = (manager: AIRequestManager, request$: () => Observable<ReactiveListChoice>): void => {
    (manager as unknown as StubbableManager).createModelRequest$ = request$;
};

const choiceOf = (value: string): ReactiveListChoice => ({ name: value, value, isError: false });

const settleCount = async (manager: AIRequestManager, modelNames: ModelName[]): Promise<number> => {
    let settled = 0;
    await new Promise<void>(resolve => {
        manager.createCommitMsgRequests$(modelNames, () => settled++).subscribe({ complete: () => resolve() });
    });
    return settled;
};

export default testSuite(({ describe }) => {
    describe('AIRequestManager', ({ describe: describeInner }) => {
        describeInner('countRequests', ({ test }) => {
            test('counts one request for a provider with a single model', () => {
                const manager = new AIRequestManager(configWithModels({ OPENAI: 'gpt-4o-mini' }), emptyDiff);

                expect(manager.countRequests(['OPENAI'] as ModelName[])).toBe(1);
            });

            test('counts one request per model when a provider configures several', () => {
                const manager = new AIRequestManager(configWithModels({ GROQ: ['llama-3.3-70b', 'gemma2-9b'] }), emptyDiff);

                expect(manager.countRequests(['GROQ'] as ModelName[])).toBe(2);
            });

            test('sums requests across providers', () => {
                const manager = new AIRequestManager(
                    configWithModels({
                        OPENAI: 'gpt-4o-mini',
                        GROQ: ['llama-3.3-70b', 'gemma2-9b'],
                        GEMINI: 'gemini-2.0-flash',
                    }),
                    emptyDiff
                );

                expect(manager.countRequests(['OPENAI', 'GROQ', 'GEMINI'] as ModelName[])).toBe(4);
            });

            test('counts zero when no providers are available', () => {
                const manager = new AIRequestManager(configWithModels({}), emptyDiff);

                expect(manager.countRequests([])).toBe(0);
            });
        });

        describeInner('onRequestSettled', ({ test }) => {
            test('fires once per model, not once per provider', async () => {
                const modelNames = ['GROQ'] as ModelName[];
                const manager = new AIRequestManager(configWithModels({ GROQ: ['llama-3.3-70b', 'gemma2-9b'] }), emptyDiff);
                stubModelRequests(manager, () => of(choiceOf('feat: x')));

                const settled = await settleCount(manager, modelNames);

                expect(settled).toBe(manager.countRequests(modelNames));
                expect(settled).toBe(2);
            });

            test('a failed request still settles, so the count reaches the total', async () => {
                const modelNames = ['OPENAI'] as ModelName[];
                const manager = new AIRequestManager(configWithModels({ OPENAI: 'gpt-4o-mini' }), emptyDiff);
                stubModelRequests(manager, () => throwError(() => new Error('HTTP 429')));

                const settled = await settleCount(manager, modelNames);

                expect(settled).toBe(manager.countRequests(modelNames));
            });

            test('sums settles across providers and models', async () => {
                const modelNames = ['OPENAI', 'GROQ'] as ModelName[];
                const manager = new AIRequestManager(
                    configWithModels({ OPENAI: 'gpt-4o-mini', GROQ: ['llama-3.3-70b', 'gemma2-9b'] }),
                    emptyDiff
                );
                stubModelRequests(manager, () => of(choiceOf('feat: x')));

                expect(await settleCount(manager, modelNames)).toBe(3);
            });
        });
    });
});
