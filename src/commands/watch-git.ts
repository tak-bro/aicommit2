import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { DEFAULT_INQUIRER_OPTIONS, ReactivePromptManager, codeReviewLoader, emptyCodeReview } from '../managers/reactive-prompt.manager.js';
import { ModelName, RawConfig, ValidConfig, getConfig, modelNames } from '../utils/config.js';
import { handleCliError } from '../utils/error.js';
import { assertGitRepo, getCommitDiff } from '../utils/git.js';
import { validateSystemPrompt } from '../utils/prompt.js';

let destroyed$ = new Subject<void>();

const consoleManager = new ConsoleManager();

const REPO_PATH = process.cwd();
const HOOK_PATH = path.join(REPO_PATH, '.git', 'hooks', 'post-commit');
const LOG_PATH = path.join(REPO_PATH, '.git', 'commit-log.txt');

const hookScript = `#!/bin/sh
commit_hash=$(git rev-parse HEAD)
commit_message=$(git log -1 --pretty=%B)
echo "$commit_hash: $commit_message" >> ${LOG_PATH}
`;

let currentCodeReviewSubscription: Subscription | null = null;
let currentCodeReviewPromptManager: ReactivePromptManager | null = null;

export const watchGit = async (
    locale: string | undefined,
    generate: number | undefined,
    excludeFiles: string[],
    prompt: string | undefined,
    rawArgv: string[]
) => {
    consoleManager.printTitle();
    await assertGitRepo();
    const config = await initializeConfig(locale, generate, prompt, rawArgv);
    setupGitHook();
    initLogFile();

    try {
        await watchCommitLog(config);
    } catch (error) {
        handleWatchGitError(error);
        return watchGit(locale, generate, excludeFiles, prompt, rawArgv);
    }
};

const initializeConfig = async (
    locale: string | undefined,
    generate: number | undefined,
    prompt: string | undefined,
    rawArgv: string[]
) => {
    const config = await getConfig(
        {
            locale: locale?.toString() as string,
            generate: generate?.toString() as string,
            systemPrompt: prompt?.toString() as string,
        },
        rawArgv
    );
    await validateSystemPrompt(config);
    const availableAIs = getAvailableAIs(config);
    if (availableAIs.length === 0) {
        consoleManager.printError(`Please set at least one API key and watchMode via the config command:
  aicommit2 config set [MODEL].key="YOUR_API_KEY"
  aicommit2 config set [MODEL].watchMode="true"`);
        process.exit();
    }

    return config;
};

const handleWatchGitError = async (error: Error) => {
    consoleManager.printError(`An error occurred: ${error.message}`);
    handleCliError(error);
    await new Promise(resolve => setTimeout(resolve, 3000));
    consoleManager.printWarning('Restarting the commit monitoring process...');
};

const initLogFile = () => {
    fs.writeFileSync(LOG_PATH, '', { flag: 'w' });
};

const getAvailableAIs = (config: ValidConfig): ModelName[] => {
    return Object.entries(config)
        .filter(([key]) => modelNames.includes(key as ModelName))
        .map(([key, value]) => [key, value] as [ModelName, RawConfig])
        .filter(([_, value]) => !value.disabled)
        .filter(([key, value]) => isAIAvailable(key as ModelName, value, config))
        .map(([key]) => key as ModelName);
};

const isAIAvailable = (key: ModelName, value: RawConfig, config: ValidConfig) => {
    const watchMode = config.watchMode || value.watchMode;
    if (key === 'OLLAMA') {
        return !!value && !!value.model && (value.model as string[]).length > 0 && watchMode;
    }
    if (key === 'HUGGINGFACE') {
        return !!value && !!value.cookie && watchMode;
    }
    return !!value.key && value.key.length > 0 && watchMode;
};

const setupGitHook = () => {
    fs.writeFileSync(HOOK_PATH, hookScript, { mode: 0o755 });
    consoleManager.printSetupGitEvent('post-commit');
};

const clearTerminal = () => {
    process.stdout.write('\x1Bc');
};

