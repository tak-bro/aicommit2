import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { lastValueFrom, toArray } from 'rxjs';

import { getAvailableAIs } from './get-available-ais.js';
import {
    CommitMessageResult,
    confirmCommitMessage,
    editCommitMessage,
    selectCodeReviewAutomatically,
    selectCommitMessage,
} from './select-message.js';
import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { DEFAULT_INQUIRER_OPTIONS, ReactivePromptManager, codeReviewLoader, emptyCodeReview } from '../managers/reactive-prompt.manager.js';
import { recordSelection } from '../services/stats/index.js';
import { ModelName, getConfig } from '../utils/config.js';
import { ErrorCode, ErrorMessages } from '../utils/error-messages.js';
import { CommitFailedError, KnownError, handleCliError } from '../utils/error.js';
import { MessageFlagValues, buildMessageConfigOverrides, forceMessageFlagsOnProviders, isPipedDryRun } from '../utils/message-flags.js';
import { CRITICAL_ISSUES_MARKER, validateSystemPrompt } from '../utils/prompt.js';
import { failOnClosedInput } from '../utils/utils.js';
import {
    CommitOptions,
    applyDiffCompression,
    assertGitRepo,
    getBranchName,
    getMessageSavePath,
    getRecentCommits,
    getStagedDiff,
    getVCSName,
    readSavedMessage,
    commitChanges as vcsCommitChanges,
} from '../utils/vcs.js';

import type { Ora } from 'ora';
import type { Subscription } from 'rxjs';

const consoleManager = new ConsoleManager();

export interface JsonCommitMessage {
    subject: string;
    body: string;
}

