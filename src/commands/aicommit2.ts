import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import {
    DEFAULT_INQUIRER_OPTIONS,
    ReactivePromptManager,
    codeReviewLoader,
    commitMsgLoader,
    emptyCodeReview,
} from '../managers/reactive-prompt.manager.js';
import { RequestType } from '../utils/ai-log.js';
import { BUILTIN_SERVICES, BuiltinService, ModelName, RawConfig, ValidConfig, getConfig } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { assertGitRepo, getStagedDiff } from '../utils/git.js';
import { validateSystemPrompt } from '../utils/prompt.js';

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
                type: commitType?.toString() as string,
                systemPrompt: prompt?.toString() as string,
                includeBody: includeBody?.toString() as string,
            },
            rawArgv
        );

        // Override includeBody setting for all models when --include-body flag is present
        const shouldIncludeBody = includeBody === true || config.includeBody === true;
        if (shouldIncludeBody) {
            Object.keys(config).forEach(key => {
                if (typeof config[key] === 'object' && config[key] !== null && 'includeBody' in config[key]) {
                    (config[key] as any).includeBody = true;
                }
            });
        }

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

        const availableAIs = getAvailableAIs(config, 'commit');
        if (availableAIs.length === 0) {
            throw new KnownError('Please set at least one API key via the `aicommit2 config set` command');
        }

        const aiRequestManager = new AIRequestManager(config, staged);
        const codeReviewAIs = getAvailableAIs(config, 'review');
        if (codeReviewAIs.length > 0) {
            await handleCodeReview(aiRequestManager, codeReviewAIs);
        }

        const selectedCommitMessage = await handleCommitMessage(aiRequestManager, availableAIs, autoSelect);
        if (useClipboard) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ncp = require('copy-paste');
            ncp.copy(selectedCommitMessage);
            consoleManager.printCopied();
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

function getAvailableAIs(config: ValidConfig, requestType: RequestType): ModelName[] {
    return Object.entries(config)
        .map(([key, value]) => [key, value] as [ModelName, RawConfig])
        .filter(([key, value]) => !value.disabled)
        .filter(([key, value]) => BUILTIN_SERVICES.includes(key as BuiltinService) || value.compatible === true)
        .filter(([key, value]) => {
            switch (requestType) {
                case 'commit':
                    if (key === 'OLLAMA') {
                        return !!value && !!value.model && (value.model as string[]).length > 0;
                    }
                    if (key === 'HUGGINGFACE') {
                        return !!value && !!value.cookie;
                    }
                    return !!value.key && value.key.length > 0;
                case 'review':
                    const codeReview = config.codeReview || value.codeReview;
                    if (key === 'OLLAMA') {
                        return !!value && !!value.model && (value.model as string[]).length > 0 && codeReview;
                    }
                    if (key === 'HUGGINGFACE') {
                        return !!value && !!value.cookie && codeReview;
                    }
                    return !!value.key && value.key.length > 0 && codeReview;
            }
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
        descPageSize: 20,
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

async function handleCommitMessage(aiRequestManager: AIRequestManager, availableAIs: ModelName[], autoSelect: boolean) {
    const commitMsgPromptManager = new ReactivePromptManager(commitMsgLoader);

    // If auto-select is enabled and only 1 AI model is available, collect messages without prompt
    if (autoSelect && availableAIs.length === 1) {
        const messages: ReactiveListChoice[] = [];
        commitMsgPromptManager.startLoader();

        const commitMsgSubscription = aiRequestManager.createCommitMsgRequests$(availableAIs).subscribe(
            (choice: ReactiveListChoice) => {
                messages.push(choice);
                commitMsgPromptManager.refreshChoices(choice);
            },
            () => {
                /* empty */
            },
            () => commitMsgPromptManager.checkErrorOnChoices(false)
        );

        // Wait for all messages to be generated
        await new Promise<void>(resolve => {
            commitMsgSubscription.add(() => resolve());
        });

        commitMsgPromptManager.clearLoader();
        commitMsgPromptManager.completeSubject();

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
    await execa('git', ['commit', '-m', message, ...rawArgv], {
        stdio: 'inherit',
    });

    consoleManager.printCommitted();
}