const handleCommitEvent = async (config: ValidConfig, commitHash: string) => {
    try {
        const diffInfo = await getCommitDiff(commitHash);
        if (!diffInfo) {
            consoleManager.printWarning('No changes found in this commit');
            return;
        }

        consoleManager.stopLoader();
        consoleManager.printStagedFiles(diffInfo);

        const availableAIs = getAvailableAIs(config);
        if (availableAIs.length === 0) {
            consoleManager.printError(`Please set at least one API key and watchMode via the config command:
  aicommit2 config set [MODEL].key="YOUR_API_KEY"
  aicommit2 config set [MODEL].watchMode="true"`);
            process.exit();
            return;
        }

        await performCodeReview(config, diffInfo, availableAIs);
    } catch (error) {
        consoleManager.printError(`Error processing commit ${commitHash}: ${error.message}`);
    }
};

const performCodeReview = async (config: ValidConfig, diffInfo: any, availableAIs: ModelName[]) => {
    cleanupPreviousCodeReview();

    const aiRequestManager = new AIRequestManager(config, diffInfo);
    currentCodeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);

    const codeReviewInquirer = initializeCodeReviewInquirer();

    currentCodeReviewPromptManager.startLoader();
    currentCodeReviewSubscription = subscribeToCodeReviewRequests(aiRequestManager, availableAIs);

    await codeReviewInquirer;
    cleanupCodeReview();
};

const cleanupPreviousCodeReview = () => {
    if (currentCodeReviewPromptManager) {
        currentCodeReviewSubscription?.unsubscribe();

        currentCodeReviewPromptManager.clearLoader();
        currentCodeReviewPromptManager.completeSubject();
        currentCodeReviewPromptManager.cancel();
        currentCodeReviewPromptManager.closeInquirerInstance();
    }
    destroyed$.next();
    destroyed$.complete();
    destroyed$ = new Subject<void>();
};

const initializeCodeReviewInquirer = () => {
    return currentCodeReviewPromptManager!.initPrompt({
        ...DEFAULT_INQUIRER_OPTIONS,
        name: 'codeReviewPrompt',
        message: 'Please check code reviews: ',
        emptyMessage: `⚠ ${emptyCodeReview}`,
        isDescriptionDim: false,
        stopMessage: 'Code review completed',
        descPageSize: 20,
    });
};

const subscribeToCodeReviewRequests = (aiRequestManager: AIRequestManager, availableAIs: ModelName[]) => {
    return aiRequestManager
        .createCodeReviewRequests$(availableAIs)
        .pipe(takeUntil(destroyed$))
        .subscribe(
            (choice: ReactiveListChoice) => {
                currentCodeReviewPromptManager?.refreshChoices(choice);
            },
            () => {
                /* empty */
            },
            () => {
                currentCodeReviewPromptManager?.checkErrorOnChoices(false);
            }
        );
};

const cleanupCodeReview = () => {
    if (currentCodeReviewPromptManager) {
        currentCodeReviewSubscription?.unsubscribe();

        currentCodeReviewPromptManager.clearLoader();
        currentCodeReviewPromptManager.completeSubject();
        currentCodeReviewPromptManager.cancel();
        currentCodeReviewPromptManager.closeInquirerInstance();
        currentCodeReviewPromptManager = null;
    }
    clearTerminal();
    consoleManager.showLoader('Watching for new Git commits...');
};

const watchCommitLog = async (config: ValidConfig) => {
    const watcher = chokidar.watch(LOG_PATH, { persistent: true });

    watcher.on('change', async () => {
        try {
            const commits = await readCommitsFromLog();
            for (const commit of commits) {
                !!commit && (await processCommit(config, commit));
            }
        } catch (error) {
            consoleManager.printError(`Error reading or processing commit log: ${error.message}`);
        } finally {
            truncateLogFile();
        }
    });

    watcher.on('error', handleWatcherError(config));
};

const readCommitsFromLog = async (): Promise<string[]> => {
    const logContent = await fs.promises.readFile(LOG_PATH, 'utf8');
    return logContent.trim().split('\n');
};

const processCommit = async (config: ValidConfig, commit: string) => {
    const [hash] = commit.split(':');
    if (!hash) {
        consoleManager.printWarning('Empty commit hash detected, skipping...');
        return;
    }
    clearTerminal();
    await handleCommitEvent(config, hash.trim());
};

const truncateLogFile = () => {
    try {
        fs.truncateSync(LOG_PATH);
    } catch (truncateError) {
        consoleManager.printError(`Error truncating log file: ${truncateError.message}`);
    }
};

const handleWatcherError = (config: ValidConfig) => (error: Error) => {
    consoleManager.printError(`Watcher error: ${error.message}`);
    setTimeout(() => watchCommitLog(config), 1000);
};

export default watchGit;
