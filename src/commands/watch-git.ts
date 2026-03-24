import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import chokidar from 'chokidar';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Subject, Subscription } from 'rxjs';

import { getAvailableAIs } from './get-available-ais.js';
import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { DEFAULT_INQUIRER_OPTIONS, ReactivePromptManager, codeReviewLoader, emptyCodeReview } from '../managers/reactive-prompt.manager.js';
import { ModelName, RawConfig, ValidConfig, getConfig } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { logger } from '../utils/logger.js';
import { validateSystemPrompt } from '../utils/prompt.js';
import { SubscriptionManager } from '../utils/subscription-manager.js';
import { GitDiff, assertGitRepo, getBranchName, getCommitDiff, getVCSName } from '../utils/vcs.js';

const execAsync = promisify(exec);

// Watch mode constants
const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 3000;
const STABILITY_THRESHOLD_MS = 500;
const POLL_INTERVAL_MS = 100;
const WATCHER_ERROR_RETRY_MS = 1000;
const CANCELLATION_WAIT_MS = 200;

class WatchGitManager {
    private destroyed$ = new Subject<void>();
    private consoleManager = new ConsoleManager();
    private subscriptionManager = new SubscriptionManager();
    private currentCodeReviewSubscription: Subscription | null = null;
    private currentCodeReviewPromptManager: ReactivePromptManager | null = null;
    private watcher: chokidar.FSWatcher | null = null;
    private lastCommitHash: string | null = null;
    private isProcessingCommit = false;
    private retryCount = 0;
    private processingLock = false;
    private pendingCommitHash: string | null = null;
    private excludeFiles: string[] = [];
    private configExclude: string[] = [];

    private readonly REPO_PATH = process.cwd();
    private readonly GIT_PATH = path.join(this.REPO_PATH, '.git');
    private readonly HEAD_PATH = path.join(this.GIT_PATH, 'HEAD');
    private readonly REFS_PATH = path.join(this.GIT_PATH, 'refs', 'heads');
    private readonly COMMIT_MSG_PATH = path.join(this.GIT_PATH, 'COMMIT_EDITMSG');

    constructor() {
        this.setupProcessHandlers();
    }

    private setupProcessHandlers = (): void => {
        const cleanup = () => {
            this.destroy();
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('SIGQUIT', cleanup);
    };

    watch = async (
        locale: string | undefined,
        generate: number | undefined,
        excludeFiles: string[],
        prompt: string | undefined,
        verbose: boolean,
        rawArgv: string[]
    ): Promise<void> => {
        this.consoleManager.printTitle();
        await assertGitRepo();

        const vcsName = await getVCSName();
        if (vcsName !== 'git') {
            throw new KnownError(`Watch mode is only supported for Git repositories. Current VCS: ${vcsName}`);
        }

        this.excludeFiles = excludeFiles;
        const config = await this.initializeConfig(locale, generate, prompt, verbose, rawArgv);
        this.configExclude = config.exclude || [];

        await this.initializeCurrentCommit();
        await this.startWatchLoop(config);
    };

    private startWatchLoop = async (config: ValidConfig): Promise<void> => {
        try {
            await this.watchGitEvents(config);
        } catch (error) {
            const hasRetriesLeft = this.retryCount < MAX_RETRIES;
            if (!hasRetriesLeft) {
                this.consoleManager.printError('Watch mode failed after maximum retries. Exiting.');
                this.destroy();
                process.exit(1);
            }

            this.retryCount++;
            const delay = BASE_RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1);
            await this.handleWatchGitError(error as Error, delay);
            return this.startWatchLoop(config);
        }
    };

    private initializeConfig = async (
        locale: string | undefined,
        generate: number | undefined,
        prompt: string | undefined,
        verbose: boolean,
        rawArgv: string[]
    ): Promise<ValidConfig> => {
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
        const availableAIs = getAvailableAIs(config, 'watch');
        if (availableAIs.length === 0) {
            this.consoleManager.printError(`Please set at least one API key and watchMode via the config command:
  aicommit2 config set [MODEL].key="YOUR_API_KEY"
  aicommit2 config set [MODEL].watchMode="true"`);
            process.exit();
        }

        return config;
    };

    private handleWatchGitError = async (error: Error, delay: number): Promise<void> => {
        this.consoleManager.printError(`An error occurred: ${error.message}`);
        handleCliError(error);
        await new Promise(resolve => setTimeout(resolve, delay));
        this.consoleManager.printWarning(`Restarting the commit monitoring process... (retry ${this.retryCount}/${MAX_RETRIES})`);
    };

