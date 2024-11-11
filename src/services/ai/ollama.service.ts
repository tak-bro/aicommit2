import { Ollama } from '@tak-bro/ollama';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { DEFAULT_OLLAMA_HOST } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { RequestType, createLogResponse } from '../../utils/log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { capitalizeFirstLetter, getRandomNumber } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface OllamaServiceError extends AIServiceError {}

export class OllamaService extends AIService {
    private host = DEFAULT_OLLAMA_HOST;
    private model = '';
    private key = '';
    private ollama: Ollama;

    constructor(private readonly params: AIServiceParams) {
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
        this.key = this.params.config.key || '';
        this.ollama = new Ollama({
            host: this.host,
            ...(this.key && { headers: { Authorization: `Bearer ${this.key}` } }),
        });
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

    handleError$ = (error: OllamaServiceError) => {
        if (!!error.response && error.response.data?.error) {
            return of({
                name: `${this.errorPrefix} ${error.response.data?.error}`,
                value: error.response.data?.error,
                isError: true,
                disabled: true,
            });
        }
        const simpleMessage = error.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        try {
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

            await this.checkIsAvailableOllama();
            const chatResponse = await this.createChatCompletions(generatedSystemPrompt, `Here is the diff: ${diff}`);
            logging && createLogResponse(`Ollama_${this.model}`, diff, generatedSystemPrompt, chatResponse, requestType);
            if (requestType === 'review') {
                return this.sanitizeResponse(chatResponse);
            }
            return this.parseMessage(chatResponse, type, generate);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private async checkIsAvailableOllama() {
        try {
            const response = await new HttpRequestBuilder({
                method: 'GET',
                baseURL: `${this.host}`,
                timeout: this.params.config.timeout,
            }).execute();

            return response.data;
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED') {
                throw new KnownError(`Error connecting to ${this.host}. Please run Ollama or check host`);
            }
            throw e;
        }
    }

    private async createChatCompletions(systemPrompt: string, userMessage: string) {
        const response = await this.ollama.chat({
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
            stream: false,
            options: {
                temperature: this.params.config.temperature,
                top_p: this.params.config.topP,
                seed: getRandomNumber(10, 1000),
            },
        });
        return response.message.content;
    }
}
