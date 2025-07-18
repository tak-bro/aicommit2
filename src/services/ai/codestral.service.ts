import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { CreateChatCompletionsResponse } from './mistral.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';
import { getRandomNumber } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';
export interface CodestralServiceError extends AIServiceError {}

export class CodestralService extends AIService {
    private apiKey = '';

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#e28c58',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[Codestral]`);
        this.errorPrefix = chalk.red.bold(`[Codestral]`);
        this.apiKey = this.params.config.key;
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Codestral-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Codestral API key in configuration';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or upgrade your Codestral plan';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Codestral model name is correct';
        }
        if (errorMsg.includes('Invalid model type')) {
            return 'Invalid model type. Use supported models: codestral-latest, codestral-2501';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Codestral service is overloaded. Try again in a few minutes';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Codestral model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Codestral model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Codestral server error. Try again later';
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

        this.checkAvailableModels();

        const userPrompt = generateUserPrompt(diff, requestType);
        const baseUrl = this.params.config.url || 'https://codestral.mistral.ai';
        const url = `${baseUrl}/v1/chat/completions`;
        const headers = {
            Authorization: `Bearer ${this.apiKey}`,
            'content-type': 'application/json',
        };

        // 상세 로깅
        logAIRequest(diff, requestType, 'Codestral', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'Codestral', generatedSystemPrompt, userPrompt, logging);

        const chatResponse = await this.createChatCompletions(generatedSystemPrompt, requestType);
        if (requestType === 'review') {
            return this.sanitizeResponse(chatResponse);
        }
        return this.parseMessage(chatResponse, type, generate);
    }

    private checkAvailableModels() {
        const supportModels = ['codestral-latest', 'codestral-2501'];

        if (supportModels.includes(this.params.config.model)) {
            return true;
        }
        throw new Error(`Invalid model type of Codestral AI`);
    }

    private async createChatCompletions(systemPrompt: string, requestType: RequestType) {
        const diff = this.params.stagedDiff.diff;
        const { logging } = this.params.config;
        const baseUrl = this.params.config.url || 'https://codestral.mistral.ai';

        const payload = {
            model: this.params.config.model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: generateUserPrompt(this.params.stagedDiff.diff, requestType),
                },
            ],
            temperature: this.params.config.temperature,
            top_p: this.params.config.topP,
            max_tokens: this.params.config.maxTokens,
            stream: false,
            safe_prompt: false,
            random_seed: getRandomNumber(10, 1000),
        };

        if (requestType === 'commit') {
            (payload as any).response_format = {
                type: 'json_object',
            };
        }

        logAIPayload(diff, requestType, 'Codestral', payload, logging);

        const startTime = Date.now();

        try {
            const requestBuilder = new HttpRequestBuilder({
                method: 'POST',
                baseURL: `${baseUrl}/v1/chat/completions`,
                timeout: this.params.config.timeout,
            })
                .setHeaders({
                    Authorization: `Bearer ${this.apiKey}`,
                    'content-type': 'application/json',
                })
                .setBody(payload);

            const response: AxiosResponse<CreateChatCompletionsResponse> = await requestBuilder.execute();
            const duration = Date.now() - startTime;
            const result: CreateChatCompletionsResponse = response.data;

            logAIResponse(diff, requestType, 'Codestral', result, logging);

            const hasNoChoices = !result.choices || result.choices.length === 0;
            if (hasNoChoices || !result.choices[0].message?.content) {
                const errorData = { message: 'No Content on response', result };
                logAIError(diff, requestType, 'Codestral', errorData, logging);
                throw new Error(`No Content on response. Please open a Bug report`);
            }

            const content = result.choices[0].message.content;
            logAIComplete(diff, requestType, 'Codestral', duration, content, logging);

            return content;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'Codestral', error, logging);
            throw error;
        }
    }
}
