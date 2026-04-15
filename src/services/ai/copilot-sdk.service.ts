import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import {
    COPILOT_SDK_DEFAULT_MODEL,
    buildCopilotSdkClientOptions,
    getCopilotSdkModelCandidates,
    isCopilotSdkAuthError,
    isCopilotSdkClassicPatError,
    isCopilotSdkModelAccessError,
} from './copilot-sdk.utils.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

type CopilotSdkSession = {
    sendAndWait: (params: { prompt: string }) => Promise<unknown>;
};

type CopilotSdkClient = {
    createSession: (params: { model: string; onPermissionRequest: unknown }) => Promise<CopilotSdkSession>;
    stop?: () => Promise<void> | void;
};

type CopilotSdkModule = {
    CopilotClient: new (options?: Record<string, unknown>) => CopilotSdkClient;
    approveAll: unknown;
};

export class CopilotSdkService extends AIService {
    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#8957e5',
            secondary: '#FFF',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[Copilot SDK${this.formatModelSuffix()}]`);
        this.errorPrefix = chalk.red.bold(`[Copilot SDK${this.formatModelSuffix()}]`);
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const message = error.message || '';
        if (error.code === 'SDK_NOT_INSTALLED') {
            return 'Copilot SDK is not installed. Run: npm install @github/copilot-sdk';
        }
        if (isCopilotSdkClassicPatError(message)) {
            return 'Copilot rejected classic ghp_ token. Use COPILOT_GITHUB_TOKEN with a Fine-Grained PAT or authenticate via copilot /login.';
        }
        if (error.code === 'AUTHENTICATION_FAILED' || isCopilotSdkAuthError(message)) {
            return 'Copilot authentication failed. Install/authenticate Copilot CLI, then retry.';
        }
        if (message.includes('ERR_UNKNOWN_BUILTIN_MODULE') && message.includes('node:sqlite')) {
            return 'Copilot SDK requires a newer Node.js runtime (node:sqlite is unavailable). Please use Node.js 22+ and retry.';
        }
        if (error.code === 'MODEL_NOT_AVAILABLE' || isCopilotSdkModelAccessError(message)) {
            return 'Model is unavailable in Copilot SDK for this account/plan/client. Try another model.';
        }
        if (error.code === 'NO_CONTENT') {
            return 'Copilot SDK returned no content.';
        }
        return null;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('commit')).pipe(
            concatMap(messages => from(messages)),
            map(this.formatAsChoice),
            catchError(this.handleError$)
        );
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('review')).pipe(
            concatMap(messages => from(messages)),
            map(this.formatCodeReviewAsChoice),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        const diff = this.params.stagedDiff.diff;
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, locale, generate, type, maxLength } = this.params.config;

        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            vcs_branch: this.params.branchName || '',
        };

        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);
        const userPrompt = requestType === 'review' ? diff : `Here's the diff:\n\n${diff}`;
        const content = await this.makeRequest(generatedSystemPrompt, userPrompt, requestType, diff);

        if (requestType === 'review') {
            return this.parseCodeReview(content);
        }
        return this.parseMessage(content, type, generate);
    }

    private async loadSdkModule(): Promise<CopilotSdkModule> {
        try {
            return (await import('@github/copilot-sdk')) as CopilotSdkModule;
        } catch (error) {
            const sdkError = new Error('Copilot SDK package is missing. Install with: npm install @github/copilot-sdk') as AIServiceError;
            sdkError.code = 'SDK_NOT_INSTALLED';
            sdkError.originalError = error;
            throw sdkError;
        }
    }

    private extractContent(response: unknown): string {
        if (!response || typeof response !== 'object') {
            return '';
        }

        const candidate = response as Record<string, unknown>;
        const data = candidate.data as Record<string, unknown> | undefined;
        const direct = candidate.content;
        const fromData = data?.content;

        if (typeof direct === 'string') {
            return direct.trim();
        }
        if (typeof fromData === 'string') {
            return fromData.trim();
        }

        const messageContent = (data?.message as Record<string, unknown> | undefined)?.content;
        if (typeof messageContent === 'string') {
            return messageContent.trim();
        }

        return '';
    }

    private async makeRequest(systemPrompt: string, userPrompt: string, requestType: RequestType, diff: string): Promise<string> {
        const { CopilotClient, approveAll } = await this.loadSdkModule();
        const configuredModel = Array.isArray(this.params.config.model)
            ? this.params.config.model[0]
            : this.params.config.model || COPILOT_SDK_DEFAULT_MODEL;
        const modelCandidates = getCopilotSdkModelCandidates(configuredModel);
        const { logging } = this.params.config;

        let lastError: AIServiceError | undefined;
        for (const model of modelCandidates) {
            const url = 'copilot-sdk://session';
            const headers = {
                Authorization: 'Copilot CLI session',
            };
            const payload = {
                model,
                prompt: userPrompt,
            };

            logAIRequest(diff, requestType, 'Copilot SDK', model, url, headers, logging);
            logAIPrompt(diff, requestType, 'Copilot SDK', systemPrompt, userPrompt, logging);
            logAIPayload(diff, requestType, 'Copilot SDK', payload, logging);

            const startTime = Date.now();
            let client: CopilotSdkClient | undefined;
            try {
                const clientOptions = buildCopilotSdkClientOptions(process.env);
                client = new CopilotClient(clientOptions);
                const session = await client.createSession({
                    model,
                    onPermissionRequest: approveAll,
                });
                const response = await session.sendAndWait({ prompt: `${systemPrompt}\n\n${userPrompt}` });
                const content = this.extractContent(response);
                if (!content) {
                    const noContentError = new Error('No content in Copilot SDK response') as AIServiceError;
                    noContentError.code = 'NO_CONTENT';
                    throw noContentError;
                }

                const duration = Date.now() - startTime;
                logAIResponse(diff, requestType, 'Copilot SDK', response, logging);
                logAIComplete(diff, requestType, 'Copilot SDK', duration, content, logging);
                return content;
            } catch (error) {
                const aiError = error instanceof Error ? (error as AIServiceError) : (new Error(String(error)) as AIServiceError);
                const message = aiError.message || String(error);
                if (!aiError.code && isCopilotSdkAuthError(message)) {
                    aiError.code = 'AUTHENTICATION_FAILED';
                }
                if (!aiError.code && isCopilotSdkModelAccessError(message)) {
                    aiError.code = 'MODEL_NOT_AVAILABLE';
                }

                logAIError(diff, requestType, 'Copilot SDK', aiError, logging);
                lastError = aiError;

                const shouldTryNextModel = aiError.code === 'MODEL_NOT_AVAILABLE' && model !== modelCandidates[modelCandidates.length - 1];
                if (!shouldTryNextModel) {
                    throw aiError;
                }
            } finally {
                if (client?.stop) {
                    await client.stop();
                }
            }
        }

        throw lastError || new Error('Copilot SDK request failed for all candidate models');
    }
}
