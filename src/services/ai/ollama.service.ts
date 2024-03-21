import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface OllamaServiceError extends AIServiceError {}

export interface OllamaChatCompletionsResponse {
    model: string;
    response: string;
    done: boolean;
    context?: any;
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;
}

export class OllamaService extends AIService {
    private host = `http://localhost:11434`;
    private model = '';

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#FFF',
            secondary: '#000',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Ollama]');
        this.errorPrefix = chalk.red.bold(`[Ollama]`);
        this.model = this.params.config.OLLAMA_MODEL;
        this.host = this.params.config.OLLAMA_HOST || 'http://localhost:11434';
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage()).pipe(
            concatMap(messages => from(messages)),
            map(message => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(): Promise<string[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { locale, generate, type, prompt: userPrompt } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type, userPrompt);
            await this.checkIsAvailableOllama();
            const chatResponse = await this.createChatCompletions(prompt);
            return deduplicateMessages(this.sanitizeMessage(chatResponse));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (error: OllamaServiceError) => {
        if (error.response.data?.error) {
            return of({
                name: `${this.errorPrefix} ${error.response.data?.error}`,
                value: error.response.data?.error,
                isError: true,
            });
        }
        const simpleMessage = error.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
        });
    };

    private async checkIsAvailableOllama() {
        try {
            const response = await new HttpRequestBuilder({
                method: 'GET',
                baseURL: `${this.host}`,
                timeout: this.params.config.OLLAMA_TIMEOUT,
            }).execute();

            return response.data;
        } catch (e: any) {
            if (e.code === 'ECONNREFUSED') {
                throw new KnownError(`Error connecting to ${this.host}. Please run Ollama or check host`);
            }
            throw e;
        }
    }

    private async createChatCompletions(prompt: string) {
        const response: AxiosResponse<OllamaChatCompletionsResponse> = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/api/generate`,
            timeout: this.params.config.OLLAMA_TIMEOUT,
        })
            .setBody({
                model: this.params.config.OLLAMA_MODEL,
                prompt,
                stream: false,
                options: {
                    temperature: this.params.config.temperature,
                    top_p: 1,
                },
            })
            .execute();
        return response.data.response;
    }

    private sanitizeMessage(generatedText: string) {
        return generatedText
            .split('\n')
            .map((message: string) => message.trim().replace(/^\d+\.\s/, ''))
            .map((message: string) => message.replace(/`/g, ''))
            .map((message: string) => this.extractCommitMessageFromRawText(this.params.config.type, message))
            .filter((message: string) => !!message);
    }
}
