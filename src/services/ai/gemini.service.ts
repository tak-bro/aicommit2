import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams, CommitMessage } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';

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
            const { locale, generate, type, prompt: userPrompt, logging } = this.params.config;
            const maxLength = this.params.config['max-length'];
            const prompt = this.buildPrompt(locale, diff, generate, maxLength, type, userPrompt);

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

            logging && createLogResponse('Gemini', diff, prompt, completion);
            return this.sanitizeMessage(completion, this.params.config.type, generate);
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
        const result: string[] = [];
        matches.forEach(match => result.push(match[1]));

        const message = result[1] || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${message}`,
            value: message,
            isError: true,
            disabled: true,
        });
    };
}
