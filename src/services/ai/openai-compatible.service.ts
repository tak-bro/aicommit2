import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { capitalizeFirstLetter, generateColors } from '../../utils/utils.js';

export class OpenAICompatibleService extends AIService {
    private openAI: OpenAI;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        const keyName = this.params.keyName || 'OPENAI_COMPATIBLE';
        this.colors = generateColors(keyName);
        this.serviceName = chalk
            .bgHex(this.colors.primary)
            .hex(this.colors.secondary)
            .bold(`[${capitalizeFirstLetter(keyName)}]`);
        this.errorPrefix = chalk.red.bold(`[${capitalizeFirstLetter(keyName)}]`);

        this.openAI = new OpenAI({
            apiKey: this.params.config.key,
            baseURL: `${this.params.config.url}${this.params.config.path}`,
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // OpenAI-compatible API specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your OpenAI-compatible API key in configuration';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or check your service limits';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the model name is correct';
        }
        if (errorMsg.includes('network') || errorMsg.includes('connection')) {
            return 'Network error. Check your internet connection and API endpoint';
        }
        if (errorMsg.includes('quota') || errorMsg.includes('usage')) {
            return 'API quota exceeded. Check your usage limits';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your API configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Server error. Try again later';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Service is overloaded. Try again in a few minutes';
        }

        return null;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('commit')).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: this.params.config.includeBody ? data.value : data.title,
                description: this.params.config.includeBody ? data.value : '',
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('review')).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: data.value,
                description: data.value,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        const diff = this.params.stagedDiff.diff;
        const {
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            logging,
            locale,
            temperature,
            generate,
            type,
            maxLength,
            timeout,
            stream = false,
        } = this.params.config;
        const maxTokens = this.params.config.maxTokens;
        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
        };
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        const userPrompt = `Here is the diff: ${diff}`;
        const serviceName = this.params.keyName || 'OpenAI-Compatible';
        const url = `${this.params.config.url}${this.params.config.path}`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
        };

        // 상세 로깅
        logAIRequest(diff, requestType, serviceName, this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, serviceName, generatedSystemPrompt, userPrompt, logging);

        const payload = {
            messages: [
                {
                    role: 'system',
                    content: generatedSystemPrompt,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            model: this.params.config.model,
            stream,
            max_tokens: maxTokens,
            top_p: this.params.config.topP,
            temperature,
        };

        logAIPayload(diff, requestType, serviceName, payload, logging);

        const startTime = Date.now();

        try {
            const chatCompletion = await this.openAI.chat.completions.create(payload, {
                timeout,
            });

            let result = '';
            if (stream && chatCompletion) {
                const chatCompletionStream = chatCompletion as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;
                for await (const chunk of chatCompletionStream) {
                    // Adapt to DeepSeek's response format
                    const content = chunk.choices?.[0]?.delta?.content || '';
                    const reasoning = chunk.choices?.[0]?.delta?.reasoning_content || '';
                    const chunkText = `${content}${reasoning}`;
                    result += chunkText;
                }
            } else {
                result = chatCompletion.choices?.[0]?.message.content || '';
            }

            const duration = Date.now() - startTime;
            logAIResponse(diff, requestType, serviceName, chatCompletion, logging);
            logAIComplete(diff, requestType, serviceName, duration, result, logging);

            if (requestType === 'review') {
                return this.sanitizeResponse(result);
            }
            return this.parseMessage(result, type, generate);
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, serviceName, error, logging);
            throw error;
        }
    }
}
