import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, Subject, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { isReasoningModel } from '../../utils/openai.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

export class OpenRouterService extends AIService {
    private openAI: OpenAI;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#f97316',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[OpenRouter]');
        this.errorPrefix = chalk.red.bold('[OpenRouter]');

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

    private getOpenRouterHeaders = (): Record<string, string> => ({
        'HTTP-Referer': 'https://github.com/tak-bro/aicommit2',
        'X-OpenRouter-Title': 'aicommit2',
        'X-OpenRouter-Categories': 'cli-agent',
    });

    private hasRequestObject = (value: unknown): value is Record<string, unknown> => {
        return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
    };

    private getRequestPayloadExtras = (): Record<string, unknown> => {
        const config = this.params.config as Record<string, unknown>;
        const extras: Record<string, unknown> = {};

        if (this.hasRequestObject(config.responseFormat)) {
            extras.response_format = config.responseFormat;
        }

        if (this.hasRequestObject(config.provider)) {
            extras.provider = config.provider;
        }

        if (this.hasRequestObject(config.reasoning)) {
            extras.reasoning = config.reasoning;
        }

        return extras;
    };

    private buildChatCompletionPayload = (systemPrompt: string, userPrompt: string, stream: boolean): Record<string, unknown> => {
        const maxTokens = this.params.config.maxTokens;
        const temperature = this.params.config.temperature;
        const reasoningModel = isReasoningModel(this.params.config.model);

        return {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: this.params.config.model,
            stream,
            ...this.getRequestPayloadExtras(),
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
        const isStream = this.params.config.stream || false;

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
            subject => {
                this.streamChunks(subject).catch(err => subject.error(err));
            },
            type,
            generate
        );
    };

    private streamChunks = async (subject: Subject<string>): Promise<void> => {
        const diff = this.params.stagedDiff.diff;
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, locale, generate, type, maxLength, timeout } =
            this.params.config;
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
        const generatedSystemPrompt = generatePrompt(promptOptions);

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
        const payload: any = this.buildChatCompletionPayload(generatedSystemPrompt, userPrompt, true);

        logAIPayload(diff, 'commit', serviceName, payload, logging);

        const startTime = Date.now();
        let accumulatedText = '';

        try {
            const stream = await this.openAI.chat.completions.create(payload, { timeout });
            const chatCompletionStream = stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

            for await (const chunk of chatCompletionStream) {
                const content = chunk.choices?.[0]?.delta?.content || '';
                // OpenRouter may forward reasoning content for reasoning-capable models.
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const reasoning = (chunk.choices?.[0]?.delta as any)?.reasoning_content || '';
                const chunkText = `${content}${reasoning}`;

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
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, locale, generate, type, maxLength, timeout } =
            this.params.config;
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

        // OpenRouter adds extra request fields beyond the base OpenAI SDK typing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = this.buildChatCompletionPayload(generatedSystemPrompt, userPrompt, false);

        logAIPayload(diff, requestType, serviceName, payload, logging);

        const startTime = Date.now();

        try {
            const chatCompletion = await this.openAI.chat.completions.create(payload, {
                timeout,
            });

            const result =
                chatCompletion.choices?.[0]?.message.content || (chatCompletion.choices?.[0]?.message as any)?.reasoning_content || '';

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
}
