import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Ollama } from 'ollama';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams, CommitMessage } from './ai.service.js';
import { DEFAULT_OLLMA_HOST } from '../../utils/config.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';
import { capitalizeFirstLetter } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface OllamaServiceError extends AIServiceError {}

export class OllamaService extends AIService {
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
        this.serviceName = chalk
            .bgHex(this.colors.primary)
            .hex(this.colors.secondary)
            .bold(`[${capitalizeFirstLetter(this.model)}]`);
        this.errorPrefix = chalk.red.bold(`[${capitalizeFirstLetter(this.model)}]`);
        this.host = this.params.config.OLLAMA_HOST || DEFAULT_OLLMA_HOST;
        this.ollama = new Ollama({ host: this.host });
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage()).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
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

    private async generateMessage(): Promise<CommitMessage[]> {
        try {
            await this.checkIsAvailableOllama();
            const chatResponse = await this.createChatCompletions();
            const { type, generate, logging } = this.params.config;
            const systemPrompt = this.createSystemPrompt();
            logging && createLogResponse(`Ollama_${this.model}`, this.params.stagedDiff.diff, systemPrompt, chatResponse);
            return this.sanitizeMessage(chatResponse, type, generate, this.params.config.ignoreBody);
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
                    content: `Here are diff: ${this.params.stagedDiff.diff}`,
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
        const promptOption: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale: this.params.config.locale,
            maxLength: this.params.config['max-length'],
            type: this.params.config.type,
            generate: this.params.config.generate,
            promptPath: this.params.config.promptPath,
        };
        const defaultPrompt = generatePrompt(promptOption);
        return `${defaultPrompt}`;
    }
}
