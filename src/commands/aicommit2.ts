import { execa } from 'execa';
import { assertGitRepo, getStagedDiff } from '../utils/git.js';
import { getConfig } from '../utils/config.js';
import { handleCliError, KnownError } from '../utils/error.js';
import ora from 'ora';

import inquirer from 'inquirer';
import { LogManager } from '../services/log.manager.js';
import { ReactivePromptManager } from '../services/reactive-prompt.manager.js';
import { ApiKeyName } from '../services/ai/ai-service.factory.js';

const logManager = new LogManager();

export default async (
    generate: number | undefined,
    excludeFiles: string[],
    stageAll: boolean,
    commitType: string | undefined,
    confirm: string | undefined,
    rawArgv: string[]
) =>
    (async () => {
        logManager.printTitle();

        await assertGitRepo();
        if (stageAll) {
            await execa('git', ['add', '--update']); // NOTE: should be equivalent behavior to `git commit --all`
        }

        const detectingFilesSpinner = logManager.displaySpinner('Detecting staged files');
        const staged = await getStagedDiff(excludeFiles);
        detectingFilesSpinner.stop();
        if (!staged) {
            throw new KnownError(
                'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.'
            );
        }
        logManager.printStagedFiles(staged);

        const { env } = process;
        const config = await getConfig({
            OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
            OPENAI_MODEL: env.OPENAI_MODEL || env['openai-model'] || env['openai_model'],
            CLAUDE_KEY: env.CLAUDE_KEY || env.CLAUDE_API_KEY,
            CLAUDE_MODEL: env.CLAUDE_MODEL || env['claude-model'],
            GOOGLE_KEY: env.GOOGLE_KEY || env.GOOGLE_API_KEY,
            proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
            generate: generate?.toString(),
            type: commitType?.toString(),
            confirm: confirm?.toString(),
        });

        const availableAPIKeyNames: ApiKeyName[] = Object.entries(config)
            .filter(([key]) => ['OPENAI_KEY', 'GOOGLE_KEY', 'CLAUDE_KEY'].includes(key))
            .filter(([_, value]) => !!value)
            .map(([key]) => key as ApiKeyName);

        const hasNoAvailableAIs = availableAPIKeyNames.length === 0;
        if (hasNoAvailableAIs) {
            throw new KnownError('Please set at least one API key via `aicommit2 config set OPENAI_KEY=<your token>`');
        }

        const reactivePromptManager = new ReactivePromptManager(config, staged);
        const selectPrompt = reactivePromptManager.initPrompt();

        reactivePromptManager.startLoader();
        const subscription = reactivePromptManager.generateAIMessages$(availableAPIKeyNames);
        const answer = await selectPrompt;
        subscription.unsubscribe();
        reactivePromptManager.completeSubject();
        // NOTE: reactiveListPrompt has 2 blank lines
        logManager.moveCursorUp();

        const chosenMessage = answer.aicommit2Prompt?.value;
        if (!chosenMessage) {
            throw new KnownError('An error occurred! No selected message');
        }

        const withoutConfirm = !config.confirm;
        if (withoutConfirm) {
            const commitSpinner = ora('Committing with the generated message').start();
            // await execa('git', ['commit', '-m', chosenMessage, ...rawArgv]);
            commitSpinner.stop();
            commitSpinner.clear();
            logManager.printCommitted();
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
            // await execa('git', ['commit', '-m', chosenMessage, ...rawArgv]);
            commitSpinner.stop();
            commitSpinner.clear();
            logManager.printCommitted();
            process.exit();
        }
        logManager.printCancelledCommit();
        process.exit();
    })().catch(error => {
        logManager.printErrorMessage(error.message);
        handleCliError(error);
        process.exit(1);
    });
