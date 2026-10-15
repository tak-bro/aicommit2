import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, Subject, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { isLoggerInitialized, logger } from '../../utils/logger.js';
import { isReasoningModel } from '../../utils/openai.js';
import { codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

interface OpenRouterModel {
    id?: string;
    canonical_slug?: string;
    name?: string;
    context_length?: number;
    supported_parameters?: string[];
    top_provider?: {
        context_length?: number;
        max_completion_tokens?: number;
        is_moderated?: boolean;
    };
}

interface OpenRouterModelsListResponse {
    data?: OpenRouterModel[];
}

export class OpenRouterService extends AIService {
    private openAI: OpenAI;
    private static readonly catalogCache = new Map<string, OpenRouterModel[]>();
    private static readonly modelCache = new Map<string, OpenRouterModel | null>();
    private static readonly FREE_MODEL_KEYWORD = 'free';
    private static readonly FREE_MODEL_RACE_LIMIT = 5;

    protected readonly selfDescribingErrors: ReadonlySet<string> = new Set([
        'InvalidJsonResponse',
        'FreeModelRaceFailed',
        'FreeModelUnavailable',
    ]);

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#f97316',
            secondary: '#fff',
        };
        this.serviceName = this.buildServiceName();
        this.errorPrefix = chalk.red.bold(`[OpenRouter${this.formatModelSuffix()}]`);

        const baseUrl = this.params.config.url || 'https://openrouter.ai';
        const basePath = (this.params.config.path || '/api/v1/chat/completions').replace(/\/chat\/completions\/?$/, '');
        this.openAI = new OpenAI({
            apiKey: this.params.config.key,
            baseURL: `${baseUrl}${basePath}`,
            defaultHeaders: {
                ...this.getOpenRouterHeaders(),
            },
        });
    }

    private buildServiceName = (): string => {
        return chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[OpenRouter${this.formatModelSuffix()}]`);
    };

    private getOpenRouterBaseUrl = (): string => {
        return (this.params.config.url || 'https://openrouter.ai').replace(/\/$/, '');
    };

    private getOpenRouterCatalogUrl = (): string => {
        return `${this.getOpenRouterBaseUrl()}/api/v1`;
    };

    private getOpenRouterHeaders = (): Record<string, string> => ({
        'HTTP-Referer': 'https://github.com/tak-bro/aicommit2',
        'X-OpenRouter-Title': 'aicommit2',
        'X-OpenRouter-Categories': 'cli-agent',
    });

    private getOpenRouterAuthHeaders = (): Record<string, string> => ({
        Authorization: `Bearer ${this.params.config.key}`,
        'Content-Type': 'application/json',
        ...this.getOpenRouterHeaders(),
    });

    private hasRequestObject = (value: unknown): value is Record<string, unknown> => {
        return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
    };

    private getRequestedModel = (): string => {
        if (Array.isArray(this.params.config.model)) {
            return this.params.config.model[0] || '';
        }

        return typeof this.params.config.model === 'string' ? this.params.config.model : '';
    };

    private getCatalogCacheKey = (): string => {
        return `${this.getOpenRouterCatalogUrl()}|${this.params.config.key || ''}`;
    };

    private getModelCacheKey = (model: string): string => {
        return `${this.getCatalogCacheKey()}|${model}`;
    };

    private async fetchOpenRouterCatalog(): Promise<OpenRouterModel[]> {
        const cacheKey = this.getCatalogCacheKey();
        const cachedCatalog = OpenRouterService.catalogCache.get(cacheKey);
        if (cachedCatalog) {
            return cachedCatalog;
        }

        const catalogPaths = ['/models/user', '/models'];
        let lastError: unknown;

        for (const catalogPath of catalogPaths) {
            try {
                const response = await new HttpRequestBuilder({
                    method: 'GET',
                    baseURL: `${this.getOpenRouterCatalogUrl()}${catalogPath}`,
                    timeout: this.params.config.timeout,
                })
                    .setHeaders(this.getOpenRouterAuthHeaders())
                    .execute<OpenRouterModelsListResponse>();

                const catalog = response.data?.data ?? [];
                OpenRouterService.catalogCache.set(cacheKey, catalog);
                return catalog;
            } catch (error) {
                lastError = error;
                const errorMsg = error instanceof Error ? error.message : String(error);
                if (!errorMsg.includes('404')) {
                    throw error;
                }
            }
        }

        throw lastError instanceof Error ? lastError : new Error(String(lastError));
    }

    private matchOpenRouterModel = (model: string, catalog: OpenRouterModel[]): OpenRouterModel | undefined => {
        const normalized = model.trim();

        return catalog.find(entry => {
            const candidates = [entry.id, entry.canonical_slug, entry.name].filter((value): value is string => !!value);
            return candidates.some(candidate => candidate === normalized);
        });
    };

    private async getOpenRouterModel(model?: string): Promise<OpenRouterModel | null> {
        const requestedModel = model || this.getRequestedModel();
        if (!requestedModel || requestedModel === 'openrouter/auto') {
            return null;
        }

        const cacheKey = this.getModelCacheKey(requestedModel);
        const cachedModel = OpenRouterService.modelCache.get(cacheKey);
        if (cachedModel !== undefined) {
            return cachedModel;
        }

        try {
            const catalog = await this.fetchOpenRouterCatalog();
            const matchedModel = this.matchOpenRouterModel(requestedModel, catalog) || null;
            OpenRouterService.modelCache.set(cacheKey, matchedModel);
            return matchedModel;
        } catch {
            return null;
        }
    }

    private async supportsOpenRouterParameters(parameters: string[], model?: string): Promise<boolean> {
        const modelEntry = await this.getOpenRouterModel(model);
        if (!modelEntry) {
            return false;
        }

        return parameters.some(parameter => modelEntry.supported_parameters?.includes(parameter) ?? false);
    }

    protected async isResponseFormatSupported(model?: string): Promise<boolean> {
        return this.supportsOpenRouterParameters(['response_format'], model);
    }

    protected async isReasoningSupported(model?: string): Promise<boolean> {
        return this.supportsOpenRouterParameters(['reasoning', 'include_reasoning'], model);
    }

    private getRequestPayloadExtras = async (model?: string): Promise<Record<string, unknown>> => {
        const config = this.params.config as Record<string, unknown>;
        const extras: Record<string, unknown> = {};
        const responseFormat = this.hasRequestObject(config.responseFormat) ? config.responseFormat : { type: 'json_object' };

        // Only send structured-output hints when OpenRouter says the model supports them.
        if (responseFormat && (await this.isResponseFormatSupported(model))) {
            extras.response_format = responseFormat;
        }

        if (this.hasRequestObject(config.provider)) {
            extras.provider = config.provider;
        }

        const reasoning = await this.getReasoningPayload(model);
        if (reasoning) {
            extras.reasoning = reasoning;
        }

        return extras;
    };

    private async getReasoningPayload(model?: string): Promise<Record<string, unknown> | undefined> {
        if (!(await this.isReasoningSupported(model))) {
            return undefined;
        }

        const config = this.params.config as Record<string, unknown>;
        const configuredReasoning = this.hasRequestObject(config.reasoning) ? { ...config.reasoning } : undefined;
        const reasoning = configuredReasoning ? { ...configuredReasoning } : {};

        // Hide reasoning by default so OpenRouter reasoning models still return parseable final content.
        if (!('exclude' in reasoning)) {
            reasoning.exclude = true;
        }

        return reasoning;
    }

    private extractOpenRouterText = (message: unknown): string => {
        if (!message || typeof message !== 'object') {
            return '';
        }

        const response = message as { content?: string; reasoning?: string; reasoning_content?: string };
        return response.content || response.reasoning_content || response.reasoning || '';
    };

    private buildChatCompletionPayload = async (
        systemPrompt: string,
        userPrompt: string,
        stream: boolean,
        modelOverride?: string
    ): Promise<Record<string, unknown>> => {
        const maxTokens = this.params.config.maxTokens;
        const temperature = this.params.config.temperature;
        const model = modelOverride || this.getRequestedModel();
        const reasoningModel = isReasoningModel(model);

        return {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model,
            stream,
            ...((await this.getRequestPayloadExtras(modelOverride)) || {}),
            ...(reasoningModel
                ? {
                      max_completion_tokens: maxTokens,
                      temperature: 1,
                  }
                : {
                      max_tokens: maxTokens,
                      top_p: this.params.config.topP,
                      temperature,
                  }),
        };
    };

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your OpenRouter API key in configuration';
        }
        if (errorMsg.includes('402') || errorMsg.includes('Payment Required')) {
            return 'OpenRouter credits are exhausted or billing is required. Check your account balance.';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or check your OpenRouter limits';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the OpenRouter model name is correct';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this OpenRouter model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your OpenRouter configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'OpenRouter server error. Try again later';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'OpenRouter is overloaded. Try again in a few minutes';
        }

        return null;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        const isStream = (this.params.config.stream || false) && !this.isFreeModelMode();

        if (isStream) {
            return this.generateStreamingCommitMessage$();
        }

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

    private generateStreamingCommitMessage$ = (): Observable<ReactiveListChoice> => {
        const { generate, type } = this.params.config;

        return this.createStreamingCommitMessages$(
            (subject, signal) => {
                this.streamChunks(subject, signal).catch(err => subject.error(err));
            },
            type,
            generate
        );
    };

    private streamChunks = async (subject: Subject<string>, signal: AbortSignal): Promise<void> => {
        const diff = this.params.stagedDiff.diff;
        const { logging, timeout } = this.params.config;
        const generatedSystemPrompt = generatePrompt(this.buildPromptOptions());

        const userPrompt = `Here is the diff: ${diff}`;
        const serviceName = 'OpenRouter';
        const url = `${this.params.config.url || 'https://openrouter.ai'}${this.params.config.path || '/api/v1/chat/completions'}`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
            ...this.getOpenRouterHeaders(),
        };

        logAIRequest(diff, 'commit', serviceName, this.params.config.model, url, headers, logging);
        logAIPrompt(diff, 'commit', serviceName, generatedSystemPrompt, userPrompt, logging);

        // OpenRouter adds extra request fields beyond the base OpenAI SDK typing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = await this.buildChatCompletionPayload(generatedSystemPrompt, userPrompt, true);

        logAIPayload(diff, 'commit', serviceName, payload, logging);

        const startTime = Date.now();
        let accumulatedText = '';

        try {
            const stream = await this.openAI.chat.completions.create(payload, { timeout, signal });
            const chatCompletionStream = stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

            for await (const chunk of chatCompletionStream) {
                const chunkText = this.extractOpenRouterText(chunk.choices?.[0]?.delta);

                if (chunkText) {
                    accumulatedText += chunkText;
                    subject.next(chunkText);
                }
            }

            const duration = Date.now() - startTime;
            logAIResponse(diff, 'commit', serviceName, { streamed: true, totalLength: accumulatedText.length }, logging);
            logAIComplete(diff, 'commit', serviceName, duration, accumulatedText, logging);

            subject.complete();
        } catch (error) {
            logAIError(diff, 'commit', serviceName, error, logging);
            subject.error(error);
        }
    };

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        const diff = this.params.stagedDiff.diff;
        const { logging, generate, type, timeout } = this.params.config;
        const promptOptions = this.buildPromptOptions();
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        const userPrompt = `Here is the diff: ${diff}`;
        const serviceName = 'OpenRouter';
        const url = `${this.params.config.url || 'https://openrouter.ai'}${this.params.config.path || '/api/v1/chat/completions'}`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
            ...this.getOpenRouterHeaders(),
        };

        logAIRequest(diff, requestType, serviceName, this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, serviceName, generatedSystemPrompt, userPrompt, logging);

        if (this.isFreeModelMode()) {
            const startTime = Date.now();
            try {
                const { messages, raw } = await this.generateFreeModelMessage(requestType, generatedSystemPrompt, userPrompt);
                logAIComplete(diff, requestType, serviceName, Date.now() - startTime, raw, logging);
                return messages;
            } catch (error) {
                logAIError(diff, requestType, serviceName, error, logging);
                throw error;
            }
        }

        // OpenRouter adds extra request fields beyond the base OpenAI SDK typing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = await this.buildChatCompletionPayload(generatedSystemPrompt, userPrompt, false);

        logAIPayload(diff, requestType, serviceName, payload, logging);

        const startTime = Date.now();

        try {
            const chatCompletion = await this.openAI.chat.completions.create(payload, {
                timeout,
            });

            const result = this.extractOpenRouterText(chatCompletion.choices?.[0]?.message);

            const duration = Date.now() - startTime;
            logAIResponse(diff, requestType, serviceName, chatCompletion, logging);
            logAIComplete(diff, requestType, serviceName, duration, result, logging);

            if (requestType === 'review') {
                return this.parseCodeReview(result);
            }
            return this.parseMessage(result, type, generate);
        } catch (error) {
            logAIError(diff, requestType, serviceName, error, logging);
            throw error;
        }
    }

    private isFreeModelMode = (): boolean => {
        return this.getRequestedModel().trim().toLowerCase() === OpenRouterService.FREE_MODEL_KEYWORD;
    };

    // Keep only free models that support response_format; guardrail/classifier models never return commit JSON.
    private getFreeJsonCapableModels = async (): Promise<OpenRouterModel[]> => {
        const catalog = await this.fetchOpenRouterCatalog();

        const candidates = catalog.filter(
            model => !!model.id && model.id.endsWith(':free') && (model.supported_parameters?.includes('response_format') ?? false)
        );
        // Shuffle so a rate-limited head of the catalog does not fail every run
        for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        return candidates.slice(0, OpenRouterService.FREE_MODEL_RACE_LIMIT);
    };

    private applyWinningModel = (modelId: string): void => {
        this.params.config.model = [modelId];
        this.serviceName = this.buildServiceName();
        this.errorPrefix = chalk.red.bold(`[OpenRouter${this.formatModelSuffix()}]`);
    };

    private async requestFreeModel(
        modelId: string,
        requestType: RequestType,
        systemPrompt: string,
        userPrompt: string,
        signal: AbortSignal
    ): Promise<{ messages: AIResponse[]; raw: string }> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = await this.buildChatCompletionPayload(systemPrompt, userPrompt, false, modelId);
        logAIPayload(this.params.stagedDiff.diff, requestType, 'OpenRouter', payload, this.params.config.logging);
        const chatCompletion = await this.openAI.chat.completions.create(payload, {
            timeout: this.params.config.timeout,
            signal,
        });

        const result = this.extractOpenRouterText(chatCompletion.choices?.[0]?.message);
        if (!result.trim()) {
            throw new Error('empty response');
        }

        const messages =
            requestType === 'review'
                ? this.parseCodeReview(result)
                : this.parseMessage(result, this.params.config.type, this.params.config.generate);
        return { messages, raw: result };
    }

    private logRace = (level: 'info' | 'warn', message: string): void => {
        if (isLoggerInitialized()) {
            logger[level](message);
        }
    };

    private async generateFreeModelMessage(
        requestType: RequestType,
        systemPrompt: string,
        userPrompt: string
    ): Promise<{ messages: AIResponse[]; raw: string }> {
        const candidates = await this.getFreeJsonCapableModels();
        if (candidates.length === 0) {
            const error: AIServiceError = new Error('No free OpenRouter models with JSON output support are currently available.');
            error.name = 'FreeModelUnavailable';
            throw error;
        }

        this.logRace('info', `OpenRouter: racing ${candidates.length} free models: ${candidates.map(c => c.id).join(', ')}`);

        return new Promise((resolve, reject) => {
            let settled = false;
            const failures: string[] = [];
            // Abort the losers once a winner resolves so they stop consuming free-tier quota
            const controllers = candidates.map(() => new AbortController());

            candidates.forEach((candidate, index) => {
                const modelId = candidate.id as string;
                const startTime = Date.now();

                this.requestFreeModel(modelId, requestType, systemPrompt, userPrompt, controllers[index].signal)
                    .then(result => {
                        if (settled) {
                            return;
                        }
                        settled = true;
                        controllers.forEach((controller, i) => i !== index && controller.abort());
                        this.logRace('info', `OpenRouter: free model ${modelId} won in ${Date.now() - startTime}ms`);
                        this.applyWinningModel(modelId);
                        resolve(result);
                    })
                    .catch(error => {
                        if (settled) {
                            return;
                        }
                        const message = error instanceof Error ? error.message : String(error);
                        // Full reason goes to the log; the select list gets a short one per model
                        failures.push(`${modelId}: ${message.length > 80 ? `${message.slice(0, 80)}...` : message}`);
                        this.logRace('warn', `OpenRouter: free model ${modelId} failed: ${message}`);

                        if (failures.length === candidates.length) {
                            const raceError: AIServiceError = new Error(`All free OpenRouter models failed. ${failures.join('; ')}`);
                            raceError.name = 'FreeModelRaceFailed';
                            reject(raceError);
                        }
                    });
            });
        });
    }
}
