import chalk from 'chalk';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject } from 'rxjs';

import { sortByDisabled } from '../utils/utils.js';

export const commitMsgLoader = {
    isLoading: false,
    startOption: {
        text: 'AI is analyzing your changes',
    },
};

export const codeReviewLoader = {
    isLoading: false,
    startOption: {
        text: 'AI is performing a code review',
    },
};

export const emptyCommitMessage = `No commit messages were generated`;

export const emptyCodeReview = `No code reviews were generated`;

export const DEFAULT_INQUIRER_OPTIONS = {
    type: 'reactiveListPrompt',
    name: 'aicommit2Prompt',
    message: 'Pick a commit message to use: ',
    emptyMessage: `⚠ ${emptyCommitMessage}`,
    loop: false,
    descPageSize: 15,
    showDescription: true,
    pickKey: 'short',
    isDescriptionDim: true,
    stopMessage: 'Changes analyzed',
};

export class ReactivePromptManager {
    private choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
    private loader$: BehaviorSubject<ReactiveListLoader>;
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
    private stopMessage = 'Changes analyzed';
    inquirerInstance: any = null;

    constructor(loader: ReactiveListLoader) {
        this.loader$ = new BehaviorSubject<ReactiveListLoader>(loader);
    }

    initPrompt(options: any = DEFAULT_INQUIRER_OPTIONS) {
        this.stopMessage = options.stopMessage;

        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        this.inquirerInstance = inquirer.prompt({
            choices$: this.choices$,
            loader$: this.loader$,
            ...options,
        });

        return this.inquirerInstance;
    }

    startLoader() {
        this.loader$.next({ isLoading: true });
    }

    clearLoader() {
        if (!this.inquirerInstance) {
            return;
        }
        this.loader$.next({ isLoading: false, clear: true });
    }

    refreshChoices(choice: ReactiveListChoice) {
        const { value, isError } = choice;
        if (!choice || !value) {
            return;
        }
        this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
    }

    checkErrorOnChoices(shouldExit = true) {
        const isAllError = this.choices$
            .getValue()
            .map(choice => choice as ReactiveListChoice)
            .every(value => value?.isError || value?.disabled);

        if (isAllError) {
            this.alertNoGeneratedMessage();
            this.logEmptyCommitMessage();
            shouldExit && process.exit(1);
            return;
        }
        this.stopLoaderOnSuccess();
    }

    completeSubject() {
        this.choices$.complete();
        this.loader$.complete();
        this.destroyed$.next(true);
        this.destroyed$.complete();
    }

    closeInquirerInstance() {
        if (!this.inquirerInstance) {
            return;
        }
        this.inquirerInstance.ui.close();
    }

    private alertNoGeneratedMessage() {
        this.loader$.next({
            isLoading: false,
            message: emptyCommitMessage,
            stopOption: {
                doneFrame: '⚠', // '✖'
                color: 'yellow', // 'red'
            },
        });
    }

    private stopLoaderOnSuccess() {
        this.loader$.next({ isLoading: false, message: this.stopMessage });
    }

    private logEmptyCommitMessage() {
        console.log(`${chalk.bold.yellow('⚠')} ${chalk.yellow(`${emptyCommitMessage}`)}`);
    }

    private get currentChoices(): ReactiveListChoice[] {
        return this.choices$.getValue().map(origin => origin as ReactiveListChoice);
    }
}
