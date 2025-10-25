import chalk from 'chalk';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject, Subscription } from 'rxjs';

import { isVerboseLoggingEnabled } from '../utils/logger.js';
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

type InquirerPromptInstance = Awaited<ReturnType<typeof inquirer.prompt>> & {
    ui: {
        rl: { closed: boolean };
        close: () => void;
    };
};

export class ReactivePromptManager {
    private choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
    private loader$: BehaviorSubject<ReactiveListLoader>;
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);
    private stopMessage = 'Changes analyzed';
    private isDestroyed = false;
    private subscriptions: Subscription = new Subscription();
    inquirerInstance: InquirerPromptInstance | null = null;

    constructor(loader: ReactiveListLoader) {
        this.loader$ = new BehaviorSubject<ReactiveListLoader>(loader);
    }

    /**
     * Add subscription with automatic cleanup on destroy
     */
    addSubscription(subscription: Subscription): void {
        if (this.isDestroyed) {
            subscription.unsubscribe();
            return;
        }
        this.subscriptions.add(subscription);
    }

    initPrompt(options: typeof DEFAULT_INQUIRER_OPTIONS = DEFAULT_INQUIRER_OPTIONS) {
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
        if (this.isDestroyed) {
            return;
        }

        if (!choice || !choice.value) {
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
        try {
            this.destroyed$.next(true);
            this.destroyed$.complete();

            if (!this.choices$.closed) {
                this.choices$.complete();
            }
            if (!this.loader$.closed) {
                this.loader$.complete();
            }
        } catch (error) {
            console.warn('Error completing subjects:', error);
        }
    }

    closeInquirerInstance() {
        if (!this.inquirerInstance) {
            return;
        }

        // Check if readline interface is already closed before calling close()
        const ui = this.inquirerInstance.ui;
        if (ui?.rl && !ui.rl.closed) {
            ui.close();
        }
    }

    cancel() {
        if (this.inquirerInstance?.ui?.activePrompt) {
            (this.inquirerInstance.ui.activePrompt as ReactiveListPrompt<any>).abortPrompt();
        }
    }

    destroy() {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        try {
            this.cancel();
            this.closeInquirerInstance();
            this.subscriptions.unsubscribe();
            this.completeSubject();
        } catch (error) {
            if (isVerboseLoggingEnabled()) {
                console.warn('Error during ReactivePromptManager destruction:', error);
            }
        } finally {
            this.inquirerInstance = null;
        }
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
        console.log(`\n${chalk.bold.yellow('⚠')} ${chalk.yellow(`${emptyCommitMessage}`)}`);
    }

    private get currentChoices(): ReactiveListChoice[] {
        return this.choices$.getValue().map(origin => origin as ReactiveListChoice);
    }
}
