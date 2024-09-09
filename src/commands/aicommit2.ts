import fs from 'fs';
import path from 'path';

import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import ora from 'ora';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import {
    DEFAULT_INQUIRER_OPTIONS,
    ReactivePromptManager,
    codeReviewLoader,
    commitMsgLoader,
    emptyCodeReview,
} from '../managers/reactive-prompt.manager.js';
import { ModelName, RawConfig, ValidConfig, getConfig, modelNames } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { assertGitRepo, getStagedDiff } from '../utils/git.js';

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
    rawArgv: string[]
) =>
    (async () => {
        consoleManager.printTitle();

        await assertGitRepo();
        if (stageAll) {
            await execa('git', ['add', '--update']); // NOTE: should be equivalent behavior to `git commit --all`
        }

        const config = await getConfig(
            {
                locale: locale?.toString() as string,
                generate: generate?.toString() as string,
                commitType: commitType?.toString() as string,
                systemPrompt: prompt?.toString() as string,
            },
            rawArgv
        );
        await validateSystemPrompt(config);

        const detectingFilesSpinner = consoleManager.displaySpinner('Detecting staged files');
        const staged = await getStagedDiff(excludeFiles, config.exclude);
        detectingFilesSpinner.stop();

        if (!staged) {
            throw new KnownError(
                'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.'
            );
        }

        consoleManager.printStagedFiles(staged);

        const availableAIs = getAvailableAIs(config);
        if (availableAIs.length === 0) {
            throw new KnownError('Please set at least one API key via the `aicommit2 config set` command');
        }

        const aiRequestManager = new AIRequestManager(config, staged);
        if (config.codeReview) {
            await handleCodeReview(aiRequestManager, availableAIs);
        }
        const selectedCommitMessage = await handleCommitMessage(aiRequestManager, availableAIs);
        if (useClipboard) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ncp = require('copy-paste');
            ncp.copy(selectedCommitMessage);
            consoleManager.printCopied();
            process.exit();
        }

        if (confirm) {
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
        consoleManager.printErrorMessage(error.message);
        handleCliError(error);
        process.exit(1);
    });

async function validateSystemPrompt(config: ValidConfig) {
    if (config.systemPromptPath) {
        try {
            fs.readFileSync(path.resolve(config.systemPromptPath), 'utf-8');
        } catch (error) {
            throw new KnownError(`Error reading system prompt file: ${config.systemPromptPath}`);
        }
    }
}

function getAvailableAIs(config: ValidConfig): ModelName[] {
    return Object.entries(config)
        .filter(([key]) => modelNames.includes(key as ModelName))
        .map(([key, value]) => [key, value] as [ModelName, RawConfig])
        .filter(([key, value]) => {
            if (key === 'OLLAMA') {
                return !!value && !!value.model && (value.model as string[]).length > 0;
            }
            if (key === 'HUGGINGFACE') {
                return !!value && !!value.cookie;
            }
            // @ts-ignore ignore
            return !!value.key && value.key.length > 0;
        })
        .map(([key]) => key);
}

async function handleCodeReview(aiRequestManager: AIRequestManager, availableAIs: ModelName[]) {
    const codeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);
    const codeReviewInquirer = codeReviewPromptManager.initPrompt({
        ...DEFAULT_INQUIRER_OPTIONS,
        name: 'codeReviewPrompt',
        message: 'Please check code reviews: ',
        emptyMessage: `⚠ ${emptyCodeReview}`,
        isDescriptionDim: false,
        stopMessage: 'Code review completed',
    });

    codeReviewPromptManager.startLoader();
    const codeReviewSubscription = aiRequestManager.createCodeReviewRequests$(availableAIs).subscribe(
        (choice: ReactiveListChoice) => codeReviewPromptManager.refreshChoices(choice),
        () => {
            /* empty */
        },
        () => codeReviewPromptManager.checkErrorOnChoices()
    );

    const codeReviewInquirerResult = await codeReviewInquirer;
    const selectedCodeReview = codeReviewInquirerResult.codeReviewPrompt?.value;
    if (!selectedCodeReview) {
        throw new KnownError('An error occurred! No selected code review');
    }
    codeReviewSubscription.unsubscribe();
    codeReviewPromptManager.completeSubject();
    consoleManager.moveCursorUp(); // NOTE: reactiveListPrompt has 2 blank lines

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
}

async function handleCommitMessage(aiRequestManager: AIRequestManager, availableAIs: ModelName[]) {
    const commitMsgPromptManager = new ReactivePromptManager(commitMsgLoader);
    const commitMsgInquirer = commitMsgPromptManager.initPrompt();

    commitMsgPromptManager.startLoader();
    const commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe(
        (choice: ReactiveListChoice) => commitMsgPromptManager.refreshChoices(choice),
        () => {
            /* empty */
        },
        () => commitMsgPromptManager.checkErrorOnChoices()
    );

    const commitMsgInquirerResult = await commitMsgInquirer;
    commitMsgSubscription.unsubscribe();
    commitMsgPromptManager.completeSubject();

    consoleManager.moveCursorUp(); // NOTE: reactiveListPrompt has 2 blank lines
    const selectedCommitMessage = commitMsgInquirerResult.aicommit2Prompt?.value;
    if (!selectedCommitMessage) {
        throw new KnownError('An error occurred! No selected message');
    }

    return selectedCommitMessage;
}

async function commitChanges(message: string, rawArgv: string[]) {
    const commitSpinner = ora('Committing with the generated message').start();
    await execa('git', ['commit', '-m', message, ...rawArgv]);
    commitSpinner.stop();
    commitSpinner.clear();
    consoleManager.printCommitted();
}
