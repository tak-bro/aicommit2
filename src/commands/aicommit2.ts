import { execa } from 'execa';
import inquirer from 'inquirer';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import ora from 'ora';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ReactivePromptManager } from '../managers/reactive-prompt.manager.js';
import { AIType, ApiKeyName, ApiKeyNames } from '../services/ai/ai.service.js';
import { getConfig } from '../utils/config.js';
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

        const { env } = process;
        const config = await getConfig({
            OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
            OPENAI_MODEL: env.OPENAI_MODEL || env['openai-model'] || env['openai_model'],
            OPENAI_URL: env.OPENAI_URL || env['openai-url'] || env['OPENAI_URL'],
            GEMINI_KEY: env.GEMINI_KEY || env.GEMINI_API_KEY,
            GEMINI_MODEL: env.GEMINI_MODEL || env['gemini-model'] || env['gemini_model'],
            ANTHROPIC_KEY: env.ANTHROPIC_KEY || env.ANTHROPIC_API_KEY,
            ANTHROPIC_MODEL: env.ANTHROPIC_MODEL || env['anthropic-model'] || env['anthropic_model'],
            HUGGING_COOKIE: env.HUGGING_COOKIE || env.HUGGING_API_KEY || env.HF_TOKEN,
            HUGGING_MODEL: env.HUGGING_MODEL || env['hugging-model'],
            CLOVAX_COOKIE: env.CLOVAX_COOKIE || env.CLOVA_X_COOKIE,
            proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
            temperature: env.temperature,
            generate: generate?.toString() || env.generate,
            type: commitType?.toString() || env.type,
            locale: locale?.toString() || env.locale,
            prompt: prompt?.toString() || env.prompt,
        });

        const availableAPIKeyNames: ApiKeyName[] = Object.entries(config)
            .filter(([key]) => ApiKeyNames.includes(key as ApiKeyName))
            .filter(([key, value]) => {
                if (key === AIType.OLLAMA) {
                    return !!value && (value as string[]).length > 0;
                }
                return !!value;
            })
            .map(([key]) => key as ApiKeyName);

        const hasNoAvailableAIs = availableAPIKeyNames.length === 0;
        if (hasNoAvailableAIs) {
            throw new KnownError('Please set at least one API key via `aicommit2 config set OPENAI_KEY=<your token>`');
        }

        const aiRequestManager = new AIRequestManager(config, staged);
        const reactivePromptManager = new ReactivePromptManager();
        const selectPrompt = reactivePromptManager.initPrompt();

        reactivePromptManager.startLoader();
        const subscription = aiRequestManager.createAIRequests$(availableAPIKeyNames).subscribe(
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