export default async (
    locale: string | undefined,
    generate: number | undefined,
    excludeFiles: string[],
    stageAll: boolean,
    commitType: string | undefined,
    confirm: boolean,
    useClipboard: boolean,
    prompt: string | undefined,
    includeBody: boolean | undefined,
    autoSelect: boolean,
    edit: boolean,
    disableLowerCase: boolean,
    verbose: boolean,
    dryRun: boolean,
    jjAutoNew: boolean,
    outputFormat: string | undefined,
    includeGenerated: boolean,
    rawArgv: string[]
) =>
    (async () => {
        const isJsonMode = outputFormat === 'json';
        // Output is already routed to stderr by cli.ts; nobody can drive the picker here
        const shouldAutoSelect = autoSelect || isPipedDryRun(dryRun, isJsonMode);

        if (!isJsonMode) {
            consoleManager.printTitle();
        }

        // QW-5: Show immediate feedback during initialization
        const initSpinner = isJsonMode ? null : consoleManager.displaySpinner('Detecting repository...');

        await assertGitRepo();
        if (stageAll) {
            if (initSpinner) {
                initSpinner.text = 'Staging changes...';
            }
            const vcsName = await getVCSName();
            if (vcsName === 'git') {
                // NOTE: should be equivalent behavior to `git commit --all` (tracked files only)
                // Independent: `--update` never touches untracked files
                await Promise.all([execa('git', ['add', '--update']), warnUntrackedFiles(initSpinner)]);
            } else if (vcsName === 'yadm') {
                // Use '--update' for YADM to only stage already-tracked files
                // This prevents accidentally staging thousands of files in the home directory
                await execa('yadm', ['add', '--update']);
            }
            // For Jujutsu, no staging needed - working copy is already staged
        }

        if (initSpinner) {
            initSpinner.text = 'Loading configuration...';
        }

        const messageFlags: MessageFlagValues = {
            locale,
            generate,
            type: commitType,
            prompt,
            includeBody,
            disableLowerCase,
            verbose,
        };

        const config = await getConfig(buildMessageConfigOverrides(messageFlags), rawArgv);

        forceMessageFlagsOnProviders(config, messageFlags);

        await validateSystemPrompt(config);

        // Build commit options - CLI flag takes precedence over config
        const commitOptions: CommitOptions = {
            autoNew: jjAutoNew || config.jjAutoNew,
        };

        if (initSpinner) {
            initSpinner.text = 'Detecting staged files...';
        }
        const staged = await getStagedDiff(excludeFiles, config.exclude, includeGenerated);
        initSpinner?.stop();

        if (!staged) {
            const vcsName = await getVCSName();
            throw new KnownError(ErrorMessages.noStagedChanges(vcsName), {
                code: ErrorCode.NO_STAGED_CHANGES,
            });
        }

        if (!isJsonMode) {
            const preview = applyDiffCompression(staged, {
                mode: config.diffCompression,
                maxHunkLines: config.maxHunkLines,
                maxDiffLines: config.maxDiffLines,
            });
            consoleManager.printStagedFiles(staged, preview.compression);
        }

        const availableAIs = getAvailableAIs(config, 'commit');
        if (availableAIs.length === 0) {
            throw new KnownError(ErrorMessages.noApiKeysConfigured(), {
                code: ErrorCode.MISSING_API_KEY,
            });
        }

        const branchName = await getBranchName();
        const recentCommits = await getRecentCommits();
        const aiRequestManager = new AIRequestManager(config, staged, branchName, recentCommits);

        // JSON output mode: skip TUI, collect all messages, output as JSON Lines
        // Each object on its own line for LazyGit menuFromCommand compatibility
        if (isJsonMode) {
            const jsonMessages = await handleJsonOutput(aiRequestManager, availableAIs);
            jsonMessages.forEach(msg => {
                process.stdout.write(JSON.stringify(msg) + '\n');
            });
            process.exit(0);
        }

        const codeReviewAIs = getAvailableAIs(config, 'review');
        if (codeReviewAIs.length > 0) {
            await handleCodeReview(aiRequestManager, codeReviewAIs, shouldAutoSelect);
        }

        // One round = pick, then edit when `-e` is set; `r` at the confirm prompt runs another
        const pickCommitMessage = async (): Promise<CommitMessageResult> => {
            const picked = await selectCommitMessage(aiRequestManager, availableAIs, shouldAutoSelect);
            return edit ? { ...picked, value: await editCommitMessage(picked.value, 'Commit') } : picked;
        };

        // Only a run that would have asked "Use selected message?" gets the confirm loop
        const isInteractiveConfirm = !dryRun && !useClipboard && !confirm && !autoSelect;
        const firstPick = await pickCommitMessage();
        const commitResult = isInteractiveConfirm ? await confirmCommitMessage(firstPick, pickCommitMessage, 'Commit') : firstPick;
        const selectedCommitMessage = commitResult.value;

        // Record selection for stats (fire-and-forget, enabled by default)
        if (config.useStats !== false) {
            recordSelection({
                provider: commitResult.provider,
                model: commitResult.model,
                statsDays: config.statsDays,
            }).catch(() => {
                // Silently ignore selection recording errors
            });
        }

        // Copy to clipboard if enabled (CLI flag or config)
        const shouldCopyToClipboard = useClipboard || config.autoCopy;
        if (shouldCopyToClipboard) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ncp = require('copy-paste');
            ncp.copy(selectedCommitMessage);
            // Only show message for CLI --clipboard (config clipboard copies silently)
            if (useClipboard) {
                consoleManager.printCopied();
            }
        }

        // CLI --clipboard: copy only, don't commit (existing behavior)
        // config clipboard: copy and continue to commit
        if (useClipboard && !dryRun) {
            process.exit();
        }

        if (dryRun) {
            process.stdout.write(selectedCommitMessage + '\n');
            process.exit();
        }

        if (isInteractiveConfirm) {
            await commitWithRetryPrompt(selectedCommitMessage, rawArgv, commitOptions);
        } else {
            await commitChanges(selectedCommitMessage, rawArgv, commitOptions);
        }
        process.exit();
    })().catch(error => {
        if (outputFormat === 'json') {
            // Machine-readable error on stdout (menuFromCommand only reads stdout),
            // human-readable error on stderr (lazygit shows stderr on non-zero exit)
            const errorMessage = error.message || 'Unknown error occurred';
            process.stdout.write(JSON.stringify({ error: errorMessage }) + '\n');
            process.stderr.write(`aicommit2: ${errorMessage}\n`);
            process.exit(1);
        }
        consoleManager.printError(error.message);
        handleCliError(error);
        process.exit(1);
    });

async function handleCodeReview(aiRequestManager: AIRequestManager, availableAIs: ModelName[], autoSelect: boolean) {
    const codeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);
    let codeReviewSubscription: Subscription | null = null;

    try {
        if (autoSelect) {
            const review = await selectCodeReviewAutomatically(aiRequestManager, availableAIs, codeReviewPromptManager);
            // The interactive path asks whether to continue on critical issues. There is no
            // prompt here, and --auto-select means the run goes through, so warn instead.
            if (review.includes(CRITICAL_ISSUES_MARKER)) {
                consoleManager.printWarning('Critical issues found in code review.');
            }
            return;
        }

        const codeReviewInquirer = codeReviewPromptManager.initPrompt({
            ...DEFAULT_INQUIRER_OPTIONS,
            name: 'codeReviewPrompt',
            message: 'Please check code reviews: ',
            emptyMessage: `⚠ ${emptyCodeReview}`,
            isDescriptionDim: false,
            stopMessage: 'Code review completed',
            descPageSize: 20,
        });

        codeReviewPromptManager.startLoader();

        codeReviewSubscription = aiRequestManager.createCodeReviewRequests$(availableAIs).subscribe({
            next: (choice: ReactiveListChoice) => codeReviewPromptManager.refreshChoices(choice),
            error: error => {
                console.error('Code review request error:', error);
                codeReviewPromptManager.checkErrorOnChoices();
            },
            complete: () => codeReviewPromptManager.checkErrorOnChoices(),
        });

        const codeReviewInquirerResult = await codeReviewInquirer;
        const selectedCodeReview = codeReviewInquirerResult.codeReviewPrompt?.value;

        if (!selectedCodeReview) {
            throw new KnownError('An error occurred! No selected code review');
        }

        consoleManager.moveCursorUp();

        const hasCritical = selectedCodeReview.includes(CRITICAL_ISSUES_MARKER);
        const confirmMessage = hasCritical
            ? 'Critical issues found in code review. Continue without fixing?'
            : 'Will you continue without changing the code?';

        const { continuePrompt } = await failOnClosedInput(
            inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'continuePrompt',
                    message: confirmMessage,
                    default: !hasCritical,
                },
            ])
        );

        if (!continuePrompt) {
            consoleManager.printCancelledCommit();
            process.exit(1);
        }
    } finally {
        if (codeReviewSubscription) {
            codeReviewSubscription.unsubscribe();
        }
        codeReviewPromptManager.destroy();
    }
}

