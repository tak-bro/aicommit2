import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager, commitMsgLoader } from '../managers/reactive-prompt.manager.js';
import { ModelName } from '../utils/config.js';
import { KnownError } from '../utils/error.js';
import { barSpinner } from '../utils/loading-bar.js';

import type { Subscription } from 'rxjs';

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

/**
 * Pick a message without mounting the interactive prompt — what `--auto-select` does for
 * both `aicommit2` and `aicommit2 rewrite`. Resolves on the first usable message rather
 * than waiting for every provider: with several configured, waiting for the slowest would
 * make --auto-select slower than picking from the list by hand.
 */
export const selectMessageAutomatically = async (
    aiRequestManager: AIRequestManager,
    availableAIs: ModelName[],
    commitMsgPromptManager: ReactivePromptManager
): Promise<CommitMessageResult> => {
    const messages: CommitChoice[] = [];
    // The promise executor runs synchronously, so this is assigned before subscribing below
    let resolveSelection!: (message: CommitChoice | null) => void;
    const selection = new Promise<CommitChoice | null>(resolve => {
        resolveSelection = resolve;
    });

    // No prompt is mounted here, so the console bar is the only feedback during the wait
    consoleManager.showLoader(commitMsgLoader.startOption.text, barSpinner);

    const commitMsgSubscription: Subscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
        next: (choice: ReactiveListChoice) => {
            commitMsgPromptManager.refreshChoices(choice);
            // Skip streaming preview/sentinel choices — only collect final results
            const isStreamingChoice = 'streamKey' in choice;
            if (isStreamingChoice) {
                return;
            }
            const commitChoice = choice as CommitChoice;
            messages.push(commitChoice);
            if (commitChoice.value && !commitChoice.isError && !commitChoice.disabled) {
                resolveSelection(commitChoice);
            }
        },
        error: error => {
            console.error('Commit message generation error:', error);
            commitMsgPromptManager.checkErrorOnChoices(false);
            resolveSelection(null);
        },
        complete: () => {
            commitMsgPromptManager.checkErrorOnChoices(false);
            resolveSelection(null);
        },
    });

    try {
        const selectedMessage = await selection;

        consoleManager.stopLoader();

        if (!selectedMessage || !selectedMessage.value) {
            // No prompt was mounted, so nothing has rendered the per-model error lines.
            // Print them before failing — otherwise the run ends with no explanation.
            messages.forEach(msg => {
                if (msg.isError && msg.name) {
                    consoleManager.print(msg.name);
                }
            });
            throw new KnownError('No valid commit message was generated');
        }

        consoleManager.print(`\n${selectedMessage.name}\n`);
        return {
            value: selectedMessage.value,
            provider: selectedMessage.provider || 'unknown',
            model: selectedMessage.model || 'unknown',
        };
    } finally {
        // Stops this process from reacting to the providers that lost the race. Streaming
        // requests are aborted on teardown; a non-streaming request is already in flight and
        // runs to completion regardless, its result simply discarded.
        commitMsgSubscription.unsubscribe();
    }
};