    private initializeCurrentCommit = async (): Promise<void> => {
        try {
            const result = await this.executeGitCommand('git rev-parse HEAD');
            this.lastCommitHash = result.trim();
            const shortHash = this.lastCommitHash.substring(0, 8);
            this.consoleManager.printInfo(`Starting watch from commit: ${shortHash}`);
        } catch {
            this.consoleManager.printWarning('No commits found in repository');
            this.lastCommitHash = null;
        }
    };

    private executeGitCommand = async (command: string): Promise<string> => {
        const { stdout } = await execAsync(command, { cwd: this.REPO_PATH });
        return stdout;
    };

    private clearTerminal = (): void => {
        process.stdout.write('\x1Bc');
    };

    private handleCommitEvent = async (config: ValidConfig, commitHash: string): Promise<void> => {
        try {
            const diffInfo = await getCommitDiff(commitHash, this.excludeFiles, this.configExclude);
            if (!diffInfo) {
                this.consoleManager.printWarning('No changes found in this commit');
                return;
            }

            this.consoleManager.stopLoader();
            this.consoleManager.printStagedFiles(diffInfo);

            // Available AIs are validated once in initializeConfig — config doesn't change between commits
            const availableAIs = getAvailableAIs(config, 'watch');
            await this.performCodeReview(config, diffInfo, availableAIs);
        } catch (error) {
            this.consoleManager.printError(`Error processing commit ${commitHash.substring(0, 8)}: ${(error as Error).message}`);
        }
    };

    private performCodeReview = async (config: ValidConfig, diffInfo: GitDiff, availableAIs: ModelName[]): Promise<void> => {
        this.cleanupPreviousCodeReview();

        const branchName = await getBranchName();
        const aiRequestManager = new AIRequestManager(config, diffInfo, branchName);
        this.currentCodeReviewPromptManager = new ReactivePromptManager(codeReviewLoader);

        try {
            const codeReviewInquirer = this.initializeCodeReviewInquirer();

            this.currentCodeReviewPromptManager.startLoader();
            this.currentCodeReviewSubscription = this.subscribeToCodeReviewRequests(aiRequestManager, availableAIs);

            await codeReviewInquirer;
        } finally {
            this.cleanupCodeReview();
        }
    };

    private cleanupPreviousCodeReview = (): void => {
        this.cleanupCurrentReviewResources();
        // Don't complete/recreate destroyed$ here — it's for the manager's full lifecycle.
        // Per-review cleanup only needs subscription + prompt manager teardown.
    };

    private initializeCodeReviewInquirer = () => {
        return this.currentCodeReviewPromptManager!.initPrompt({
            ...DEFAULT_INQUIRER_OPTIONS,
            name: 'codeReviewPrompt',
            message: 'Please check code reviews: ',
            emptyMessage: `⚠ ${emptyCodeReview}`,
            isDescriptionDim: false,
            stopMessage: 'Code review completed',
            descPageSize: 20,
        });
    };

    private subscribeToCodeReviewRequests = (aiRequestManager: AIRequestManager, availableAIs: ModelName[]): Subscription => {
        return this.subscriptionManager.add(aiRequestManager.createCodeReviewRequests$(availableAIs), {
            next: (choice: ReactiveListChoice) => {
                this.currentCodeReviewPromptManager?.refreshChoices(choice);
            },
            error: (error: unknown) => {
                logger.error(`Code review request error: ${error}`);
                this.currentCodeReviewPromptManager?.checkErrorOnChoices(false);
            },
            complete: () => {
                this.currentCodeReviewPromptManager?.checkErrorOnChoices(false);
            },
        });
    };

