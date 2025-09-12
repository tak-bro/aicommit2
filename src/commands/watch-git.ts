import fs from 'fs';
import path from 'path';

import chokidar from 'chokidar';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { DEFAULT_INQUIRER_OPTIONS, ReactivePromptManager, codeReviewLoader, emptyCodeReview } from '../managers/reactive-prompt.manager.js';
import { BUILTIN_SERVICES, ModelName, RawConfig, ValidConfig, getConfig } from '../utils/config.js';
import { handleCliError } from '../utils/error.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import { SubscriptionManager } from '../utils/subscription-manager.js';
import { assertGitRepo, getCommitDiff } from '../utils/vcs.js';

class WatchGitManager {
    private destroyed$ = new Subject<void>();
    private consoleManager = new ConsoleManager();
    private subscriptionManager = new SubscriptionManager();
    private currentCodeReviewSubscription: Subscription | null = null;
    private currentCodeReviewPromptManager: ReactivePromptManager | null = null;
    private watcher: chokidar.FSWatcher | null = null;

    private readonly REPO_PATH = process.cwd();
    private readonly HOOK_PATH = path.join(this.REPO_PATH, '.git', 'hooks', 'post-commit');
    private readonly LOG_PATH = path.join(this.REPO_PATH, '.git', 'commit-log.txt');

    private readonly hookScript = `#!/bin/sh
commit_hash=$(git rev-parse HEAD)
commit_message=$(git log -1 --pretty=%B)
echo "$commit_hash: $commit_message" >> ${this.LOG_PATH}
`;

    constructor() {
        this.setupProcessHandlers();
    }

    private setupProcessHandlers(): void {
        const cleanup = () => {
            this.destroy();
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
    }

    async watch(
        locale: string | undefined,
        generate: number | undefined,
        excludeFiles: string[],
        prompt: string | undefined,
        rawArgv: string[]
    ): Promise<void> {
        this.consoleManager.printTitle();
        await assertGitRepo();
        const config = await this.initializeConfig(locale, generate, prompt, rawArgv);
        this.setupGitHook();
        this.initLogFile();

        try {
            await this.watchCommitLog(config);
        } catch (error) {
            await this.handleWatchGitError(error as Error);
            return this.watch(locale, generate, excludeFiles, prompt, rawArgv);
        }
    }

    private async initializeConfig(
        locale: string | undefined,
        generate: number | undefined,
        prompt: string | undefined,
        rawArgv: string[]
    ): Promise<ValidConfig> {
        const config = await getConfig(
            {
                locale: locale?.toString() as string,
                generate: generate?.toString() as string,
                systemPrompt: prompt?.toString() as string,
            },
            rawArgv
        );
        await validateSystemPrompt(config);
        const availableAIs = this.getAvailableAIs(config);
        if (availableAIs.length === 0) {
            this.consoleManager.printError(`Please set at least one API key and watchMode via the config command:
  aicommit2 config set [MODEL].key="YOUR_API_KEY"
  aicommit2 config set [MODEL].watchMode="true"`);
            process.exit();
        }

        return config;
    }

    private async handleWatchGitError(error: Error): Promise<void> {
        this.consoleManager.printError(`An error occurred: ${error.message}`);
        handleCliError(error);
        await new Promise(resolve => setTimeout(resolve, 3000));
        this.consoleManager.printWarning('Restarting the commit monitoring process...');
    }

    private initLogFile(): void {
        fs.writeFileSync(this.LOG_PATH, '', { flag: 'w' });
    }

    private getAvailableAIs(config: ValidConfig): ModelName[] {
        return Object.entries(config)
            .filter(([key, value]) => {
                return BUILTIN_SERVICES.includes(key as ModelName) || value.compatible === true;
            })
            .map(([key, value]) => [key, value] as [ModelName, RawConfig])
            .filter(([_, value]) => !value.disabled)
            .filter(([key, value]) => this.isAIAvailable(key as ModelName, value, config))
            .map(([key]) => key as ModelName);
    }

    private isAIAvailable(key: ModelName, value: RawConfig, config: ValidConfig): boolean {
        const watchMode = config.watchMode || value.watchMode;
        if (key === 'OLLAMA') {
            return !!value && !!value.model && (value.model as string[]).length > 0 && watchMode;
        }
        if (key === 'HUGGINGFACE') {
            return !!value && !!value.cookie && watchMode;
        }
        if (value.compatible) {
            return !!value.url && !!value.key && watchMode;
        }
        return !!value.key && value.key.length > 0 && watchMode;
    }

    private setupGitHook(): void {
        fs.writeFileSync(this.HOOK_PATH, this.hookScript, { mode: 0o755 });
        this.consoleManager.printSetupGitEvent('post-commit');
    }

    private clearTerminal(): void {
        process.stdout.write('\x1Bc');
    }

    private async handleCommitEvent(config: ValidConfig, commitHash: string): Promise<void> {
        try {
            const diffInfo = await getCommitDiff(commitHash);
            if (!diffInfo) {
                this.consoleManager.printWarning('No changes found in this commit');
                return;
            }

            this.consoleManager.stopLoader();
            this.consoleManager.printStagedFiles(diffInfo);

            const availableAIs = this.getAvailableAIs(config);
            if (availableAIs.length === 0) {
                this.consoleManager.printError(`Please set at least one API key and watchMode via the config command:
  aicommit2 config set [MODEL].key="YOUR_API_KEY"
  aicommit2 config set [MODEL].watchMode="true"`);
                process.exit();
                return;
            }

            await this.performCodeReview(config, diffInfo, availableAIs);
        } catch (error) {
            this.consoleManager.printError(`Error processing commit ${commitHash}: ${(error as Error).message}`);
        }
    }

    private async performCodeReview(config: ValidConfig, diffInfo: any, availableAIs: ModelName[]): Promise<void> {
        this.cleanupPreviousCodeReview();

        const aiRequestManager = new AIRequestManager(config, diffInfo);
        this.currentCodeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);

        try {
            const codeReviewInquirer = this.initializeCodeReviewInquirer();

            this.currentCodeReviewPromptManager.startLoader();
            this.currentCodeReviewSubscription = this.subscribeToCodeReviewRequests(aiRequestManager, availableAIs);

            await codeReviewInquirer;
        } finally {
            this.cleanupCodeReview();
        }
    }

