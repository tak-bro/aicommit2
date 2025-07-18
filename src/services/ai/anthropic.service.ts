import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';

export interface AnthropicServiceError extends AIServiceError {
    error?: {
        error?: {
            message?: string;
        };
    };
}

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export class AnthropicService extends AIService {
    private anthropic: Anthropic;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#AE5630',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Anthropic]');
        this.errorPrefix = chalk.red.bold(`[Anthropic]`);
        this.anthropic = new Anthropic({
            apiKey: this.params.config.key,
            ...(this.params.config.timeout > DEFAULT_TIMEOUT && { timeout: this.params.config.timeout }),
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Anthropic-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Anthropic API key in configuration';
        }
        if (errorMsg.includes('quota') || errorMsg.includes('usage')) {
            return 'API quota exceeded. Check your Anthropic usage limits';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Claude model name is correct';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Claude model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Claude model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Anthropic server error. Try again later';
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
            temperature,
            locale,
            generate,
            type,
            maxLength,
            maxTokens,
            topP,
            model,
        } = this.params.config;

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

        const userPrompt = generateUserPrompt(diff, requestType);

        // 상세 로깅 (config URL 사용)
        const baseUrl = this.params.config.url || 'https://api.anthropic.com';
        const url = `${baseUrl}/v1/messages`;
        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.params.config.key,
            'anthropic-version': '2023-06-01',
        };

        logAIRequest(diff, requestType, 'Anthropic', model, url, headers, logging);
        logAIPrompt(diff, requestType, 'Anthropic', generatedSystemPrompt, userPrompt, logging);

        const params: Anthropic.MessageCreateParams = {
            max_tokens: maxTokens,
            temperature: temperature,
            system: generatedSystemPrompt,
            messages: [
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            top_p: topP,
            model: model,
        };

        logAIPayload(diff, requestType, 'Anthropic', params, logging);

        const startTime = Date.now();

        try {
            const result: Anthropic.Message = await this.anthropic.messages.create(params);
            const duration = Date.now() - startTime;

            // 응답 로깅
            logAIResponse(diff, requestType, 'Anthropic', result, logging);

            // @ts-ignore ignore
            const completion = result.content.map(({ text }) => text).join('');

            // 완료 로깅
            logAIComplete(diff, requestType, 'Anthropic', duration, completion, logging);

            return completion;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'Anthropic', error, logging);
            throw error;
        }

        if (requestType === 'review') {
            return this.sanitizeResponse(completion);
        }
        return this.parseMessage(completion, type, generate);
    }
}
