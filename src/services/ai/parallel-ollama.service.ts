import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Ollama } from 'ollama';
import { Observable, catchError, concatMap, from, map, of, tap } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceParams } from './ai.service.js';
import { OllamaServiceError } from './ollama.service.js';
import { DEFAULT_OLLMA_HOST } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { extraPrompt, generateDefaultPrompt } from '../../utils/prompt.js';
import { DONE, UNDONE, toObservable } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

import type { ChatResponse } from 'ollama/src/interfaces.js';

export class ParallelOllamaService extends AIService {
    private host = DEFAULT_OLLMA_HOST;
    private model = '';
    private ollama: Ollama;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#FFF',
            secondary: '#000',
        };
        this.model = this.params.keyName;
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[${this.model}]`);
        this.errorPrefix = chalk.red.bold(`[${this.model}]`);
        this.host = this.params.config.OLLAMA_HOST || DEFAULT_OLLMA_HOST;
        this.ollama = new Ollama({ host: this.host });
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

    generateStreamChoice$ = (): Observable<ReactiveListChoice> => {
        const defaultPrompt = generateDefaultPrompt(
            this.params.config.locale,
            this.params.config['max-length'],
            this.params.config.type,
            this.params.config.prompt
        );
        const systemContent = `${defaultPrompt}\n${extraPrompt(this.params.config.generate)}`;

        const promiseAsyncGenerator: Promise<AsyncGenerator<ChatResponse>> = this.ollama.chat({
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: systemContent,
                },
                {
                    role: 'user',
                    content: `${this.params.stagedDiff.diff}`,
                },
            ],
            stream: true,
            options: {
                temperature: this.params.config.temperature,
            },
        });

        let allValue = '';
        return from(toObservable(promiseAsyncGenerator)).pipe(
            tap((part: ChatResponse) => (allValue += part.message.content)),
            map((part: ChatResponse) => {
                return {
                    id: this.params.keyName,
                    name: `${this.serviceName} ${allValue}`,
                    value: `${allValue}`,
                    isError: false,
                    description: part.done ? DONE : UNDONE,
                    disabled: !part.done,
                };
            })
        );
    };

    private async generateMessage(): Promise<string[]> {
        try {
            await this.checkIsAvailableOllama();
            const chatResponse = await this.createChatCompletions();
            const { type, generate, logging } = this.params.config;
            const systemPrompt = this.createSystemPrompt();
            logging && createLogResponse(`Ollama-${this.model}`, this.params.stagedDiff.diff, systemPrompt, chatResponse);
            return deduplicateMessages(this.sanitizeMessage(chatResponse, type, generate));
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

    private async createChatCompletions() {
        const systemPrompt = this.createSystemPrompt();
        const response = await this.ollama.chat({
            model: this.model,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: `${this.params.stagedDiff.diff}`,
                },
            ],
            stream: false,
            options: {
                temperature: this.params.config.temperature,
            },
        });
        return response.message.content;
    }

    private createSystemPrompt() {
        const defaultPrompt = generateDefaultPrompt(
            this.params.config.locale,
            this.params.config['max-length'],
            this.params.config.type,
            this.params.config.prompt
        );
        return `${defaultPrompt}\n${extraPrompt(this.params.config.generate)}`;
    }
}
