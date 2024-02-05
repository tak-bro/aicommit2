import chalk from 'chalk';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject, Subscription, from, mergeMap, of, takeUntil } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { AIServiceParams, AIType, ApiKeyName } from '../services/ai/ai.service.js';
import { ClovaXService } from '../services/ai/clova-x.service.js';
import { HuggingService } from '../services/ai/hugging.service.js';
import { OpenAIService } from '../services/ai/openai.service.js';
import { ValidConfig } from '../utils/config.js';
import { StagedDiff } from '../utils/git.js';

const defaultLoader = {
    isLoading: false,
    startOption: {
        text: 'AI is analyzing your changes',
    },
};

export class ReactivePromptManager {
    private choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
    private loader$: BehaviorSubject<ReactiveListLoader> = new BehaviorSubject<ReactiveListLoader>(defaultLoader);
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

    constructor(
        private readonly config: ValidConfig,
        private readonly stagedDiff: StagedDiff
    ) {}

    initPrompt() {
        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        return inquirer.prompt({
            type: 'reactiveListPrompt',
            name: 'aicommit2Prompt',
            message: 'Pick a commit message to use: ',
            emptyMessage: '⚠ No commit messages were generated',
            choices$: this.choices$,
            loader$: this.loader$,
        });
    }

    startLoader() {
        this.loader$.next({ isLoading: true });
    }

    generateAIMessages$(availableKeyNames: ApiKeyName[]): Subscription {
        return this.createAvailableAIRequests$(availableKeyNames).subscribe(
            (choice: ReactiveListChoice) => this.refreshChoices(choice),
            () => {},
            () => this.checkErrorOnChoices()
        );
    }

    refreshChoices(choice: ReactiveListChoice) {
        const { name, value, isError } = choice;
        if (!choice || !value) {
            return;
        }
        const currentChoices = this.choices$.getValue();
        this.choices$.next([
            ...currentChoices,
            {
                name,
                value,
                disabled: isError,
                isError,
            },
        ]);
    }

    checkErrorOnChoices() {
        const isAllError = this.choices$
            .getValue()
            .map(choice => choice as ReactiveListChoice)
            .every(value => value?.isError || value?.disabled);
        if (isAllError) {
            this.alertNoGeneratedMessage();
            return;
        }
        this.stopLoaderOnSuccess();
    }

    createAvailableAIRequests$(availableKeyNames: ApiKeyName[]) {
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
            }),
            takeUntil(this.destroyed$)
        );
    }

    completeSubject() {
        this.choices$.complete();
        this.loader$.complete();
        this.destroyed$.next(true);
        this.destroyed$.complete();
    }

    private alertNoGeneratedMessage() {
        this.loader$.next({
            isLoading: false,
            message: 'No commit messages were generated',
            stopOption: {
                doneFrame: '⚠', // '✖'
                color: 'yellow', // 'red'
            },
        });
    }

    private stopLoaderOnSuccess() {
        this.loader$.next({ isLoading: false, message: 'Changes analyzed' });
    }
}
