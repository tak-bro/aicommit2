import chalk from 'chalk';
import Groq from 'groq-sdk';
import { GroqError } from 'groq-sdk/error';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceParams } from './ai.service.js';
import { RequestType, createLogResponse } from '../../utils/log.js';
import { sanitizeMessage } from '../../utils/openai.js';
import { CODE_REVIEW_PROMPT, DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';
import { flattenDeep } from '../../utils/utils.js';

export class GroqService extends AIService {
    private groq: Groq;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#f55036',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Groq]');
        this.errorPrefix = chalk.red.bold(`[Groq]`);
        this.groq = new Groq({ apiKey: this.params.config.key });
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
            const { systemPrompt, systemPromptPath, logging, locale, temperature, generate, type, maxLength } = this.params.config;
            const maxTokens = this.params.config.maxTokens;
            const promptOptions: PromptOptions = {
                ...DEFAULT_PROMPT_OPTIONS,
                locale,
                maxLength,
                type,
                generate,
                systemPrompt,
                systemPromptPath,
            };
            const generatedSystemPrompt = requestType === 'review' ? CODE_REVIEW_PROMPT : generatePrompt(promptOptions);

            const chatCompletion = await this.groq.chat.completions.create(
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

            const fullText = chatCompletion.choices
                .filter(choice => choice.message?.content)
                .map(choice => sanitizeMessage(choice.message!.content as string))
                .join();
            logging && createLogResponse('Groq', diff, generatedSystemPrompt, fullText, requestType);

            const results = chatCompletion.choices
                .filter(choice => choice.message?.content)
                .map(choice => sanitizeMessage(choice.message!.content as string));

            if (requestType === 'review') {
                return flattenDeep(results.map(value => this.sanitizeResponse(value)));
            }
            return flattenDeep(results.map(value => this.parseMessage(value, type, generate)));
        } catch (error) {
            throw error as any;
        }
    }

    handleError$ = (error: GroqError) => {
        let simpleMessage = 'An error occurred';
        const regex = /"message":\s*"([^"]*)"/;
        const match = error.message.match(regex);
        if (match && match[1]) {
            simpleMessage = match[1];
        }
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        const message = `${error['status']} ${simpleMessage}`;
        return of({
            name: `${this.errorPrefix} ${message}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };
}
