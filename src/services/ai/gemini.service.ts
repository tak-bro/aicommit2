import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { deduplicateMessages } from '../../utils/openai.js';

export interface GeminiErrorDetail {
    '@type'?: string;
    reason?: string;
    domain?: string;
    metadata?: unknown;
}

export interface GeminiError extends AIServiceError {
    error?: {
        code: number;
        message: string;
        status: string;
        details?: GeminiErrorDetail[];
    };
}

export class GeminiService extends AIService {
    private genAI: GoogleGenerativeAI;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#0077FF',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Gemini]');
        this.errorPrefix = chalk.red.bold(`[Gemini]`);
        this.genAI = new GoogleGenerativeAI(this.params.config.GEMINI_KEY);
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

            const maxTokens = this.params.config['max-tokens'];
            const model = this.genAI.getGenerativeModel({
                model: this.params.config.GEMINI_MODEL,
                generationConfig: {
                    maxOutputTokens: maxTokens,
                    temperature: this.params.config.temperature,
                },
            });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const completion = response.text();
            return deduplicateMessages(this.sanitizeMessage(completion));
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (geminiError: AIServiceError) => {
        const geminiErrorMessage = geminiError.message || geminiError.toString();
        const regex = /(\[.*?\]\s*[^[]*)/g;
        const matches = [...geminiErrorMessage.matchAll(regex)];
        const result: any[] = [];
        matches.forEach(match => result.push(match[1]));
        return of({
            name: `${this.errorPrefix} ${result[1]}`,
            value: result[1],
            isError: true,
        });
    };

    private sanitizeMessage(generatedText: string) {
        return generatedText
            .split('\n')
            .map((message: string) => message.trim().replace(/^\d+\.\s/, ''))
            .map((message: string) => message.replace(/`/g, ''))
            .map((message: string) => this.extractCommitMessageFromRawText(this.params.config.type, message))
            .filter((message: string) => !!message);
    }
}
