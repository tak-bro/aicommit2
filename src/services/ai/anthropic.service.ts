import Anthropic from '@anthropic-ai/sdk';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';


import { AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { deduplicateMessages } from '../../utils/openai.js';

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
        this.anthropic = new Anthropic({ apiKey: this.params.config.ANTHROPIC_KEY });
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
            const { locale, generate, type } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type);

            const result = await this.anthropic.completions.create({
                model: this.params.config.ANTHROPIC_MODEL,
                max_tokens_to_sample: this.params.config['max-tokens'],
                temperature: this.params.config.temperature,
                prompt: `${Anthropic.HUMAN_PROMPT} ${prompt}${Anthropic.AI_PROMPT}`,
            });
            const completion = result.completion;
            return deduplicateMessages(this.sanitizeMessage(completion));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    private sanitizeMessage(generatedText: string) {
        return generatedText
            .split('\n')
            .map((message: string) => message.trim().replace(/^\d+\.\s/, ''))
            .map((message: string) => message.replace(/`/g, ''))
            .map((message: string) => this.extractCommitMessageFromRawText(this.params.config.type, message))
            .filter((message: string) => !!message);
    }

    handleError$ = (anthropicError: AnthropicServiceError) => {
        const errorAI = chalk.red.bold(`[Anthropic]`);
        const simpleMessage =
            anthropicError.error?.error?.message?.replace(/(\r\n|\n|\r)/gm, '') || 'An error occurred';
        return of({
            name: `${errorAI} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
        });
    };
}
