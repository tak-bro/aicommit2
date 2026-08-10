import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager, codeReviewLoader, commitMsgLoader } from '../managers/reactive-prompt.manager.js';
import { ModelName } from '../utils/config.js';
import { KnownError } from '../utils/error.js';
import { barSpinner } from '../utils/loading-bar.js';

import type { Observable, Subscription } from 'rxjs';

const consoleManager = new ConsoleManager();

/**
 * Extended ReactiveListChoice with provider metadata for selection tracking
 */
export interface CommitChoice extends ReactiveListChoice {
    provider?: string;
    model?: string;
}

/**
 * Result of commit message selection
 */
export interface CommitMessageResult {
    value: string;
    provider: string;
    model: string;
}

interface AutoChoiceRequest {
    requests$: Observable<ReactiveListChoice>;
    promptManager: ReactivePromptManager;
    loaderText: string;
    errorLogPrefix: string;
    emptyErrorMessage: string;
}

/**
 * Take the first usable choice off a request stream without mounting the interactive
 * prompt — what `--auto-select` does. Resolves on the first usable result rather than
 * waiting for every provider: with several configured, waiting for the slowest would make
 * --auto-select slower than picking from the list by hand.
 */
const resolveFirstChoice = async ({
    requests$,
    promptManager,
    loaderText,
    errorLogPrefix,
    emptyErrorMessage,
}: AutoChoiceRequest): Promise<CommitChoice> => {
    // Only the error lines are ever read back, and a review body is large enough that
    // keeping every losing choice around for the run is worth avoiding
    const errorNames: string[] = [];
    // The promise executor runs synchronously, so this is assigned before subscribing below
    let resolveSelection!: (choice: CommitChoice | null) => void;
    const selection = new Promise<CommitChoice | null>(resolve => {
        resolveSelection = resolve;
    });

    // No prompt is mounted here, so the console bar is the only feedback during the wait
    consoleManager.showLoader(loaderText, barSpinner);

    const subscription: Subscription = requests$.subscribe({
        next: (choice: ReactiveListChoice) => {
            promptManager.refreshChoices(choice);
            // Skip streaming preview/sentinel choices — only collect final results
            const isStreamingChoice = 'streamKey' in choice;
            if (isStreamingChoice) {
                return;
            }
            const settledChoice = choice as CommitChoice;
            if (settledChoice.value && !settledChoice.isError && !settledChoice.disabled) {
                resolveSelection(settledChoice);
                return;
            }
            if (settledChoice.isError && settledChoice.name) {
                errorNames.push(settledChoice.name);
            }
        },
        error: error => {
            console.error(errorLogPrefix, error);
            promptManager.checkErrorOnChoices(false);
            resolveSelection(null);
        },
        complete: () => {
            promptManager.checkErrorOnChoices(false);
            resolveSelection(null);
        },
    });

    try {
        const selected = await selection;

        consoleManager.stopLoader();

        if (!selected || !selected.value) {
            // No prompt was mounted, so nothing has rendered the per-model error lines.
            // Print them before failing — otherwise the run ends with no explanation.
            errorNames.forEach(name => consoleManager.print(name));
            throw new KnownError(emptyErrorMessage);
        }

        return selected;
    } finally {
        // Stops this process from reacting to the providers that lost the race. Streaming
        // requests are aborted on teardown; a non-streaming request is already in flight and
        // runs to completion regardless, its result simply discarded.
        subscription.unsubscribe();
    }
};

/**
 * `--auto-select` commit message pick, shared by `aicommit2` and `aicommit2 rewrite`.
 */
export const selectMessageAutomatically = async (
    aiRequestManager: AIRequestManager,
    availableAIs: ModelName[],
    commitMsgPromptManager: ReactivePromptManager
): Promise<CommitMessageResult> => {
    const selected = await resolveFirstChoice({
        requests$: aiRequestManager.createCommitMsgRequests$(availableAIs),
        promptManager: commitMsgPromptManager,
        loaderText: commitMsgLoader.startOption.text,
        errorLogPrefix: 'Commit message generation error:',
        emptyErrorMessage: 'No valid commit message was generated',
    });

    consoleManager.print(`\n${selected.name}\n`);
    return {
        value: selected.value,
        provider: selected.provider || 'unknown',
        model: selected.model || 'unknown',
    };
};

/**
 * `--auto-select` code review pick. The picker never mounts, so the review body is printed
 * in full — otherwise an opted-in review would produce no visible output at all.
 */
export const selectCodeReviewAutomatically = async (
    aiRequestManager: AIRequestManager,
    availableAIs: ModelName[],
    codeReviewPromptManager: ReactivePromptManager
): Promise<string> => {
    const selected = await resolveFirstChoice({
        requests$: aiRequestManager.createCodeReviewRequests$(availableAIs),
        promptManager: codeReviewPromptManager,
        loaderText: codeReviewLoader.startOption.text,
        errorLogPrefix: 'Code review request error:',
        emptyErrorMessage: 'An error occurred! No selected code review',
    });

    consoleManager.print(`\n${selected.name}\n\n${selected.value}\n`);
    return selected.value;
};
