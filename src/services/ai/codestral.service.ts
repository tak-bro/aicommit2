import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams, CommitMessage } from './ai.service.js';
import { CreateChatCompletionsResponse } from './mistral.service.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { getRandomNumber } from '../../utils/utils.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';
export interface CodestralServiceError extends AIServiceError {}

export class CodestralService extends AIService {
    private host = 'https://codestral.mistral.ai';
    private apiKey = '';
    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#e28c58',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[Codestral]`);
        this.errorPrefix = chalk.red.bold(`[Codestral]`);
        this.apiKey = this.params.config.CODESTRAL_KEY;
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
    private async generateMessage(): Promise<CommitMessage[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { locale, generate, type, promptPath, logging } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type, promptPath);
            this.checkAvailableModels();
            const chatResponse = await this.createChatCompletions(prompt);
            logging && createLogResponse('Codestral', diff, prompt, chatResponse);
            return this.sanitizeMessage(chatResponse, this.params.config.type, generate, this.params.config.ignoreBody);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }
    handleError$ = (error: CodestralServiceError) => {
        const simpleMessage = error.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };
    private checkAvailableModels() {
        const supportModels = ['codestral-latest', 'codestral-2405'];

        if (supportModels.includes(this.params.config.CODESTRAL_MODEL)) {
            return true;
        }
        throw new Error(`Invalid model type of Codestral AI`);
    }
    private async createChatCompletions(prompt: string) {
        const response: AxiosResponse<CreateChatCompletionsResponse> = await new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/v1/chat/completions`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                Authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
            })
            .setBody({
                model: this.params.config.CODESTRAL_MODEL,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: this.params.config.temperature,
                top_p: 1,
                max_tokens: this.params.config['max-tokens'],
                stream: false,
                safe_prompt: false,
                random_seed: getRandomNumber(10, 1000),
            })
            .execute();
        const result: CreateChatCompletionsResponse = response.data;
        const hasNoChoices = !result.choices || result.choices.length === 0;
        if (hasNoChoices || !result.choices[0].message?.content) {
            throw new Error(`No Content on response. Please open a Bug report`);
        }
        return result.choices[0].message.content;
    }
}
