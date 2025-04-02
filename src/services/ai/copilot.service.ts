import { AxiosResponse } from 'axios';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { CreateChatCompletionsResponse } from './mistral.service.js';
import { KnownError } from '../../utils/error.js';
import { RequestType, createLogResponse } from '../../utils/log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { HttpRequestBuilder } from '../http/http-request.builder.js';

export interface CopilotServiceError extends AIServiceError {}

export class CopilotService extends AIService {
    private host = 'https://api.githubcopilot.com';
    private apiKey = '';

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#2FBCFB',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[Copilot]`);
        this.errorPrefix = chalk.red.bold(`[Copilot]`);
        this.apiKey = this.params.config.key;
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
            this.checkAvailableModels();
            const chatResponse = await this.createChatCompletions(generatedSystemPrompt, requestType);
            logging && createLogResponse('Codestral', diff, generatedSystemPrompt, chatResponse, requestType);
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

    handleError$ = (error: CopilotServiceError) => {
        const simpleMessage = error.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    private checkAvailableModels() {
        const supportModels = ['GPT-4o', 'Claude Sonnet 3.5', 'Claude Sonnet 3.7', 'o1', 'o3-mini', 'Gemini 2.0 Flash'];

        if (supportModels.includes(this.params.config.model)) {
            return true;
        }
        throw new Error(`Invalid model type of Copilot`);
    }

    async whoami(req: any) {
        const response = await fetch(
            // The GitHub API endpoint for the authenticated user
            'https://api.github.com/user',
            {
                headers: {
                    Authorization: `Bearer ${this.apiKey}`,
                },
            }
        );

        const user = await response.json();
        return user;
    }

    private async createChatCompletions(systemPrompt: string, requestType: RequestType) {
        console.log(this.apiKey);
        console.log(await this.whoami(this.apiKey));
        const requestBuilder = new HttpRequestBuilder({
            method: 'POST',
            baseURL: `${this.host}/chat/completions`,
            timeout: this.params.config.timeout,
        })
            .setHeaders({
                Authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json',
            })
            .setBody({
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: `Here is the diff: ${this.params.stagedDiff.diff}`,
                    },
                ],
                temperature: this.params.config.temperature,
                top_p: this.params.config.topP,
                max_tokens: this.params.config.maxTokens,
                stream: false,
            });

        if (requestType === 'commit') {
            requestBuilder.addBody({
                response_format: {
                    type: 'json_object',
                },
            });
        }

        const response: AxiosResponse<CreateChatCompletionsResponse> = await requestBuilder.execute().catch(error => {
            console.log(error);
            throw new Error(`Error on createChatCompletions: ${error}`);
        });
        const result: CreateChatCompletionsResponse = response.data;
        const hasNoChoices = !result.choices || result.choices.length === 0;
        if (hasNoChoices || !result.choices[0].message?.content) {
            throw new Error(`No Content on response. Please open a Bug report`);
        }
        return result.choices[0].message.content;
    }
}
