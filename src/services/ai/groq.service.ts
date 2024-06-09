import chalk from 'chalk';
import Groq from 'groq-sdk';
import { GroqError } from 'groq-sdk/error';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceParams } from './ai.service.js';
import { createLogResponse } from '../../utils/log.js';
import { deduplicateMessages } from '../../utils/openai.js';
import { extraPrompt, generateDefaultPrompt } from '../../utils/prompt.js';



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
        this.groq = new Groq({ apiKey: this.params.config.GROQ_KEY });
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

    private async generateMessage(): Promise<string[]> {
        try {
            const diff = this.params.stagedDiff.diff;
            const { locale, generate, type, prompt: userPrompt, logging } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const defaultPrompt = generateDefaultPrompt(locale, maxLength, type, userPrompt);
            const systemPrompt = `${defaultPrompt}\n${extraPrompt(generate)}`;

            const chatCompletion = await this.groq.chat.completions.create(
                {
                    messages: [
                        { role: 'system', content: systemPrompt },
                        {
                            role: 'user',
                            content: `Here are diff: ${diff}`,
                        },
                    ],
                    model: this.params.config.GROQ_MODEL,
                },
                {
                    timeout: this.params.config.timeout,
                }
            );

            const result = chatCompletion.choices[0].message.content || '';
            logging && createLogResponse('Anthropic', diff, systemPrompt, result);
            return deduplicateMessages(this.sanitizeMessage(result, this.params.config.type, generate));
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
