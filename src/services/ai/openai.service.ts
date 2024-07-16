import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams, CommitMessage } from './ai.service.js';
import { generateCommitMessage } from '../../utils/openai.js';

export class OpenAIService extends AIService {
    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#74AA9C',
            secondary: '#FFF',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[ChatGPT]`);
        this.errorPrefix = chalk.red.bold(`[ChatGPT]`);
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

    handleError$ = (error: AIServiceError) => {
        let simpleMessage = 'An error occurred';
        if (error.message) {
            simpleMessage = error.message.split('\n')[0];
            const errorJson = this.extractJSONFromError(error.message);
            simpleMessage += `: ${errorJson.error.message}`;
        }
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
            disabled: true,
        });
    };

    private extractJSONFromError(error: string) {
        const regex = /[{[]{1}([,:{}[\]0-9.\-+Eaeflnr-u \n\r\t]|".*?")+[}\]]{1}/gis;
        const matches = error.match(regex);
        if (matches) {
            return Object.assign({}, ...matches.map((m: any) => JSON.parse(m)));
        }
        return {
            error: {
                message: 'Unknown error',
            },
        };
    }

    private async generateMessage(): Promise<CommitMessage[]> {
        const diff = this.params.stagedDiff.diff;
        const { locale, generate, type } = this.params.config;
        const maxLength = this.params.config['max-length'];

        const fullText = await generateCommitMessage(
            this.params.config.OPENAI_URL,
            this.params.config.OPENAI_PATH,
            this.params.config.OPENAI_KEY,
            this.params.config.OPENAI_MODEL,
            locale,
            diff,
            generate,
            maxLength,
            type,
            this.params.config.timeout,
            this.params.config['max-tokens'],
            this.params.config.temperature,
            this.params.config.prompt,
            this.params.config.logging,
            this.params.config.proxy
        );

        return this.sanitizeMessage(fullText, this.params.config.type, generate, this.params.config.ignoreBody);
    }
}
