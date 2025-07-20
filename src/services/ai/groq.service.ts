import chalk from 'chalk';
import Groq from 'groq-sdk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

export class GroqService extends AIService {
    private groq: Groq;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#f55036',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Groq]');
        this.errorPrefix = chalk.red.bold(`[Groq]`);
        this.groq = new Groq({ apiKey: this.params.config.key });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Groq-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Groq API key in configuration';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or upgrade your Groq plan';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Groq model name is correct';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Groq service is overloaded. Try again in a few minutes';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Groq model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Groq model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Groq server error. Try again later';
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
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, locale, temperature, generate, type, maxLength } =
            this.params.config;
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

        // 상세 로깅 (config URL 사용)
        const baseUrl = this.params.config.url || 'https://api.groq.com';
        const url = `${baseUrl}/openai/v1/chat/completions`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
        };

        logAIRequest(diff, requestType, 'Groq', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'Groq', generatedSystemPrompt, userPrompt, logging);

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
            max_tokens: maxTokens,
            top_p: this.params.config.topP,
            temperature,
        };

        logAIPayload(diff, requestType, 'Groq', payload, logging);

        const startTime = Date.now();

        try {
            const chatCompletion: Groq.Chat.ChatCompletion = await this.groq.chat.completions.create(payload, {
                timeout: this.params.config.timeout,
            });

            const duration = Date.now() - startTime;
            const result = chatCompletion.choices[0].message.content || '';

            logAIResponse(diff, requestType, 'Groq', chatCompletion, logging);
            logAIComplete(diff, requestType, 'Groq', duration, result, logging);

            if (requestType === 'review') {
                return this.sanitizeResponse(result);
            }
            return this.parseMessage(result, type, generate);
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'Groq', error, logging);
            throw error;
        }
    }
}
