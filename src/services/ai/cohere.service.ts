import chalk from 'chalk';
import { CohereClient, CohereError, CohereTimeoutError } from 'cohere-ai';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceParams, CommitMessage } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { createLogResponse } from '../../utils/log.js';

export class CohereService extends AIService {
    private cohere: CohereClient;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#D18EE2',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Cohere]');
        this.errorPrefix = chalk.red.bold(`[Cohere]`);
        this.cohere = new CohereClient({
            token: this.params.config.COHERE_KEY,
        });
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

            const prediction = await this.cohere.generate({
                prompt,
                maxTokens,
                temperature: this.params.config.temperature,
                model: this.params.config.COHERE_MODEL,
            });

            const result = prediction.generations.map(data => data.text).join('');
            logging && createLogResponse('Cohere', diff, prompt, result);
            return this.sanitizeMessage(result, this.params.config.type, generate, this.params.config.ignoreBody);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny instanceof CohereTimeoutError) {
                throw new KnownError(`Request timed out error!`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (error: CohereError) => {
        const regex = /"message":\s*"([^"]*)"/;
        const match = error.message.match(regex);
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        let simpleMessage = error?.body?.message;
        if (match && match[1]) {
            simpleMessage = match[1];
        }
        const message = `${error.statusCode} ${simpleMessage}`;
        return of({
            name: `${this.errorPrefix} ${message}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };
}
