import chalk from 'chalk';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject } from 'rxjs';

import { sortByDisabled } from '../utils/utils.js';

const defaultLoader = {
    isLoading: false,
    startOption: {
        text: 'AI is analyzing your changes',
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
};

export class ReactivePromptManager {
    private choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
    private loader$: BehaviorSubject<ReactiveListLoader> = new BehaviorSubject<ReactiveListLoader>(defaultLoader);
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

    constructor() {}

    initPrompt(options: any = DEFAULT_INQUIRER_OPTIONS) {
        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        return inquirer.prompt({
            ...options,
            choices$: this.choices$,
            loader$: this.loader$,
        });
    }

    startLoader() {
        this.loader$.next({ isLoading: true });
    }

    refreshChoices(choice: ReactiveListChoice) {
        const { value, isError } = choice;
        if (!choice || !value) {
            return;
        }
        this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
    }

    checkErrorOnChoices() {
        const isAllError = this.choices$
            .getValue()
            .map(choice => choice as ReactiveListChoice)
            .every(value => value?.isError || value?.disabled);

        if (isAllError) {
            this.alertNoGeneratedMessage();
            this.logEmptyCommitMessage();
            process.exit(1);
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
        this.loader$.next({ isLoading: false, message: 'Changes analyzed' });
    }

    private logEmptyCommitMessage() {
        console.log(`${chalk.bold.yellow('⚠')} ${chalk.yellow(`${emptyCommitMessage}`)}`);
    }

    private get currentChoices(): ReactiveListChoice[] {
        return this.choices$.getValue().map(origin => origin as ReactiveListChoice);
    }
}
