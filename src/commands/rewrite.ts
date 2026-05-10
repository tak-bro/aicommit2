import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { command } from 'cleye';
import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

import { getAvailableAIs } from './get-available-ais.js';
import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager, commitMsgLoader } from '../managers/reactive-prompt.manager.js';
import { RawConfig, applyDisableLowerCaseToConfig, getConfig } from '../utils/config.js';
import { ErrorCode, ErrorMessages } from '../utils/error-messages.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { initializeLogger } from '../utils/logger.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import {
    applyDiffCompression,
    assertGitRepo,
    getBranchName,
    getCommitDiff,
    getCommitMessage,
    getRecentCommits,
    getVCSName,
    isCommitPushed,
    rewriteCommit as vcsRewriteCommit,
} from '../utils/vcs.js';

import type { Subscription } from 'rxjs';

const consoleManager = new ConsoleManager();

/**
 * Extended ReactiveListChoice with provider metadata for selection tracking
 */
interface RewriteChoice extends ReactiveListChoice {
    provider?: string;
    model?: string;
}

export default command(
    {
        name: 'rewrite',
        parameters: ['[commit-hash]'],
        help: {
            description: 'Rewrite the commit message of a commit using AI (defaults to HEAD)',
            examples: ['aicommit2 rewrite', 'aicommit2 rewrite -g 3', 'aicommit2 rewrite abc1234', 'aicommit2 rewrite HEAD~2 --dry-run'],
        },
        flags: {
            locale: {
                type: String,
                description: 'Locale to use for the generated commit messages (default: en)',
                alias: 'l',
            },
            generate: {
                type: Number,
                description: 'Number of messages to generate (default: 1)',
                alias: 'g',
            },
            type: {
                type: String,
                description: 'Type of commit message to generate (default: conventional)',
                alias: 't',
            },
            confirm: {
                type: Boolean,
                description: 'Skip confirmation when rewriting after message generation (default: false)',
                alias: 'y',
                default: false,
            },
            prompt: {
                type: String,
                description: 'Custom prompt to fine-tune the generated message',
                alias: 'p',
            },
            'auto-select': {
                type: Boolean,
                description: 'Automatically select the message when only one is generated',
                alias: 's',
                default: false,
            },
            edit: {
                type: Boolean,
                description: 'Open the AI-generated commit message in your default editor',
                alias: 'e',
                default: false,
            },
            verbose: {
                type: Boolean,
                description: 'Enable verbose logging for this run',
                alias: 'v',
                default: false,
            },
            'dry-run': {
                type: Boolean,
                description: 'Generate commit message without rewriting (output only)',
                alias: 'd',
                default: false,
            },
            'disable-lowercase': {
                type: Boolean,
                description: 'Disable automatic lowercase conversion of commit messages',
                default: false,
            },
        },
    },
    argv => {
        (async () => {
            consoleManager.printTitle();

            // Detect repository
            const initSpinner = consoleManager.displaySpinner('Detecting repository...');
            await assertGitRepo();

            // Verify we're in a Git repo (rewrite only supported for Git)
            const vcsName = await getVCSName();
            if (vcsName !== 'git') {
                throw new KnownError(
                    `Rewrite is only supported for Git repositories. Current VCS: ${vcsName}.\n\n` +
                        'For Jujutsu, use: jj describe -m "new message"\n' +
                        'For YADM, use: yadm commit --amend -m "new message"'
                );
            }

            // Resolve commit hash (default to HEAD)
            const commitHash: string = argv._.commitHash || 'HEAD';

            // Validate commit hash if not HEAD
            if (commitHash !== 'HEAD') {
                initSpinner.text = 'Validating commit reference...';
                try {
                    await execa('git', ['rev-parse', '--verify', `${commitHash}^{commit}`]);
                } catch {
                    throw new KnownError(
                        `Invalid commit reference: ${commitHash}.\n\n` +
                            'Provide a valid commit hash, branch name, or relative reference (e.g., HEAD~2).'
                    );
                }
            }

            initSpinner.text = 'Loading configuration...';

            const configOverrides: RawConfig = {
                locale: argv.flags.locale?.toString() as string,
                generate: argv.flags.generate?.toString() as string,
                type: argv.flags.type?.toString() as string,
                systemPrompt: argv.flags.prompt?.toString() as string,
                ...(argv.flags['disable-lowercase'] === true && { disableLowerCase: 'true' }),
            };

            if (argv.flags.verbose) {
                configOverrides.logLevel = 'verbose';
            }

            const config = await getConfig(configOverrides, []);

            await initializeLogger(config);

            if (argv.flags['disable-lowercase']) {
                applyDisableLowerCaseToConfig(config);
            }

            await validateSystemPrompt(config);

            // Get the target commit's diff and current message
            initSpinner.text = 'Reading commit information...';
            const commitDiff = await getCommitDiff(commitHash);
            initSpinner.stop();

            if (!commitDiff) {
                throw new KnownError(
                    `Could not retrieve the diff for commit ${commitHash}.\n\n` +
                        'Make sure the commit hash is correct and the commit exists.',
                    { code: ErrorCode.VCS_NOT_FOUND }
                );
            }

            const currentMessage = await getCommitMessage(commitHash);
            if (!currentMessage) {
                throw new KnownError(
                    `Could not retrieve the commit message for ${commitHash}.\n\n` +
                        'Make sure the commit hash is correct and the commit exists.'
                );
            }

            // Show current message and diff summary
            const isHead = commitHash === 'HEAD';
            consoleManager.printInfo(`${isHead ? 'Current' : `Commit ${commitHash}`} commit message:\n  ${currentMessage}\n`);
            const preview = applyDiffCompression(commitDiff, {
                mode: config.diffCompression,
                maxHunkLines: config.maxHunkLines,
                maxDiffLines: config.maxDiffLines,
            });
            consoleManager.printStagedFiles(commitDiff, preview.compression);

            // Get available AIs for commit message generation
            const availableAIs = getAvailableAIs(config, 'commit');
            if (availableAIs.length === 0) {
                throw new KnownError(ErrorMessages.noApiKeysConfigured(), {
                    code: ErrorCode.MISSING_API_KEY,
                });
            }

            const branchName = await getBranchName();
            const recentCommits = await getRecentCommits();
            const aiRequestManager = new AIRequestManager(config, commitDiff, branchName, recentCommits);

            const autoSelect = argv.flags['auto-select'] || false;
            const edit = argv.flags.edit || false;
            const confirm = argv.flags.confirm || false;
            const dryRun = argv.flags['dry-run'] || false;

            // Generate and select new commit message
            const commitMsgPromptManager = new ReactivePromptManager(commitMsgLoader);
            let commitMsgSubscription: Subscription | null = null;

            try {
                // Store choices with metadata for later lookup
                const choiceMap = new Map<string, RewriteChoice>();

                const commitMsgInquirer = commitMsgPromptManager.initPrompt();

                commitMsgPromptManager.startLoader();

                let receivedCount = 0;

                commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe({
                    next: (choice: ReactiveListChoice) => {
                        const rewriteChoice = choice as RewriteChoice;
                        if (rewriteChoice.value) {
                            choiceMap.set(rewriteChoice.value, rewriteChoice);
                        }

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

                const selectedValue = commitMsgInquirerResult.aicommit2Prompt?.value;
                if (!selectedValue) {
                    throw new KnownError('An error occurred! No selected message');
                }

                const selectedChoice = choiceMap.get(selectedValue);
                let selectedMessage = selectedValue;

                if (edit) {
                    consoleManager.printInfo('Opening editor to modify commit message...');
                    selectedMessage = await openEditor(selectedMessage);

                    if (!selectedMessage.trim()) {
                        throw new KnownError(ErrorMessages.emptyCommitMessage(), {
                            code: ErrorCode.EMPTY_COMMIT_MESSAGE,
                        });
                    }

                    consoleManager.printSuccess('Commit message edited successfully!');
                    consoleManager.print(`\n${selectedMessage}\n`);
                }

                // Dry run: output only, don't rewrite
                if (dryRun) {
                    process.stdout.write(selectedMessage + '\n');
                    process.exit();
                }

                // Auto-select or confirm
                if (confirm || (autoSelect && availableAIs.length === 1)) {
                    await performRewrite(selectedMessage, commitHash);
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
                    await performRewrite(selectedMessage, commitHash);
                } else {
                    consoleManager.printCancelledCommit();
                }
                process.exit();
            } finally {
                if (commitMsgSubscription) {
                    commitMsgSubscription.unsubscribe();
                }
                commitMsgPromptManager.destroy();
            }
        })().catch(error => {
            consoleManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);

/**
 * Rewrite the commit message, with a push warning.
 */
async function performRewrite(message: string, commitHash: string): Promise<void> {
    const pushed = await isCommitPushed(commitHash);
    if (pushed) {
        const isHead = commitHash === 'HEAD';
        consoleManager.printWarning(
            `⚠  ${isHead ? 'The HEAD' : `Commit ${commitHash.slice(0, 7)}`} appears to have been pushed to the remote.\n` +
                '   Rewriting will change its hash. You will need to force push:\n' +
                '     git push --force-with-lease'
        );

        const { proceed } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'proceed',
                message: 'Continue with rewrite anyway?',
                default: false,
            },
        ]);

        if (!proceed) {
            consoleManager.printCancelledCommit();
            process.exit();
        }
    }

    await vcsRewriteCommit(message, commitHash);
    consoleManager.printSuccess('Commit message rewritten successfully!');
}

/**
 * Open the commit message in the user's default editor for editing.
 */
async function openEditor(message: string): Promise<string> {
    const editor = process.env.VISUAL || process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'vi');
    const tempFile = path.join(os.tmpdir(), `aicommit2-rewrite-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.txt`);

    try {
        fs.writeFileSync(tempFile, message, 'utf8');

        const editorParts = editor.split(' ');
        const [binary, ...flags] = editorParts;

        await execa(binary, [...flags, tempFile], { stdio: 'inherit' });

        const editedMessage = fs.readFileSync(tempFile, 'utf8').trim();
        fs.unlinkSync(tempFile);

        if (!editedMessage) {
            throw new KnownError('Rewrite cancelled - empty message');
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
                throw new KnownError('Rewrite cancelled');
            }
        }

        throw new KnownError(`Failed to open editor "${editor}". Please set your EDITOR or VISUAL environment variable.`);
    }
}
