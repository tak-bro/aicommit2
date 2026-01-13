import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface CreateChatCompletionsResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export class PerplexityService extends AIService {
    private apiKey = '';

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#20808D',
            secondary: '#FFF',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[Perplexity]`);
        this.errorPrefix = chalk.red.bold(`[Perplexity]`);
        this.apiKey = this.params.config.key;
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Perplexity-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Perplexity API key in configuration';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or upgrade your Perplexity plan';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Perplexity model name is correct';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Perplexity service is overloaded. Try again in a few minutes';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Perplexity model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Perplexity model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Perplexity server error. Try again later';
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

    private extractJSONFromError(error: string) {
        const regex = /[{[]{1}([,:{}[\]0-9.\-+Eaeflnr-u \n\r\t]|".*?")+[}\]]{1}/gis;
        const matches = error.match(regex);
        if (matches) {
            return Object.assign({}, ...matches.map((m: any) => JSON.parse(m)));
        }
        return {
            error: {
                message: 'Unknown error',
            },
        };
    }

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        const diff = this.params.stagedDiff.diff;
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, locale, generate, type, maxLength } = this.params.config;
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
        const baseUrl = this.params.config.url || 'https://api.perplexity.ai';
        const url = `${baseUrl}/chat/completions`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            'content-type': 'application/json',
        };

        // 상세 로깅
        logAIRequest(diff, requestType, 'Perplexity', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'Perplexity', generatedSystemPrompt, userPrompt, logging);

        const chatResponse = await this.createChatCompletions(generatedSystemPrompt, userPrompt, requestType);

        return this.parseMessage(chatResponse, type, generate);
    }

    private async createChatCompletions(systemPrompt: string, userPrompt: string, requestType: RequestType): Promise<string> {
        const diff = this.params.stagedDiff.diff;
        const { logging } = this.params.config;

        const payload = {
            model: this.params.config.model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: userPrompt,
                },
            ],
            temperature: this.params.config.temperature,
            top_p: this.params.config.topP,
            max_tokens: this.params.config.maxTokens,
            stream: false,
        };

        logAIPayload(diff, requestType, 'Perplexity', payload, logging);

        const startTime = Date.now();

        try {
            const baseUrl = this.params.config.url || 'https://api.perplexity.ai';
            const response: AxiosResponse<CreateChatCompletionsResponse> = await new HttpRequestBuilder({
                method: 'POST',
                baseURL: `${baseUrl}/chat/completions`,
                timeout: this.params.config.timeout,
            })
                .setHeaders({
                    Authorization: `Bearer ${this.apiKey}`,
                    'content-type': 'application/json',
                })
                .setBody(payload)
                .execute();

            const duration = Date.now() - startTime;
            const result: CreateChatCompletionsResponse = response.data;

            logAIResponse(diff, requestType, 'Perplexity', result, logging);

            const hasNoChoices = !result.choices || result.choices.length === 0;
            if (hasNoChoices || !result.choices[0].message?.content) {
                const errorData = { message: 'No Content on response', result };
                logAIError(diff, requestType, 'Perplexity', errorData, logging);
                throw new Error(`No Content on response. Please open a Bug report`);
            }

            const content = result.choices[0].message.content;
            logAIComplete(diff, requestType, 'Perplexity', duration, content, logging);

            return content;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'Perplexity', error, logging);
            throw error;
        }
    }
}
