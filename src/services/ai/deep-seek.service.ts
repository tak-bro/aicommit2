import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams, CommitMessage } from './ai.service.js';
import { CreateChatCompletionsResponse } from './mistral.service.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface DeepSeekServiceError extends AIServiceError {}
export interface DeepSeekChatCompletionResponse {
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
export class DeepSeekService extends AIService {
    private host = 'https://api.deepseek.com';
    private apiKey = '';

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#53a3f9',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[DeepSeek]`);
        this.errorPrefix = chalk.red.bold(`[DeepSeek]`);
        this.apiKey = this.params.config.key;
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage()).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: this.params.config.ignoreBody ? data.title : data.value,
                description: this.params.config.ignoreBody ? '' : data.value,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }
    private async generateMessage(): Promise<CommitMessage[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { systemPrompt, systemPromptPath, logging, locale, generate, type, maxLength } = this.params.config;
            const promptOptions: PromptOptions = {
                ...DEFAULT_PROMPT_OPTIONS,
                locale,
                maxLength,
                type,
                generate,
                systemPrompt,
                systemPromptPath,
            };
            const generatedSystemPrompt = generatePrompt(promptOptions);
            this.checkAvailableModels();
            const chatResponse = await this.createChatCompletions(generatedSystemPrompt);
            logging && createLogResponse('DeepSeek', diff, generatedSystemPrompt, chatResponse);
            return this.parseMessage(chatResponse, type, generate);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (error: DeepSeekServiceError) => {
        const simpleMessage = error.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    private checkAvailableModels() {
        const supportModels = [`deepseek-coder`, `deepseek-chat`];
        if (supportModels.includes(this.params.config.model)) {
            return true;
        }
        throw new Error(`Invalid model type of DeepSeek`);
    }

    private async createChatCompletions(systemPrompt: string) {
        const response: AxiosResponse<CreateChatCompletionsResponse> = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/chat/completions`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                Authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
            })
            .setBody({
                model: this.params.config.model,
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
                response_format: {
                    type: 'json_object',
                },
                temperature: this.params.config.temperature,
                top_p: this.params.config.topP,
                max_tokens: this.params.config.maxTokens,
                stream: false,
            })
            .execute();
        const result: DeepSeekChatCompletionResponse = response.data;
        const hasNoChoices = !result.choices || result.choices.length === 0;
        if (hasNoChoices || !result.choices[0].message?.content) {
            throw new Error(`No Content on response. Please open a Bug report`);
        }
        return result.choices[0].message.content;
    }
}