    private cleanupCurrentReviewResources = (): void => {
        if (this.currentCodeReviewSubscription) {
            this.currentCodeReviewSubscription.unsubscribe();
            this.currentCodeReviewSubscription = null;
        }

        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewPromptManager.destroy();
            this.currentCodeReviewPromptManager = null;
        }
    };

    private cleanupCodeReview = (): void => {
        this.cleanupCurrentReviewResources();
        this.clearTerminal();
        this.consoleManager.showLoader('Watching for new Git commits...');
    };

    private isGitReset = async (currentHash: string): Promise<boolean> => {
        if (!this.lastCommitHash) {
            return false;
        }

        try {
            await this.executeGitCommand(`git merge-base --is-ancestor ${currentHash} ${this.lastCommitHash}`);
            return true;
        } catch {
            return false;
        }
    };

    private cancelCurrentReview = (): void => {
        if (this.currentCodeReviewPromptManager) {
            this.currentCodeReviewPromptManager.cancel();
        }
        this.cleanupCurrentReviewResources();
    };

    private closeWatcher = async (): Promise<void> => {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
    };

    private watchGitEvents = async (config: ValidConfig): Promise<void> => {
        this.consoleManager.showLoader('Watching for new Git commits...');

        const watchPaths = [this.HEAD_PATH, this.REFS_PATH, this.COMMIT_MSG_PATH, path.join(this.GIT_PATH, 'logs', 'HEAD')];

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
                stabilityThreshold: STABILITY_THRESHOLD_MS,
                pollInterval: POLL_INTERVAL_MS,
            },
        });

        this.watcher.on('change', async (filePath: string) => {
            await this.handleGitChange(config, filePath);
        });

        this.watcher.on('add', async (filePath: string) => {
            await this.handleGitChange(config, filePath);
        });

        this.watcher.on('error', async (error: Error) => {
            this.consoleManager.printError(`Watcher error: ${error.message}`);
            await this.closeWatcher();
            setTimeout(() => {
                this.watchGitEvents(config).catch((err: unknown) => {
                    logger.error(`Failed to restart watcher: ${err}`);
                });
            }, WATCHER_ERROR_RETRY_MS);
        });
    };

    private handleGitChange = async (config: ValidConfig, _changedPath: string): Promise<void> => {
        // Prevent duplicate processing from multiple chokidar events for the same commit
        if (this.processingLock) {
            try {
                const currentCommit = await this.executeGitCommand('git rev-parse HEAD');
                this.pendingCommitHash = currentCommit.trim();
            } catch {
                // Ignore — will be picked up on next event
            }
            return;
        }

        this.processingLock = true;
        try {
            await this.processGitChange(config);

            // After processing, check if a newer commit arrived while we were busy
            if (this.pendingCommitHash && this.pendingCommitHash !== this.lastCommitHash) {
                this.pendingCommitHash = null;
                await this.processGitChange(config);
            }
            this.pendingCommitHash = null;
        } finally {
            this.processingLock = false;
        }
    };

    private processGitChange = async (config: ValidConfig): Promise<void> => {
        try {
            const currentCommit = await this.executeGitCommand('git rev-parse HEAD');
            const currentHash = currentCommit.trim();

            if (currentHash === this.lastCommitHash) {
                return;
            }

            // Reset retry count on successful commit detection
            this.retryCount = 0;

            const isReset = await this.isGitReset(currentHash);
            if (isReset) {
                this.clearTerminal();
                this.consoleManager.printInfo(`Git reset detected: ${currentHash.substring(0, 8)}`);
                this.lastCommitHash = currentHash;

                if (this.isProcessingCommit) {
                    this.cancelCurrentReview();
                    this.isProcessingCommit = false;
                }
                return;
            }

            // Cancel current review if a new commit arrives
            if (this.isProcessingCommit) {
                this.consoleManager.printInfo(`New commit detected, cancelling current review...`);
                try {
                    this.cancelCurrentReview();
                    await new Promise(resolve => setTimeout(resolve, CANCELLATION_WAIT_MS));
                } catch (cancelError) {
                    logger.warn(`Error during review cancellation: ${cancelError}`);
                }
            }

            this.isProcessingCommit = true;

            try {
                this.consoleManager.stopLoader();
                this.consoleManager.printInfo(`New commit detected: ${currentHash.substring(0, 8)}`);

                this.lastCommitHash = currentHash;

                this.clearTerminal();
                await this.handleCommitEvent(config, currentHash);
            } catch (commitError) {
                this.consoleManager.printError(`Error processing commit ${currentHash.substring(0, 8)}: ${(commitError as Error).message}`);
            } finally {
                this.isProcessingCommit = false;
            }
        } catch (error) {
            this.isProcessingCommit = false;
            const errorMessage = (error as Error).message ?? '';
            const isNotGitRepo = errorMessage.includes('fatal: not a git repository');
            if (!isNotGitRepo) {
                this.consoleManager.printError(`Error checking for new commits: ${errorMessage}`);
            }
        }
    };

    destroy = (): void => {
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

            if (!this.destroyed$.closed) {
                this.destroyed$.next();
                this.destroyed$.complete();
            }
        } catch (error) {
            logger.warn(`Error during WatchGitManager destruction: ${error}`);
        }
    };
}

const watchGitManager = new WatchGitManager();

export const watchGit = async (
    locale: string | undefined,
    generate: number | undefined,
    excludeFiles: string[],
    prompt: string | undefined,
    verbose: boolean,
    rawArgv: string[]
): Promise<void> => {
    return watchGitManager.watch(locale, generate, excludeFiles, prompt, verbose, rawArgv);
};
