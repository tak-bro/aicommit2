import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceParams } from './ai.service.js';
import { RequestType, createLogResponse } from '../../utils/log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { capitalizeFirstLetter, generateColors } from '../../utils/utils.js';

export class OpenAICompatibleService extends AIService {
    private openAI: OpenAI;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        const keyName = this.params.keyName || 'OPENAI_COMPATIBLE';
        this.colors = generateColors(keyName);
        this.serviceName = chalk
            .bgHex(this.colors.primary)
            .hex(this.colors.secondary)
            .bold(`[${capitalizeFirstLetter(keyName)}]`);
        this.errorPrefix = chalk.red.bold(`[${capitalizeFirstLetter(keyName)}]`);

        this.openAI = new OpenAI({
            apiKey: this.params.config.key,
            baseURL: `${this.params.config.url}${this.params.config.path}`,
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

    handleError$ = (error: Error) => {
        let status = 'N/A';
        let simpleMessage = error.message;
        if (error instanceof OpenAI.APIError) {
            status = `${error.status}`;
            simpleMessage = error.name;
        }
        const message = `${status} ${simpleMessage}`;
        return of({
            name: `${this.errorPrefix} ${message}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, locale, temperature, generate, type, maxLength } =
                this.params.config;
            const maxTokens = this.params.config.maxTokens;
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

            const chatCompletion: OpenAI.Chat.ChatCompletion = await this.openAI.chat.completions.create(
                {
                    messages: [
                        {
                            role: 'system',
                            content: generatedSystemPrompt,
                        },
                        {
                            role: 'user',
                            content: `Here is the diff: ${diff}`,
                        },
                    ],
                    model: this.params.config.model,
                    max_tokens: maxTokens,
                    top_p: this.params.config.topP,
                    temperature,
                },
                {
                    timeout: this.params.config.timeout,
                }
            );

            const result = chatCompletion.choices[0].message.content || '';
            logging && createLogResponse(this.params.keyName, diff, generatedSystemPrompt, result, requestType);
            if (requestType === 'review') {
                return this.sanitizeResponse(result);
            }
            return this.parseMessage(result, type, generate);
        } catch (error) {
            throw error as any;
        }
    }
}
