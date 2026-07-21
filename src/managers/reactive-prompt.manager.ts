import chalk from 'chalk';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject, Subscription } from 'rxjs';

import { isVerboseLoggingEnabled } from '../utils/logger.js';
import { sortByDisabled } from '../utils/utils.js';

// `isLoading` starts true: the prompt mounts while requests are already in flight, and
// an empty choice list must not read as "nothing was generated" before anything lands.
export const commitMsgLoader = {
    isLoading: true,
    startOption: {
        text: 'AI is analyzing your changes',
    },
};

export const codeReviewLoader = {
    isLoading: true,
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
    // Opt into the library's animated loading bar (bounce + elapsed seconds, lib defaults)
    // instead of the default ora spinner. It hides the question while the list is empty, so
    // mounting the prompt up front no longer reads as a frozen "Pick a message" + empty list.
    loadingBar: {},
};

type InquirerPromptInstance = Awaited<ReturnType<typeof inquirer.prompt>> & {
    ui: {
        rl: { closed: boolean };
        close: () => void;
    };
};

/**
 * Extended choice type that supports in-place streaming updates.
 * When `streamKey` is set, `refreshChoices` updates the existing choice
 * with the same key instead of appending a new one.
 */
export interface StreamableChoice extends ReactiveListChoice {
    streamKey?: string;
}

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

    initPrompt(options: typeof DEFAULT_INQUIRER_OPTIONS = DEFAULT_INQUIRER_OPTIONS): InquirerPromptInstance {
        this.stopMessage = options.stopMessage;

        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        // inquirer.prompt returns a Promise that also carries a `.ui` handle; callers await
        // it for the answer and use `.ui` to close. Return the fresh instance (not the
        // nullable field) so callers get a non-null result to await.
        const instance = inquirer.prompt({
            choices$: this.choices$,
            loader$: this.loader$,
            ...options,
        }) as unknown as InquirerPromptInstance;
        this.inquirerInstance = instance;

        return instance;
    }

    startLoader() {
        this.loader$.next({ isLoading: true });
    }

    updateLoaderProgress(done: number, total: number) {
        if (this.isDestroyed) {
            return;
        }
        this.loader$.next({ isLoading: true, progress: { done, total } });
    }

    refreshChoices(choice: ReactiveListChoice) {
        if (this.isDestroyed || !choice) {
            return;
        }

        // Support in-place update / removal for streaming choices
        const streamKey = (choice as StreamableChoice).streamKey;
        if (streamKey) {
            // Empty value = remove the streaming preview
            if (!choice.value) {
                this.removeStreamingChoice(streamKey);
                return;
            }

            const current = [...this.currentChoices];
            const existingIdx = current.findIndex(c => (c as StreamableChoice).streamKey === streamKey);
            if (existingIdx >= 0) {
                current[existingIdx] = choice;
                this.choices$.next(current);
                return;
            }
            // First time: append
            this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
            return;
        }

        if (!choice.value) {
            return;
        }

        this.choices$.next([...this.currentChoices, choice].sort(sortByDisabled));
    }

    /**
     * Remove a streaming preview choice by its streamKey.
     */
    removeStreamingChoice(streamKey: string) {
        if (this.isDestroyed) {
            return;
        }
        const filtered = this.currentChoices.filter(c => (c as StreamableChoice).streamKey !== streamKey);
        this.choices$.next(filtered);
    }

    checkErrorOnChoices(shouldExit = true) {
        const nonStreamingChoices = this.choices$
            .getValue()
            .map(choice => choice as ReactiveListChoice)
            .filter(choice => !(choice as StreamableChoice).streamKey);
        const isAllError = nonStreamingChoices.every(value => value?.isError || value?.disabled);

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
