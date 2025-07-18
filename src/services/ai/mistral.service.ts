import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { getRandomNumber } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface MistralServiceError extends AIServiceError {}

export interface ListAvailableModelsResponse {
    object: string;
    data: {
        id: string;
        object: string;
        created: number;
        owned_by: string;
    }[];
}

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

export class MistralService extends AIService {
    private apiKey = '';

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#ff7000',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[MistralAI]');
        this.errorPrefix = chalk.red.bold(`[MistralAI]`);
        this.apiKey = this.params.config.key;
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Mistral-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Mistral AI API key in configuration';
        }
        if (errorMsg.includes('quota') || errorMsg.includes('usage')) {
            return 'API quota exceeded. Check your Mistral AI usage limits';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Mistral model name is correct';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Mistral model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Mistral model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Mistral AI server error. Try again later';
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
        };
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        await this.checkAvailableModels();

        const userPrompt = `Here is the diff: ${diff}`;
        const baseUrl = this.params.config.url || 'https://api.mistral.ai';
        const url = `${baseUrl}/v1/chat/completions`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            'content-type': 'application/json',
        };

        // 상세 로깅
        logAIRequest(diff, requestType, 'MistralAI', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'MistralAI', generatedSystemPrompt, userPrompt, logging);

        const chatResponse = await this.createChatCompletions(generatedSystemPrompt, userPrompt, requestType);

        // 완룈 로깅은 createChatCompletions 내부에서 처리
        if (requestType === 'review') {
            return this.sanitizeResponse(chatResponse);
        }
        return this.parseMessage(chatResponse, type, generate);
    }

    private async checkAvailableModels() {
        const availableModels = await this.getAvailableModels();
        if (availableModels.includes(this.params.config.model)) {
            return true;
        }
        throw new Error(`Invalid model type of Mistral AI: ${this.params.config.model}`);
    }

    private async getAvailableModels() {
        const baseUrl = this.params.config.url || 'https://api.mistral.ai';
        const response: AxiosResponse<ListAvailableModelsResponse> = await new HttpRequestBuilder({
            method: 'GET',
            baseURL: `${baseUrl}/v1/models`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                Authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
            })
            .execute();

        return response.data.data.filter(model => model.object === 'model').map(model => model.id);
    }

    private async createChatCompletions(systemPrompt: string, userMessage: string, requestType: RequestType) {
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
                    content: userMessage,
                },
            ],
            temperature: this.params.config.temperature,
            top_p: this.params.config.topP,
            max_tokens: this.params.config.maxTokens,
            stream: false,
            safe_prompt: false,
            random_seed: getRandomNumber(10, 1000),
        };

        logAIPayload(diff, requestType, 'MistralAI', payload, logging);

        const startTime = Date.now();

        try {
            const baseUrl = this.params.config.url || 'https://api.mistral.ai';
            const response: AxiosResponse<CreateChatCompletionsResponse> = await new HttpRequestBuilder({
                method: 'POST',
                baseURL: `${baseUrl}/v1/chat/completions`,
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

            logAIResponse(diff, requestType, 'MistralAI', result, logging);

            const hasNoChoices = !result.choices || result.choices.length === 0;
            if (hasNoChoices || !result.choices[0].message?.content) {
                const errorData = { message: 'No Content on response', result };
                logAIError(diff, requestType, 'MistralAI', errorData, logging);
                throw new Error(`No Content on response. Please open a Bug report`);
            }

            const content = result.choices[0].message.content;
            logAIComplete(diff, requestType, 'MistralAI', duration, content, logging);

            return content;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'MistralAI', error, logging);
            throw error;
        }
    }
}
