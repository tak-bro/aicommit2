import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Subscription } from 'rxjs';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { DEFAULT_INQUIRER_OPTIONS, ReactivePromptManager, codeReviewLoader, emptyCodeReview } from '../managers/reactive-prompt.manager.js';
import { ModelName, RawConfig, ValidConfig, getConfig, modelNames } from '../utils/config.js';
import { handleCliError } from '../utils/error.js';
// eslint-disable-next-line import/order
import { assertGitRepo, getCommitDiff } from '../utils/git.js';

const consoleManager = new ConsoleManager();

import { validateSystemPrompt } from '../utils/prompt.js';

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

    try {
        await assertGitRepo();

        const config = await getConfig(
            {
                locale: locale?.toString() as string,
                generate: generate?.toString() as string,
                systemPrompt: prompt?.toString() as string,
            },
            rawArgv
        );
        await validateSystemPrompt(config);
        setupGitHook();
        initLogFile();
        await watchCommitLog(config);
    } catch (error) {
        consoleManager.printError(`An error occurred: ${error.message}`);
        handleCliError(error);
        // 에러 발생 후 3초 대기 후 재시작
        await new Promise(resolve => setTimeout(resolve, 3000));
        consoleManager.printWarning('Restarting the commit monitoring process...');
        // 재귀적으로 함수를 다시 호출하여 프로세스 재시작
        return watchGit(locale, generate, excludeFiles, prompt, rawArgv);
    }
};
export default watchGit;

function initLogFile() {
    fs.writeFileSync(LOG_PATH, '', { flag: 'w' });
}

function getAvailableAIs(config: ValidConfig): ModelName[] {
    return Object.entries(config)
        .filter(([key]) => modelNames.includes(key as ModelName))
        .map(([key, value]) => [key, value] as [ModelName, RawConfig])
        .filter(([key, value]) => !value.disabled)
        .filter(([key, value]) => {
            const codeReview = config.codeReview || value.codeReview;
            if (key === 'OLLAMA') {
                return !!value && !!value.model && (value.model as string[]).length > 0 && codeReview;
            }
            if (key === 'HUGGINGFACE') {
                return !!value && !!value.cookie && codeReview;
            }
            // @ts-ignore ignore
            return !!value.key && value.key.length > 0 && codeReview;
        })
        .map(([key]) => key);
}

function setupGitHook() {
    fs.writeFileSync(HOOK_PATH, hookScript, { mode: 0o755 });
    consoleManager.printSetupGitEvent('post-commit');
}

function clearTerminal() {
    process.stdout.write('\x1Bc');
}

async function handleCommitEvent(config: ValidConfig, commitHash: string) {
    try {
        const diffInfo = await getCommitDiff(commitHash);
        if (!diffInfo) {
            consoleManager.printWarning('No changes found in this commit');
            return;
        }

        const availableAIs = getAvailableAIs(config);
        if (availableAIs.length === 0) {
            consoleManager.printError('Please set at least one API key via the `aicommit2 config set` command');
            return;
        }
        consoleManager.stopLoader();
        consoleManager.printStagedFiles(diffInfo);

        const aiRequestManager = new AIRequestManager(config, diffInfo);
        if (currentCodeReviewPromptManager) {
            currentCodeReviewPromptManager.clearLoader();
            currentCodeReviewPromptManager.completeSubject();
            currentCodeReviewPromptManager.closeInquirerInstance();
            currentCodeReviewSubscription?.unsubscribe();
        }

        currentCodeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);
        const codeReviewInquirer = currentCodeReviewPromptManager.initPrompt({
            ...DEFAULT_INQUIRER_OPTIONS,
            name: 'codeReviewPrompt',
            message: 'Please check code reviews: ',
            emptyMessage: `⚠ ${emptyCodeReview}`,
            isDescriptionDim: false,
            stopMessage: 'Code review completed',
            descPageSize: 20,
        });

        currentCodeReviewPromptManager.startLoader();
        currentCodeReviewSubscription = aiRequestManager.createCodeReviewRequests$(availableAIs).subscribe(
            (choice: ReactiveListChoice) => {
                currentCodeReviewPromptManager?.refreshChoices(choice);
            },
            () => {
                /* empty */
            },
            () => {
                currentCodeReviewPromptManager?.checkErrorOnChoices();
            }
        );

        codeReviewInquirer.then((codeReviewInquirerResult: { codeReviewPrompt: { value: any } }) => {
            const selectedCodeReview = codeReviewInquirerResult.codeReviewPrompt?.value;
            if (currentCodeReviewPromptManager) {
                currentCodeReviewPromptManager.clearLoader();
                currentCodeReviewPromptManager.completeSubject();
                currentCodeReviewPromptManager.closeInquirerInstance();
                currentCodeReviewSubscription?.unsubscribe();
                currentCodeReviewPromptManager = null;
            }
            clearTerminal();
            consoleManager.showLoader('Watching for new Git commits...');
        });
    } catch (error) {
        consoleManager.printError(`Error processing commit ${commitHash}: ${error.message}`);
    }
}

// 로그 파일 감시 및 처리
async function watchCommitLog(config: ValidConfig) {
    const watcher = chokidar.watch(LOG_PATH, { persistent: true });

    watcher.on('change', async () => {
        try {
            const logContent = fs.readFileSync(LOG_PATH, 'utf8');
            const commits = logContent.trim().split('\n');

            for (const commit of commits) {
                const [hash, ...messageParts] = commit.split(':');
                if (!hash) {
                    consoleManager.printWarning('Empty commit hash detected, skipping...');
                    continue;
                }
                clearTerminal();
                await handleCommitEvent(config, hash.trim());
            }
        } catch (error) {
            consoleManager.printError(`Error reading or processing commit log: ${error.message}`);
        } finally {
            try {
                fs.truncateSync(LOG_PATH);
            } catch (truncateError) {
                consoleManager.printError(`Error truncating log file: ${truncateError.message}`);
            }
        }
    });

    watcher.on('error', error => {
        consoleManager.printError(`Watcher error: ${error.message}`);
        setTimeout(() => watchCommitLog(config), 1000);
    });
}
