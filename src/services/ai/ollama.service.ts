import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Ollama } from 'ollama';
import { Observable, catchError, concatMap, from, map, of, scan, tap } from 'rxjs';

import { AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { generatePrompt } from '../../utils/prompt.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

import type { ChatResponse } from 'ollama/src/interfaces.js';

export async function* toObservable<T>(promiseAsyncGenerator: Promise<AsyncGenerator<T>>): AsyncGenerator<T> {
    const asyncGenerator = await promiseAsyncGenerator;
    for await (const value of asyncGenerator) {
        yield value;
    }
}

export interface OllamaServiceError extends AIServiceError {}

export class OllamaService extends AIService {
    private host = `http://localhost:11434`;
    private model = '';
    private ollama: Ollama;

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
        this.ollama = new Ollama({ host: this.host });
        this.name = 'ollama';
    }

    generateStreamMessage$ = () => {
        const defaultPrompt = generatePrompt(
            this.params.config.locale,
            this.params.config['max-length'],
            this.params.config.type,
            this.params.config.prompt
        );
        const systemContent = `${defaultPrompt}\nPlease just generate ${this.params.config.generate} commit messages in numbered list format without explanation.`;

        const promiseAsyncGenerator: Promise<AsyncGenerator<ChatResponse>> = this.ollama.chat({
            model: this.params.config.OLLAMA_MODEL,
            messages: [
                {
                    role: 'system',
                    content: systemContent,
                },
                {
                    role: 'user',
                    content: this.params.stagedDiff.diff,
                },
            ],
            stream: true,
        });

        let fullText = '';
        return from(toObservable(promiseAsyncGenerator)).pipe(
            tap((part: ChatResponse) => (fullText += part.message.content)),
            map((part: ChatResponse) => {
                return {
                    id: this.name,
                    name: `${this.serviceName} ${fullText}`,
                    value: `${fullText}`,
                    isError: false,
                    description: part.done ? `done` : `undone`,
                    disabled: !part.done,
                };
            })
        );
    };

    generateCommitMessage$(): Observable<any> {
        return this.generateStreamMessage$().pipe(
            scan((acc: any, data: any) => {
                const isDone = data.description === `done`;
                if (isDone) {
                    const messages = deduplicateMessages(
                        this.sanitizeMessage(data.value, this.params.config.type, this.params.config.generate)
                    );
                    return messages.map((message, index) => {
                        return {
                            id: `${this.name}_message${index}`,
                            name: `${this.serviceName} ${message}`,
                            value: `${message}`,
                            isError: false,
                            description: `done`,
                            disabled: false,
                        };
                    });
                }
                // if has data
                const originData = acc.find((origin: ReactiveListChoice) => origin.id === data.id);
                if (originData) {
                    return [...acc.map((origin: ReactiveListChoice) => (data.id === origin.id ? data : origin))];
                }
                // init
                return [{ ...data }] as any;
            }, []),
            concatMap(messages => messages), // flat messages
            catchError(this.handleError$)
        );

        // return fromPromise(this.generateMessage()).pipe(
        //     concatMap(messages => from(messages)),
        //     map(message => ({
        //         id: this.name,
        //         name: `${this.serviceName} ${message}`,
        //         value: message,
        //         isError: false,
        //     })),
        //     catchError(this.handleError$)
        // );
    }

    private async generateMessage(): Promise<string[]> {
        try {
            await this.checkIsAvailableOllama();
            const chatResponse = await this.createChatCompletions();
            return deduplicateMessages(
                this.sanitizeMessage(chatResponse, this.params.config.type, this.params.config.generate)
            );
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

    private async createChatCompletions() {
        const defaultPrompt = generatePrompt(
            this.params.config.locale,
            this.params.config['max-length'],
            this.params.config.type,
            this.params.config.prompt
        );
        const systemContent = `${defaultPrompt}\nPlease remember that just generate ${this.params.config.generate} commit messages in numbered list format without explanation.`;
        const response = await this.ollama.chat({
            model: this.params.config.OLLAMA_MODEL,
            messages: [
                {
                    role: 'system',
                    content: systemContent,
                },
                {
                    role: 'user',
                    content: this.params.stagedDiff.diff,
                },
            ],
            stream: false,
        });
        return response.message.content;
    }
}
