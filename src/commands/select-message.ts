import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager, codeReviewLoader, commitMsgLoader } from '../managers/reactive-prompt.manager.js';
import { ModelName } from '../utils/config.js';
import { KnownError } from '../utils/error.js';
import { barSpinner } from '../utils/loading-bar.js';
import { failOnClosedInput } from '../utils/utils.js';

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

/**
 * The commit message picker, or the first usable message under `--auto-select`. Each call
 * builds its own prompt manager, since one is single-use after `destroy()`.
 */
export const selectCommitMessage = async (
    aiRequestManager: AIRequestManager,
    availableAIs: ModelName[],
    autoSelect: boolean
): Promise<CommitMessageResult> => {
    const commitMsgPromptManager = new ReactivePromptManager(commitMsgLoader);
    let commitMsgSubscription: Subscription | null = null;

    try {
        if (autoSelect) {
            return await selectMessageAutomatically(aiRequestManager, availableAIs, commitMsgPromptManager);
        }

        // Store choices with metadata for later lookup
        const choiceMap = new Map<string, CommitChoice>();
        // Progress shown next to the bar as (done/total): final results (including error
        // entries) over the number of AI requests in flight. Streaming previews excluded.
        const totalRequests = aiRequestManager.countRequests(availableAIs);
        let settledRequests = 0;

        // Mount the prompt up front. The library's loading bar hides the question while the
        // list is empty, so there is no premature "Pick a commit message" + empty list — the
        // bar animates through generation and the list fills in as messages stream.
        const commitMsgInquirer = commitMsgPromptManager.initPrompt();
        // Single emission: carries both `isLoading: true` and the initial (0/N) progress.
        commitMsgPromptManager.updateLoaderProgress(settledRequests, totalRequests);

        commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
            // CommitChoice only adds optional provider/model fields, so every emitted choice fits it
            next: (choice: CommitChoice) => {
                if (choice.value) {
                    choiceMap.set(choice.value, choice);
                }
                const isFinalResult = !('streamKey' in choice);
                if (isFinalResult && settledRequests < totalRequests) {
                    settledRequests++;
                    commitMsgPromptManager.updateLoaderProgress(settledRequests, totalRequests);
                }
                commitMsgPromptManager.refreshChoices(choice);
            },
            error: error => {
                console.error('Commit message generation error:', error);
                commitMsgPromptManager.checkErrorOnChoices();
            },
            complete: () => commitMsgPromptManager.checkErrorOnChoices(),
        });

        const commitMsgInquirerResult = await commitMsgInquirer;

        consoleManager.moveCursorUp(); // NOTE: reactiveListPrompt has 2 blank lines
        const selectedValue = commitMsgInquirerResult.aicommit2Prompt?.value;
        if (!selectedValue) {
            throw new KnownError('An error occurred! No selected message');
        }

        // Look up the selected choice to get provider metadata
        const selectedChoice = choiceMap.get(selectedValue);

        return {
            value: selectedValue,
            provider: selectedChoice?.provider || 'unknown',
            model: selectedChoice?.model || 'unknown',
        };
    } finally {
        if (commitMsgSubscription) {
            commitMsgSubscription.unsubscribe();
        }
        commitMsgPromptManager.destroy();
    }
};

/** What the edited message is for; it names the cancelled action in editor errors */
type EditAction = 'Commit' | 'Rewrite';

const openEditor = async (message: string, action: EditAction): Promise<string> => {
    const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
    // Add random suffix to prevent file name collisions
    const tempFile = path.join(os.tmpdir(), `aicommit2-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.txt`);

    try {
        fs.writeFileSync(tempFile, message, 'utf8');

        // Parse EDITOR string to handle flags (e.g., "zed --new --wait")
        // Simple space-split handles most cases while being more secure than shell interpolation
        // Previously failed because execa() treated entire string as binary name
        // See: https://github.com/tak-bro/aicommit2/issues/197
        const editorParts = editor.split(' ');
        const [binary, ...flags] = editorParts;

        // With stdout captured (`$(aicommit2 -d -e)`), draw the editor on stderr so its screen
        // does not end up in the captured message
        await execa(binary, [...flags, tempFile], { stdio: ['inherit', process.stdout.isTTY ? 'inherit' : process.stderr, 'inherit'] });

        const editedMessage = fs.readFileSync(tempFile, 'utf8').trim();
        fs.unlinkSync(tempFile);

        if (!editedMessage) {
            throw new KnownError(`${action} cancelled - empty message`);
        }

        return editedMessage;
    } catch (error) {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

        if (error instanceof KnownError) {
            throw error;
        }

        // execa sets `exitCode: undefined` both when the editor never started (spawn error) and
        // when a signal killed it, so a cancel is a real non-zero exit or a signal; the rest is a
        // failure to start the editor
        const isExecaError = error && typeof error === 'object';
        const exitedNonZero = isExecaError && 'exitCode' in error && typeof error.exitCode === 'number' && error.exitCode !== 0;
        const killedBySignal = isExecaError && 'signal' in error && typeof error.signal === 'string';
        if (exitedNonZero || killedBySignal) {
            throw new KnownError(`${action} cancelled`);
        }

        const hasEditorEnv = process.env.VISUAL || process.env.EDITOR;
        if (!hasEditorEnv) {
            throw new KnownError(
                `Failed to open editor "${editor}". Please set your EDITOR or VISUAL environment variable to a valid editor command.`
            );
        } else {
            throw new KnownError(
                `Failed to open editor "${editor}". Please check:\n` +
                    '  - Editor binary exists in PATH\n' +
                    '  - Editor flags are correct\n' +
                    '  - EDITOR/VISUAL is set correctly'
            );
        }
    }
};

export const editCommitMessage = async (message: string, action: EditAction): Promise<string> => {
    consoleManager.printInfo('Opening editor to modify commit message...');
    // openEditor already throws `<action> cancelled - empty message` for an emptied file
    const edited = await openEditor(message, action);
    consoleManager.printSuccess('Commit message edited successfully!');
    consoleManager.print(`\n${edited}\n`);
    return edited;
};

type ConfirmAction = 'yes' | 'no' | 'edit' | 'regenerate';

/**
 * `Use selected message? (Ynerh)`: commit, cancel, edit then commit, or pick from a new round.
 * `r` reuses the staged diff and config, and skips the code review that already ran.
 */
export const confirmCommitMessage = async (
    initial: CommitMessageResult,
    pickAgain: () => Promise<CommitMessageResult>,
    editAction: EditAction
): Promise<CommitMessageResult> => {
    // `h` lists these labels, so a rewrite should not offer to "commit"
    const verb = editAction.toLowerCase();
    let current = initial;
    for (;;) {
        const { action } = await failOnClosedInput(
            inquirer.prompt<{ action: ConfirmAction }>([
                {
                    type: 'expand',
                    name: 'action',
                    message: 'Use selected message?',
                    default: 0,
                    choices: [
                        { key: 'y', name: `Yes, ${verb}`, value: 'yes' },
                        { key: 'n', name: 'No, cancel', value: 'no' },
                        { key: 'e', name: `Edit, then ${verb}`, value: 'edit' },
                        { key: 'r', name: 'Regenerate', value: 'regenerate' },
                    ],
                },
            ])
        );

        if (action === 'yes') {
            return current;
        }
        if (action === 'no') {
            consoleManager.printCancelledCommit();
            // Nothing was committed, so `aicommit2 && git push` must not continue
            process.exit(1);
        }
        if (action === 'edit') {
            return { ...current, value: await editCommitMessage(current.value, editAction) };
        }
        current = await pickAgain();
    }
};
