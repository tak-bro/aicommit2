import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

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
import { ModelName, RawConfig, getConfig } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import { assertGitRepo, getBranchName, getStagedDiff, getVCSName, commitChanges as vcsCommitChanges } from '../utils/vcs.js';

import type { Subscription } from 'rxjs';

const consoleManager = new ConsoleManager();

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
    rawArgv: string[]
) =>
    (async () => {
        consoleManager.printTitle();

        await assertGitRepo();
        if (stageAll) {
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
            Object.keys(config).forEach(key => {
                if (typeof config[key] === 'object' && config[key] !== null && 'includeBody' in config[key]) {
                    (config[key] as any).includeBody = true;
                }
            });
        }

        if (disableLowerCase) {
            Object.keys(config).forEach(key => {
                if (typeof config[key] === 'object' && config[key] !== null && 'disableLowerCase' in config[key]) {
                    (config[key] as any).disableLowerCase = true;
                }
            });
        }

        await validateSystemPrompt(config);

        const detectingFilesSpinner = consoleManager.displaySpinner('Detecting staged files');
        const staged = await getStagedDiff(excludeFiles, config.exclude);
        detectingFilesSpinner.stop();

        if (!staged) {
            const vcsName = await getVCSName();
            let errorMessage = 'No staged changes found.';

            if (vcsName === 'yadm') {
                errorMessage += '\n\nStage your changes with: yadm add <file>';
                errorMessage += '\nOr stage tracked file modifications: aicommit2 --all';
                errorMessage += '\n\nNote: The --all flag only stages already-tracked files (YADM best practice).';
                errorMessage += '\nTo track new dotfiles, explicitly add them first: yadm add <file>';
            } else if (vcsName === 'git') {
                errorMessage += '\n\nStage your changes with: git add <file>';
                errorMessage += '\nOr automatically stage all changes: aicommit2 --all';
            } else if (vcsName === 'jujutsu') {
                errorMessage += '\n\nJujutsu automatically tracks all changes in the working copy.';
                errorMessage += '\nMake some changes to your files and try again.';
            }

            throw new KnownError(errorMessage);
        }

        consoleManager.printStagedFiles(staged);

        const availableAIs = getAvailableAIs(config, 'commit');
        if (availableAIs.length === 0) {
            throw new KnownError('Please set at least one API key via the `aicommit2 config set` command');
        }

        const branchName = await getBranchName();
        const aiRequestManager = new AIRequestManager(config, staged, branchName);
        const codeReviewAIs = getAvailableAIs(config, 'review');
        if (codeReviewAIs.length > 0) {
            await handleCodeReview(aiRequestManager, codeReviewAIs);
        }

        let selectedCommitMessage = await handleCommitMessage(aiRequestManager, availableAIs, autoSelect);

        if (edit) {
            consoleManager.printInfo('Opening editor to modify commit message...');
            selectedCommitMessage = await openEditor(selectedCommitMessage);

            if (!selectedCommitMessage.trim()) {
                throw new KnownError('Commit message cannot be empty');
            }

            consoleManager.printSuccess('Commit message edited successfully!');
            consoleManager.print(`\n${selectedCommitMessage}\n`);
        }

        if (useClipboard) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ncp = require('copy-paste');
            ncp.copy(selectedCommitMessage);
            consoleManager.printCopied();
            if (!dryRun) {
                process.exit();
            }
        }

        if (dryRun) {
            process.stdout.write(selectedCommitMessage + '\n');
            process.exit();
        }

        if (confirm || (autoSelect && availableAIs.length === 1)) {
            await commitChanges(selectedCommitMessage, rawArgv);
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
            await commitChanges(selectedCommitMessage, rawArgv);
        } else {
            consoleManager.printCancelledCommit();
        }
        process.exit();
    })().catch(error => {
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

        const { continuePrompt } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'continuePrompt',
                message: `Will you continue without changing the code?`,
                default: true,
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

async function handleCommitMessage(aiRequestManager: AIRequestManager, availableAIs: ModelName[], autoSelect: boolean) {
    const commitMsgPromptManager = new ReactivePromptManager(commitMsgLoader);
    let commitMsgSubscription: Subscription | null = null;

    try {
        if (autoSelect && availableAIs.length === 1) {
            const messages: ReactiveListChoice[] = [];
            commitMsgPromptManager.startLoader();

            commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
                next: (choice: ReactiveListChoice) => {
                    messages.push(choice);
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
            return validMessage.value;
        }

        const commitMsgInquirer = commitMsgPromptManager.initPrompt();

        commitMsgPromptManager.startLoader();
        commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
            next: (choice: ReactiveListChoice) => commitMsgPromptManager.refreshChoices(choice),
            error: error => {
                console.error('Commit message generation error:', error);
                commitMsgPromptManager.checkErrorOnChoices();
            },
            complete: () => commitMsgPromptManager.checkErrorOnChoices(),
        });

        const commitMsgInquirerResult = await commitMsgInquirer;

        consoleManager.moveCursorUp(); // NOTE: reactiveListPrompt has 2 blank lines
        const selectedCommitMessage = commitMsgInquirerResult.aicommit2Prompt?.value;
        if (!selectedCommitMessage) {
            throw new KnownError('An error occurred! No selected message');
        }

        return selectedCommitMessage;
    } finally {
        if (commitMsgSubscription) {
            commitMsgSubscription.unsubscribe();
        }
        commitMsgPromptManager.destroy();
    }
}

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

async function commitChanges(message: string, rawArgv: string[]) {
    await vcsCommitChanges(message, rawArgv);
    consoleManager.printCommitted();
}
