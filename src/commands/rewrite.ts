import { command } from 'cleye';
import { execa } from 'execa';
import inquirer from 'inquirer';

import { getAvailableAIs } from './get-available-ais.js';
import { CommitMessageResult, confirmCommitMessage, editCommitMessage, selectCommitMessage } from './select-message.js';
import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { getConfig } from '../utils/config.js';
import { ErrorCode, ErrorMessages } from '../utils/error-messages.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { initializeLogger } from '../utils/logger.js';
import {
    MessageFlagValues,
    buildMessageConfigOverrides,
    forceMessageFlagsOnProviders,
    isPipedDryRun,
    routeConsoleToStderr,
    sharedMessageFlags,
} from '../utils/message-flags.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import { failOnClosedInput } from '../utils/utils.js';
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

const consoleManager = new ConsoleManager();

export default command(
    {
        name: 'rewrite',
        parameters: ['[commit-hash]'],
        help: {
            description: 'Rewrite the commit message of a commit using AI (defaults to HEAD)',
            examples: ['aicommit2 rewrite', 'aicommit2 rewrite -g 3', 'aicommit2 rewrite abc1234', 'aicommit2 rewrite HEAD~2 --dry-run'],
        },
        flags: {
            ...sharedMessageFlags,
            confirm: {
                type: Boolean,
                description: 'Skip confirmation when rewriting after message generation (default: false)',
                alias: 'y',
                default: false,
            },
            'dry-run': {
                type: Boolean,
                description: 'Generate commit message without rewriting (output only)',
                alias: 'd',
                default: false,
            },
        },
    },
    argv => {
        (async () => {
            const pipedDryRun = isPipedDryRun(argv.flags['dry-run'] || false);
            if (pipedDryRun) {
                routeConsoleToStderr();
            }

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

            const messageFlags: MessageFlagValues = {
                locale: argv.flags.locale,
                generate: argv.flags.generate,
                type: argv.flags.type,
                prompt: argv.flags.prompt,
                includeBody: argv.flags['include-body'],
                disableLowerCase: argv.flags['disable-lowercase'],
                verbose: argv.flags.verbose,
            };

            const config = await getConfig(buildMessageConfigOverrides(messageFlags), []);

            await initializeLogger(config);

            forceMessageFlagsOnProviders(config, messageFlags);

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
            // Exclude the target commit from "recent commits" context so the AI doesn't
            // see the old message it's being asked to replace and unconsciously mirror it.
            const recentCommits = await getRecentCommits(5, commitHash);
            const aiRequestManager = new AIRequestManager(config, commitDiff, branchName, recentCommits);

            const autoSelect = argv.flags['auto-select'] || pipedDryRun;
            const edit = argv.flags.edit || false;
            const confirm = argv.flags.confirm || false;
            const dryRun = argv.flags['dry-run'] || false;

            // One round = pick, then edit when `-e` is set; `r` at the confirm prompt runs another
            const pickRewriteMessage = async (): Promise<CommitMessageResult> => {
                const picked = await selectCommitMessage(aiRequestManager, availableAIs, autoSelect);
                return edit ? { ...picked, value: await editCommitMessage(picked.value, 'Rewrite') } : picked;
            };

            // Only a run that would have asked "Use selected message?" gets the confirm loop
            const isInteractiveConfirm = !dryRun && !confirm && !autoSelect;
            const firstPick = await pickRewriteMessage();
            const { value: selectedMessage } = isInteractiveConfirm
                ? await confirmCommitMessage(firstPick, pickRewriteMessage, 'Rewrite')
                : firstPick;

            if (dryRun) {
                process.stdout.write(selectedMessage + '\n');
                return;
            }

            await performRewrite(selectedMessage, commitHash);
        })().catch(error => {
            consoleManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);

/**
 * Rewrite the commit message, warning the user if the commit is already pushed.
 * Declining the warning exits 1: nothing was rewritten.
 */
const performRewrite = async (message: string, commitHash: string): Promise<void> => {
    const pushed = await isCommitPushed(commitHash);
    if (pushed) {
        const isHead = commitHash === 'HEAD';
        consoleManager.printWarning(
            `${isHead ? 'The HEAD' : `Commit ${commitHash.slice(0, 7)}`} appears to have been pushed to the remote.\n` +
                '   Rewriting will change its hash. You will need to force push:\n' +
                '     git push --force-with-lease'
        );

        const { proceed } = await failOnClosedInput(
            inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'proceed',
                    message: 'Continue with rewrite anyway?',
                    default: false,
                },
            ])
        );

        if (!proceed) {
            consoleManager.printCancelledCommit();
            process.exit(1);
        }
    }

    await vcsRewriteCommit(message, commitHash);
    consoleManager.printSuccess('Commit message rewritten successfully!');
};
