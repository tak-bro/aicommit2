import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { lastValueFrom, toArray } from 'rxjs';

import { getAvailableAIs } from './get-available-ais.js';
import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import {
    DEFAULT_INQUIRER_OPTIONS,
    ReactivePromptManager,
    codeReviewLoader,
    commitMsgLoader,
    emptyCodeReview,
} from '../managers/reactive-prompt.manager.js';
import { recordSelection } from '../services/stats/index.js';
import { ModelName, RawConfig, applyDisableLowerCaseToConfig, applyIncludeBodyToConfig, getConfig } from '../utils/config.js';
import { ErrorCode, ErrorMessages } from '../utils/error-messages.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import { CommitOptions, assertGitRepo, getBranchName, getStagedDiff, getVCSName, commitChanges as vcsCommitChanges } from '../utils/vcs.js';

import type { Subscription } from 'rxjs';

const consoleManager = new ConsoleManager();

export interface JsonCommitMessage {
    subject: string;
    body: string;
}

/**
 * Extended ReactiveListChoice with provider metadata for selection tracking
 */
interface CommitChoice extends ReactiveListChoice {
    provider?: string;
    model?: string;
}

/**
 * Result of commit message selection
 */
interface CommitMessageResult {
    value: string;
    provider: string;
    model: string;
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
    rawArgv: string[]
) =>
    (async () => {
        const isJsonMode = outputFormat === 'json';

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
                // Use 'git add .' to stage all changes including untracked files in the project directory
                // This is safe for Git projects (unlike YADM in home directory)
                await execa('git', ['add', '.']);
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

        const configOverrides: RawConfig = {
            locale: locale?.toString() as string,
            generate: generate?.toString() as string,
            type: commitType?.toString() as string,
            systemPrompt: prompt?.toString() as string,
            ...(includeBody === true && { includeBody: 'true' }),
            ...(disableLowerCase === true && { disableLowerCase: 'true' }),
        };

        if (verbose) {
            configOverrides.logLevel = 'verbose';
        }

        const config = await getConfig(configOverrides, rawArgv);

        const shouldIncludeBody = includeBody === true || config.includeBody === true;
        if (shouldIncludeBody) {
            applyIncludeBodyToConfig(config);
        }

        if (disableLowerCase) {
            applyDisableLowerCaseToConfig(config);
        }

        await validateSystemPrompt(config);

        // Build commit options - CLI flag takes precedence over config
        const commitOptions: CommitOptions = {
            autoNew: jjAutoNew || config.jjAutoNew,
        };

        if (initSpinner) {
            initSpinner.text = 'Detecting staged files...';
        }
        const staged = await getStagedDiff(excludeFiles, config.exclude);
        initSpinner?.stop();

        if (!staged) {
            const vcsName = await getVCSName();
            throw new KnownError(ErrorMessages.noStagedChanges(vcsName), {
                code: ErrorCode.NO_STAGED_CHANGES,
            });
        }

        if (!isJsonMode) {
            consoleManager.printStagedFiles(staged, {
                mode: config.diffCompression,
                maxHunkLines: config.maxHunkLines,
                maxDiffLines: config.maxDiffLines,
            });
        }

        const availableAIs = getAvailableAIs(config, 'commit');
        if (availableAIs.length === 0) {
            throw new KnownError(ErrorMessages.noApiKeysConfigured(), {
                code: ErrorCode.MISSING_API_KEY,
            });
        }

        const branchName = await getBranchName();
        const aiRequestManager = new AIRequestManager(config, staged, branchName);

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
            await handleCodeReview(aiRequestManager, codeReviewAIs);
        }

        const commitResult = await handleCommitMessage(aiRequestManager, availableAIs, autoSelect);

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

        let selectedCommitMessage = commitResult.value;

        if (edit) {
            consoleManager.printInfo('Opening editor to modify commit message...');
            selectedCommitMessage = await openEditor(selectedCommitMessage);

            if (!selectedCommitMessage.trim()) {
                throw new KnownError(ErrorMessages.emptyCommitMessage(), {
                    code: ErrorCode.EMPTY_COMMIT_MESSAGE,
                });
            }

            consoleManager.printSuccess('Commit message edited successfully!');
            consoleManager.print(`\n${selectedCommitMessage}\n`);
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

        if (confirm || (autoSelect && availableAIs.length === 1)) {
            await commitChanges(selectedCommitMessage, rawArgv, commitOptions);
            process.exit();
        }

        const { confirmationPrompt } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmationPrompt',
                message: `Use selected message?`,
                default: true,
            },
        ]);

        if (confirmationPrompt) {
            await commitChanges(selectedCommitMessage, rawArgv, commitOptions);
        } else {
            consoleManager.printCancelledCommit();
        }
        process.exit();
    })().catch(error => {
        if (outputFormat === 'json') {
            // Output error as JSON for LazyGit integration
            const errorJson = { error: error.message || 'Unknown error occurred' };
            process.stderr.write(JSON.stringify(errorJson) + '\n');
            process.exit(1);
        }
        consoleManager.printError(error.message);
        handleCliError(error);
        process.exit(1);
    });