// `-a` no longer sweeps in new files, so say so instead of letting them silently miss the commit
const warnUntrackedFiles = async (spinner: Ora | null) => {
    const { stdout } = await execa('git', ['ls-files', '--others', '--exclude-standard', '--', ':/']);
    const untrackedCount = stdout.split('\n').filter(Boolean).length;
    if (untrackedCount > 0) {
        // Clear the spinner frame first so the hint gets its own line; the next frame repaints
        spinner?.clear();
        process.stderr.write(`${untrackedCount} untracked file(s) not staged (use git add)\n`);
    }
};

/**
 * `aicommit2 --retry`: commit the message a failed commit saved, with no provider call. Runs
 * before the config is loaded, so a broken or keyless config cannot block it.
 */
export const retryCommit = async (rawArgv: string[]) => {
    const consoleManager = new ConsoleManager();
    try {
        await assertGitRepo();
        const savePath = await getMessageSavePath();
        if (!savePath) {
            throw new KnownError(ErrorMessages.retryUnsupported(await getVCSName()));
        }
        const message = await readSavedMessage(savePath);
        if (!message) {
            throw new KnownError(ErrorMessages.noSavedMessage());
        }
        // Show what is about to be committed: the saved message may be from an older attempt
        consoleManager.print(`\n${message.trim()}\n`);
        await commitChanges(message, rawArgv, {});
        process.exit(0);
    } catch (error) {
        consoleManager.printError(error instanceof Error ? error.message : String(error));
        handleCliError(error);
        process.exit(1);
    }
};

/**
 * A failed commit (typically a pre-commit hook) asks `Commit failed. Retry? (Rqh)` instead of
 * exiting, so the user can fix the problem in another pane and commit the same message. When
 * the save worked, the message is on disk before the prompt appears, so quitting or Ctrl-C
 * loses nothing; the quit label says when it did not (jj, or a failed write).
 */
const commitWithRetryPrompt = async (message: string, rawArgv: string[], options: CommitOptions) => {
    for (;;) {
        try {
            await commitChanges(message, rawArgv, options);
            return;
        } catch (error) {
            if (!(error instanceof CommitFailedError)) {
                throw error;
            }
            consoleManager.printError(error.message);
            const { action } = await failOnClosedInput(
                inquirer.prompt<{ action: 'retry' | 'quit' }>([
                    {
                        type: 'expand',
                        name: 'action',
                        message: 'Commit failed. Retry?',
                        default: 0,
                        choices: [
                            { key: 'r', name: 'Retry the commit with the same message', value: 'retry' },
                            {
                                key: 'q',
                                name: error.savedPath ? 'Quit (the message stays saved)' : 'Quit (the message is not saved)',
                                value: 'quit',
                            },
                        ],
                    },
                ])
            );
            if (action === 'quit') {
                process.exit(1);
            }
        }
    }
};

const commitChanges = async (message: string, rawArgv: string[], options: CommitOptions) => {
    await vcsCommitChanges(message, rawArgv, options);
    consoleManager.printCommitted();
};

/**
 * Handles non-interactive JSON output mode for LazyGit integration.
 * Collects all AI-generated commit messages and returns them as JSON.
 */
const handleJsonOutput = async (aiRequestManager: AIRequestManager, availableAIs: ModelName[]): Promise<JsonCommitMessage[]> => {
    const choices = await lastValueFrom(aiRequestManager.createCommitMsgRequests$(availableAIs).pipe(toArray()), { defaultValue: [] });

    const validChoices = choices.filter(choice => choice.value && !choice.isError && !choice.disabled);

    if (validChoices.length === 0) {
        throw new KnownError('No valid commit messages were generated');
    }

    return validChoices.map(({ value = '' }) => {
        const [subject = '', ...rest] = value.split('\n');
        return {
            subject,
            body: rest.join('\n').trim(),
        };
    });
};
