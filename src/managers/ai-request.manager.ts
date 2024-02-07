import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, from, mergeMap, of } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { AIServiceParams, AIType, ApiKeyName } from '../services/ai/ai.service.js';
import { ClovaXService } from '../services/ai/clova-x.service.js';
import { HuggingService } from '../services/ai/hugging.service.js';
import { OpenAIService } from '../services/ai/openai.service.js';
import { ValidConfig } from '../utils/config.js';
import { StagedDiff } from '../utils/git.js';

export class AIRequestManager {
    constructor(
        private readonly config: ValidConfig,
        private readonly stagedDiff: StagedDiff
    ) {}

    createAIRequests$(availableKeyNames: ApiKeyName[]): Observable<ReactiveListChoice> {
        return from(availableKeyNames).pipe(
            mergeMap(ai => {
                const params: AIServiceParams = {
                    config: this.config,
                    stagedDiff: this.stagedDiff,
                };
                switch (ai) {
                    case AIType.OPEN_AI:
                        return AIServiceFactory.create(OpenAIService, params).generateCommitMessage$();
                    case AIType.HUGGING:
                        return AIServiceFactory.create(HuggingService, params).generateCommitMessage$();
                    case AIType.CLOVA_X:
                        return AIServiceFactory.create(ClovaXService, params).generateCommitMessage$();
                    default:
                        const prefixError = chalk.red.bold(`[${ai}]`);
                        return of({
                            name: prefixError + ' Invalid AI type',
                            value: 'Invalid AI type',
                            isError: true,
                        });
                }
            })
        );
    }
}
