import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, createLogResponse } from '../../utils/ai-log.js';
import { KnownError } from '../../utils/error.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

export interface AnthropicServiceError extends AIServiceError {
    error?: {
        error?: {
            message?: string;
        };
    };
}

const DEFAULT_TIMEOUT = 10 * 60 * 1000; // 10 minutes in milliseconds

export class AnthropicService extends AIService {
    private anthropic: Anthropic;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#AE5630',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Anthropic]');
        this.errorPrefix = chalk.red.bold(`[Anthropic]`);
        this.anthropic = new Anthropic({
            apiKey: this.params.config.key,
            ...(this.params.config.timeout > DEFAULT_TIMEOUT && { timeout: this.params.config.timeout }),
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

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const {
                systemPrompt,
                systemPromptPath,
                codeReviewPromptPath,
                logging,
                temperature,
                locale,
                generate,
                type,
                maxLength,
                maxTokens,
                topP,
                model,
            } = this.params.config;

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

            const params: Anthropic.MessageCreateParams = {
                max_tokens: maxTokens,
                temperature: temperature,
                system: generatedSystemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Here is the diff: ${diff}`,
                    },
                ],
                top_p: topP,
                model: model,
            };
            const result: Anthropic.Message = await this.anthropic.messages.create(params);
            // @ts-ignore ignore
            const completion = result.content.map(({ text }) => text).join('');

            logging && createLogResponse('Anthropic', diff, generatedSystemPrompt, completion, requestType);
            if (requestType === 'review') {
                return this.sanitizeResponse(completion);
            }
            return this.parseMessage(completion, type, generate);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (anthropicError: AnthropicServiceError) => {
        const simpleMessage = anthropicError.error?.error?.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An unknown error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };
}