    private cleanupPreviousCodeReview(): void {
        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewSubscription?.unsubscribe();
            this.currentCodeReviewPromptManager.destroy();
        }
        this.destroyed$.next();
        this.destroyed$.complete();
        this.destroyed$ = new Subject<void>();
    }

    private initializeCodeReviewInquirer() {
        return this.currentCodeReviewPromptManager!.initPrompt({
            ...DEFAULT_INQUIRER_OPTIONS,
            name: 'codeReviewPrompt',
            message: 'Please check code reviews: ',
            emptyMessage: `⚠ ${emptyCodeReview}`,
            isDescriptionDim: false,
            stopMessage: 'Code review completed',
            descPageSize: 20,
        });
    }

    private subscribeToCodeReviewRequests(aiRequestManager: AIRequestManager, availableAIs: ModelName[]): Subscription {
        return this.subscriptionManager.add(aiRequestManager.createCodeReviewRequests$(availableAIs).pipe(takeUntil(this.destroyed$)), {
            next: (choice: ReactiveListChoice) => {
                this.currentCodeReviewPromptManager?.refreshChoices(choice);
            },
            error: error => {
                console.error('Code review request error:', error);
                this.currentCodeReviewPromptManager?.checkErrorOnChoices(false);
            },
            complete: () => {
                this.currentCodeReviewPromptManager?.checkErrorOnChoices(false);
            },
        });
    }

    private cleanupCodeReview(): void {
        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewSubscription?.unsubscribe();
            this.currentCodeReviewPromptManager.destroy();
            this.currentCodeReviewPromptManager = null;
        }
        this.clearTerminal();
        this.consoleManager.showLoader('Watching for new Git commits...');
    }

    private async watchCommitLog(config: ValidConfig): Promise<void> {
        this.watcher = chokidar.watch(this.LOG_PATH, { persistent: true });

        this.watcher.on('change', async () => {
            try {
                const commits = await this.readCommitsFromLog();
                for (const commit of commits) {
                    !!commit && (await this.processCommit(config, commit));
                }
            } catch (error) {
                this.consoleManager.printError(`Error reading or processing commit log: ${(error as Error).message}`);
            } finally {
                this.truncateLogFile();
            }
        });

        this.watcher.on('error', (error: Error) => {
            this.consoleManager.printError(`Watcher error: ${error.message}`);
            setTimeout(() => this.watchCommitLog(config), 1000);
        });
    }

    private async readCommitsFromLog(): Promise<string[]> {
        const logContent = await fs.promises.readFile(this.LOG_PATH, 'utf8');
        return logContent.trim().split('\n');
    }

    private async processCommit(config: ValidConfig, commit: string): Promise<void> {
        const [hash] = commit.split(':');
        if (!hash) {
            this.consoleManager.printWarning('Empty commit hash detected, skipping...');
            return;
        }
        this.clearTerminal();
        await this.handleCommitEvent(config, hash.trim());
    }

    private truncateLogFile(): void {
        try {
            fs.truncateSync(this.LOG_PATH);
        } catch (truncateError) {
            this.consoleManager.printError(`Error truncating log file: ${(truncateError as Error).message}`);
        }
    }

    destroy(): void {
        this.subscriptionManager.destroy();

        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewPromptManager.destroy();
            this.currentCodeReviewPromptManager = null;
        }

        if (this.currentCodeReviewSubscription) {
            this.currentCodeReviewSubscription.unsubscribe();
            this.currentCodeReviewSubscription = null;
        }

        if (this.watcher) {
            this.watcher.close();
            this.watcher = null;
        }

        this.destroyed$.next();
        this.destroyed$.complete();
    }
}

// Create singleton instance
const watchGitManager = new WatchGitManager();

export const watchGit = async (
    locale: string | undefined,
    generate: number | undefined,
    excludeFiles: string[],
    prompt: string | undefined,
    rawArgv: string[]
) => {
    return watchGitManager.watch(locale, generate, excludeFiles, prompt, rawArgv);
};

export default watchGit;
