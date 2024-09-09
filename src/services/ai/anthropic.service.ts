import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';
import { CODE_REVIEW_PROMPT, DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';

export interface AnthropicServiceError extends AIServiceError {
    error?: {
        error?: {
            message?: string;
        };
    };
}

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
        this.anthropic = new Anthropic({ apiKey: this.params.config.key });
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage()).pipe(
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
        return fromPromise(this.generateCodeReview()).pipe(
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

    private async generateCodeReview(): Promise<AIResponse[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { systemPrompt, systemPromptPath, logging, temperature, locale, generate, type, maxLength } = this.params.config;
            const promptOptions: PromptOptions = {
                ...DEFAULT_PROMPT_OPTIONS,
                locale,
                maxLength,
                type,
                generate,
                systemPrompt,
                systemPromptPath,
            };
            const generatedSystemPrompt = CODE_REVIEW_PROMPT;

            const params: Anthropic.MessageCreateParams = {
                max_tokens: this.params.config.maxTokens,
                temperature: temperature,
                system: generatedSystemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Here is the diff: ${diff}`,
                    },
                ],
                top_p: this.params.config.topP,
                model: this.params.config.model,
            };
            const result: Anthropic.Message = await this.anthropic.messages.create(params);
            // @ts-ignore ignore
            const completion = result.content.map(({ text }) => text).join('');
            logging && createLogResponse('Anthropic Review', diff, generatedSystemPrompt, completion);
            return this.sanitizeResponse(completion);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private async generateMessage(): Promise<AIResponse[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { systemPrompt, systemPromptPath, logging, temperature, locale, generate, type, maxLength } = this.params.config;

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

            const params: Anthropic.MessageCreateParams = {
                max_tokens: this.params.config.maxTokens,
                temperature: temperature,
                system: generatedSystemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Here is the diff: ${diff}`,
                    },
                ],
                top_p: this.params.config.topP,
                model: this.params.config.model,
            };
            const result: Anthropic.Message = await this.anthropic.messages.create(params);
            // @ts-ignore ignore
            const completion = result.content.map(({ text }) => text).join('');
            logging && createLogResponse('Anthropic', diff, generatedSystemPrompt, completion);
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
        const simpleMessage = anthropicError.error?.error?.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };
}
