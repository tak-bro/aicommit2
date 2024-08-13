import fs from 'fs';
import path from 'path';

import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import ora from 'ora';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager } from '../managers/reactive-prompt.manager.js';
import { ModelName, RawConfig, getConfig, modelNames } from '../utils/config.js';
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

        const detectingFilesSpinner = consoleManager.displaySpinner('Detecting staged files');
        const staged = await getStagedDiff(excludeFiles);
        detectingFilesSpinner.stop();
        if (!staged) {
            throw new KnownError(
                'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.'
            );
        }
        consoleManager.printStagedFiles(staged);

        const config = await getConfig(
            {
                locale: locale?.toString() as string,
                generate: generate?.toString() as string,
                commitType: commitType?.toString() as string,
                systemPrompt: prompt?.toString() as string,
            },
            rawArgv
        );

        if (config.systemPromptPath) {
            try {
                fs.readFileSync(path.resolve(config.systemPromptPath), 'utf-8');
            } catch (error) {
                throw new KnownError(`Error reading system prompt file: ${config.systemPromptPath}`);
            }
        }

        const availableAIs: ModelName[] = Object.entries(config)
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

        const hasNoAvailableAIs = availableAIs.length === 0;
        if (hasNoAvailableAIs) {
            throw new KnownError('Please set at least one API key via the `aicommit2 config set` command');
        }

        const aiRequestManager = new AIRequestManager(config, staged);
        const reactivePromptManager = new ReactivePromptManager();
        const selectPrompt = reactivePromptManager.initPrompt();

        reactivePromptManager.startLoader();
        const subscription = aiRequestManager.createAIRequests$(availableAIs).subscribe(
            (choice: ReactiveListChoice) => reactivePromptManager.refreshChoices(choice),
            () => {
                /* empty */
            },
            () => reactivePromptManager.checkErrorOnChoices()
        );
        const answer = await selectPrompt;
        subscription.unsubscribe();
        reactivePromptManager.completeSubject();

        // NOTE: reactiveListPrompt has 2 blank lines
        consoleManager.moveCursorUp();

        const chosenMessage = answer.aicommit2Prompt?.value;
        if (!chosenMessage) {
            throw new KnownError('An error occurred! No selected message');
        }

        if (useClipboard) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ncp = require('copy-paste');
            ncp.copy(chosenMessage);
            consoleManager.printCopied();
            process.exit();
        }

        if (confirm) {
            const commitSpinner = ora('Committing with the generated message').start();
            await execa('git', ['commit', '-m', chosenMessage, ...rawArgv]);
            commitSpinner.stop();
            commitSpinner.clear();
            consoleManager.printCommitted();
            process.exit();
        }

        const confirmPrompt = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirmationPrompt',
                message: `Use selected message?`,
                default: true,
            },
        ]);
        const { confirmationPrompt } = confirmPrompt;
        if (confirmationPrompt) {
            const commitSpinner = ora('Committing with the generated message').start();
            await execa('git', ['commit', '-m', chosenMessage, ...rawArgv]);
            commitSpinner.stop();
            commitSpinner.clear();
            consoleManager.printCommitted();
            process.exit();
        }
        consoleManager.printCancelledCommit();
        process.exit();
    })().catch(error => {
        consoleManager.printErrorMessage(error.message);
        handleCliError(error);
        process.exit(1);
    });
