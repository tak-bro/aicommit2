import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Ollama } from 'ollama';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { Agent, fetch } from 'undici';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_OLLAMA_HOST } from '../../utils/config.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { capitalizeFirstLetter, getRandomNumber } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface OllamaServiceError extends AIServiceError {}

export class OllamaService extends AIService {
    private host = DEFAULT_OLLAMA_HOST;
    private model = '';
    private key = '';
    private auth = '';
    private ollama: Ollama;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#FFF',
            secondary: '#000',
        };
        this.model = this.params.keyName;
        this.serviceName = chalk
            .bgHex(this.colors.primary)
            .hex(this.colors.secondary)
            .bold(`[${capitalizeFirstLetter(this.model)}]`);
        this.errorPrefix = chalk.red.bold(`[${capitalizeFirstLetter(this.model)}]`);
        this.host = this.params.config.host || DEFAULT_OLLAMA_HOST;
        this.auth = this.params.config.auth || 'Bearer';
        this.key = this.params.config.key || '';

        this.ollama = new Ollama({
            host: this.host,
            fetch: this.setupFetch,
            ...(this.key && { headers: { Authorization: `${this.auth} ${this.key}` } }),
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Ollama-specific error messages
        if (errorMsg.includes('ECONNREFUSED') || errorMsg.includes('connection')) {
            return `Cannot connect to Ollama server at ${this.host}. Make sure Ollama is running`;
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return `Model '${this.model}' not found. Pull the model with: ollama pull ${this.model}`;
        }
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
            return 'Authentication failed. Check your Ollama API key if authentication is enabled';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Check your Ollama server permissions';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return `Model '${this.model}' not found on Ollama server. Pull it first with: ollama pull ${this.model}`;
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Ollama server error. Check server logs and try again';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Ollama server is overloaded. Try again in a few minutes';
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
            vcs_branch: this.params.branchName || '',
        };
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        await this.checkIsAvailableOllama();

        const userPrompt = `Here is the diff: ${diff}`;
        const serviceName = `Ollama_${this.model}`;
        const url = `${this.host}/api/chat`;
        const headers = this.key ? { Authorization: `${this.auth} ${this.key}` } : {};

        // 상세 로깅
        logAIRequest(diff, requestType, serviceName, this.model, url, headers, logging);
        logAIPrompt(diff, requestType, serviceName, generatedSystemPrompt, userPrompt, logging);

        const chatResponse = await this.createChatCompletions(generatedSystemPrompt, userPrompt, requestType);

        // 완룈 로깅은 createChatCompletions 내부에서 처리
        if (requestType === 'review') {
            return this.sanitizeResponse(chatResponse);
        }
        return this.parseMessage(chatResponse, type, generate);
    }

    private async checkIsAvailableOllama() {
        const builder = new HttpRequestBuilder({
            method: 'GET',
            baseURL: `${this.host}`,
            timeout: this.params.config.timeout,
        });

        if (this.key) {
            builder.setHeaders({
                Authorization: `${this.auth} ${this.key}`,
            });
        }

        const response = await builder.execute();
        return response.data;
    }

    private async createChatCompletions(systemPrompt: string, userMessage: string, requestType: RequestType) {
        const { stream, numCtx, temperature, topP, timeout, maxTokens, logging } = this.params.config;
        const isStream = stream || false;
        const diff = this.params.stagedDiff.diff;
        const serviceName = `Ollama_${this.model}`;

        const payload = {
            model: this.model,
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
            stream: isStream,
            keep_alive: timeout,
            options: {
                num_ctx: numCtx,
                temperature: temperature,
                top_p: topP,
                seed: getRandomNumber(10, 1000),
                num_predict: maxTokens ?? -1,
            },
        };

        logAIPayload(diff, requestType, serviceName, payload, logging);

        const startTime = Date.now();

        try {
            const response = await this.ollama.chat(payload);
            const duration = Date.now() - startTime;

            let result = '';
            if (isStream) {
                if (response) {
                    for await (const part of response) {
                        result += part.message.content;
                    }
                }
            } else {
                result = response.message.content;
            }

            logAIResponse(diff, requestType, serviceName, { response: result, fullResponse: response }, logging);
            logAIComplete(diff, requestType, serviceName, duration, result, logging);

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, serviceName, error, logging);
            throw error;
        }
    }

    // TODO: add proper type
    private setupFetch = (input: any, init: any = {}): any => {
        return fetch(input as string | URL, {
            ...init,
            dispatcher: new Agent({ headersTimeout: this.params.config.timeout }),
        });
    };
}
