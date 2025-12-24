import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import chokidar from 'chokidar';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Subject, Subscription } from 'rxjs';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { DEFAULT_INQUIRER_OPTIONS, ReactivePromptManager, codeReviewLoader, emptyCodeReview } from '../managers/reactive-prompt.manager.js';
import { BUILTIN_SERVICES, ModelName, RawConfig, ValidConfig, getConfig } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import { SubscriptionManager } from '../utils/subscription-manager.js';
import { assertGitRepo, getCommitDiff, getVCSName } from '../utils/vcs.js';

class WatchGitManager {
    private destroyed$ = new Subject<void>();
    private consoleManager = new ConsoleManager();
    private subscriptionManager = new SubscriptionManager();
    private currentCodeReviewSubscription: Subscription | null = null;
    private currentCodeReviewPromptManager: ReactivePromptManager | null = null;
    private watcher: chokidar.FSWatcher | null = null;
    private lastCommitHash: string | null = null;
    private isProcessingCommit = false;

    private readonly REPO_PATH = process.cwd();
    private readonly GIT_PATH = path.join(this.REPO_PATH, '.git');
    private readonly HEAD_PATH = path.join(this.GIT_PATH, 'HEAD');
    private readonly REFS_PATH = path.join(this.GIT_PATH, 'refs', 'heads');
    private readonly COMMIT_MSG_PATH = path.join(this.GIT_PATH, 'COMMIT_EDITMSG');

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
        verbose: boolean,
        rawArgv: string[]
    ): Promise<void> {
        this.consoleManager.printTitle();
        await assertGitRepo();

        // Check if watch mode is supported for the current VCS
        const vcsName = await getVCSName();
        if (vcsName !== 'git') {
            throw new KnownError(`Watch mode is only supported for Git repositories. Current VCS: ${vcsName}`);
        }

        const config = await this.initializeConfig(locale, generate, prompt, verbose, rawArgv);

        await this.initializeCurrentCommit();

        try {
            await this.watchGitEvents(config);
        } catch (error) {
            await this.handleWatchGitError(error as Error);
            return this.watch(locale, generate, excludeFiles, prompt, verbose, rawArgv);
        }
    }

    private async initializeConfig(
        locale: string | undefined,
        generate: number | undefined,
        prompt: string | undefined,
        verbose: boolean,
        rawArgv: string[]
    ): Promise<ValidConfig> {
        const configOverrides: RawConfig = {
            locale: locale?.toString() as string,
            generate: generate?.toString() as string,
            systemPrompt: prompt?.toString() as string,
        };

        if (verbose) {
            configOverrides.logLevel = 'verbose';
        }

        const config = await getConfig(configOverrides, rawArgv);
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

    private async initializeCurrentCommit(): Promise<void> {
        try {
            const result = await this.executeGitCommand('git rev-parse HEAD');
            this.lastCommitHash = result.trim();
            this.consoleManager.printInfo(`Starting watch from commit: ${this.lastCommitHash.substring(0, 8)}`);
        } catch (error) {
            this.consoleManager.printWarning('No commits found in repository');
            this.lastCommitHash = null;
        }
    }

    private async executeGitCommand(command: string): Promise<string> {
        const execAsync = promisify(exec);
        const { stdout } = await execAsync(command, { cwd: this.REPO_PATH });
        return stdout;
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
        this.cleanupCurrentReviewResources();

        if (!this.destroyed$.closed) {
            this.destroyed$.next();
            this.destroyed$.complete();
        }
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
        return this.subscriptionManager.add(aiRequestManager.createCodeReviewRequests$(availableAIs), {
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

    private cleanupCurrentReviewResources(): void {
        if (this.currentCodeReviewSubscription) {
            this.currentCodeReviewSubscription.unsubscribe();
            this.currentCodeReviewSubscription = null;
        }

        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewPromptManager.destroy();
            this.currentCodeReviewPromptManager = null;
        }
    }

    private cleanupCodeReview(): void {
        this.cleanupCurrentReviewResources();
        this.clearTerminal();
        this.consoleManager.showLoader('Watching for new Git commits...');
    }

    private async isGitReset(currentHash: string): Promise<boolean> {
        if (!this.lastCommitHash) {
            return false;
        }

        try {
            const result = await this.executeGitCommand(`git merge-base --is-ancestor ${currentHash} ${this.lastCommitHash}`);
            return true;
        } catch {
            return false;
        }
    }

    private cancelCurrentReview(): void {
        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewPromptManager.cancel();
        }

        this.cleanupCurrentReviewResources();

        this.destroyed$.next();
        // Note: Don't complete and recreate destroyed$ here as it may interfere with other operations
        // The subject will be properly managed by the main lifecycle
    }

    private async watchGitEvents(config: ValidConfig): Promise<void> {
        this.consoleManager.showLoader('Watching for new Git commits...');

        const watchPaths = [
            this.HEAD_PATH, // Direct HEAD changes
            this.REFS_PATH, // Branch updates
            this.COMMIT_MSG_PATH, // Commit message file
            path.join(this.GIT_PATH, 'logs', 'HEAD'), // Git reflog
        ];

        const existingPaths = watchPaths.filter(p => {
            try {
                fs.accessSync(p);
                return true;
            } catch {
                return false;
            }
        });

        this.watcher = chokidar.watch(existingPaths, {
            persistent: true,
            ignoreInitial: true,
            awaitWriteFinish: {
                stabilityThreshold: 500,
                pollInterval: 100,
            },
        });

        this.watcher.on('change', async filePath => {
            await this.handleGitChange(config, filePath);
        });

        this.watcher.on('add', async filePath => {
            await this.handleGitChange(config, filePath);
        });

        this.watcher.on('error', (error: Error) => {
            this.consoleManager.printError(`Watcher error: ${error.message}`);
            setTimeout(() => this.watchGitEvents(config), 1000);
        });
    }

    private async handleGitChange(config: ValidConfig, changedPath: string): Promise<void> {
        try {
            const currentCommit = await this.executeGitCommand('git rev-parse HEAD');
            const currentHash = currentCommit.trim();

            if (currentHash !== this.lastCommitHash) {
                const isReset = await this.isGitReset(currentHash);

                if (isReset) {
                    this.clearTerminal();
                    this.consoleManager.printInfo(`↩️ Git reset detected: ${currentHash.substring(0, 8)}`);
                    this.lastCommitHash = currentHash;

                    if (this.isProcessingCommit) {
                        this.cancelCurrentReview();
                        this.isProcessingCommit = false;
                    }
                    return;
                }

                // If we're currently processing a commit (showing review), cancel it for the new commit
                if (this.isProcessingCommit) {
                    this.consoleManager.printInfo(`\n🔄 New commit detected, cancelling current review...`);
                    try {
                        this.cancelCurrentReview();
                        await new Promise(resolve => setTimeout(resolve, 200));
                    } catch (cancelError) {
                        console.warn('Error during review cancellation:', cancelError);
                        // Continue with new commit processing even if cancellation fails
                    }
                }

                this.isProcessingCommit = true;

                try {
                    this.consoleManager.stopLoader();
                    this.consoleManager.printInfo(`\n🔍 New commit detected: ${currentHash.substring(0, 8)}`);

                    const previousHash = this.lastCommitHash;
                    this.lastCommitHash = currentHash;

                    this.clearTerminal();
                    await this.handleCommitEvent(config, currentHash);
                } catch (commitError) {
                    this.consoleManager.printError(
                        `Error processing commit ${currentHash.substring(0, 8)}: ${(commitError as Error).message}`
                    );
                } finally {
                    this.isProcessingCommit = false;
                }
            }
        } catch (error) {
            this.isProcessingCommit = false;
            if (!error.message?.includes('fatal: not a git repository')) {
                this.consoleManager.printError(`Error checking for new commits: ${(error as Error).message}`);
            }
        }
    }

    destroy(): void {
        this.isProcessingCommit = false;
        this.lastCommitHash = null;

        try {
            this.subscriptionManager.destroy();
            this.cleanupCurrentReviewResources();

            if (this.watcher) {
                this.watcher.close();
                this.watcher = null;
            }

            this.consoleManager.stopLoader();

            this.destroyed$.next();
            this.destroyed$.complete();
        } catch (error) {
            console.warn('Error during WatchGitManager destruction:', error);
        }
    }
}

const watchGitManager = new WatchGitManager();

export const watchGit = async (
    locale: string | undefined,
    generate: number | undefined,
    excludeFiles: string[],
    prompt: string | undefined,
    verbose: boolean,
    rawArgv: string[]
) => {
    return watchGitManager.watch(locale, generate, excludeFiles, prompt, verbose, rawArgv);
};

export default watchGit;