async function handleCodeReview(aiRequestManager: AIRequestManager, availableAIs: ModelName[]) {
    const codeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);
    let codeReviewSubscription: Subscription | null = null;

    try {
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

        const hasCritical = selectedCodeReview.includes('<!-- HAS_CRITICAL_ISSUES -->');
        const confirmMessage = hasCritical
            ? 'Critical issues found in code review. Continue without fixing?'
            : 'Will you continue without changing the code?';

        const { continuePrompt } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'continuePrompt',
                message: confirmMessage,
                default: !hasCritical,
            },
        ]);

        if (!continuePrompt) {
            consoleManager.printCancelledCommit();
            process.exit();
        }
    } finally {
        if (codeReviewSubscription) {
            codeReviewSubscription.unsubscribe();
        }
        codeReviewPromptManager.destroy();
    }
}

const handleCommitMessage = async (
    aiRequestManager: AIRequestManager,
    availableAIs: ModelName[],
    autoSelect: boolean
): Promise<CommitMessageResult> => {
    const commitMsgPromptManager = new ReactivePromptManager(commitMsgLoader);
    let commitMsgSubscription: Subscription | null = null;

    try {
        if (autoSelect && availableAIs.length === 1) {
            const messages: CommitChoice[] = [];
            commitMsgPromptManager.startLoader();

            commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
                next: (choice: ReactiveListChoice) => {
                    // Skip streaming preview/sentinel choices — only collect final results
                    const isStreamingChoice = 'streamKey' in choice;
                    if (!isStreamingChoice) {
                        messages.push(choice as CommitChoice);
                    }
                    commitMsgPromptManager.refreshChoices(choice);
                },
                error: error => {
                    console.error('Commit message generation error:', error);
                    commitMsgPromptManager.checkErrorOnChoices(false);
                },
                complete: () => commitMsgPromptManager.checkErrorOnChoices(false),
            });

            await new Promise<void>(resolve => {
                commitMsgSubscription?.add(() => resolve());
            });

            commitMsgPromptManager.clearLoader();

            consoleManager.moveCursorUp(); // NOTE: reactiveListPrompt has 2 blank lines
            const validMessage = messages.find(msg => msg.value && !msg.isError && !msg.disabled);
            if (!validMessage || !validMessage.value) {
                throw new KnownError('No valid commit message was generated');
            }

            consoleManager.print(`\n${validMessage.name}\n`);
            return {
                value: validMessage.value,
                provider: validMessage.provider || 'unknown',
                model: validMessage.model || 'unknown',
            };
        }

        // Store choices with metadata for later lookup
        const choiceMap = new Map<string, CommitChoice>();

        const commitMsgInquirer = commitMsgPromptManager.initPrompt();

        commitMsgPromptManager.startLoader();

        // QW-3: Track received messages to show progress in loader
        let receivedCount = 0;

        commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
            next: (choice: ReactiveListChoice) => {
                const commitChoice = choice as CommitChoice;
                // Store choice by value for lookup after selection
                if (commitChoice.value) {
                    choiceMap.set(commitChoice.value, commitChoice);
                }

                // Update loader with response progress
                const isValidResponse = choice.value && !choice.isError && !choice.disabled;
                if (isValidResponse) {
                    receivedCount++;
                    commitMsgPromptManager.updateLoaderText(
                        `AI is analyzing your changes (${receivedCount} message${receivedCount > 1 ? 's' : ''} generated)`
                    );
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

async function openEditor(message: string): Promise<string> {
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

        await execa(binary, [...flags, tempFile], { stdio: 'inherit' });

        const editedMessage = fs.readFileSync(tempFile, 'utf8').trim();
        fs.unlinkSync(tempFile);

        if (!editedMessage) {
            throw new KnownError('Commit cancelled - empty message');
        }

        return editedMessage;
    } catch (error) {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }

        if (error instanceof KnownError) {
            throw error;
        }

        if (error && typeof error === 'object' && 'exitCode' in error) {
            if ((error as any).exitCode !== 0) {
                throw new KnownError('Commit cancelled');
            }
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
}

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
