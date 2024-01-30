import chalk from 'chalk';
import { catchError, concatMap, from, map, Observable, of } from 'rxjs';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { generateCommitMessage } from '../../utils/openai.js';
import { AIFactoryParams, AIService, AIServiceError } from './ai-service.factory.js';

export class OpenAIService extends AIService {
    constructor(private readonly params: AIFactoryParams) {
        super(params);
        const chatGPTColors = { primary: '#74AA9C' };
        this.serviceName = chalk.bgHex(chatGPTColors.primary).white.bold('[ChatGPT]');
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(
            generateCommitMessage(
                this.params.config.OPENAI_KEY,
                this.params.config.OPENAI_MODEL,
                this.params.config.locale,
                this.params.stagedDiff.diff,
                this.params.config.generate,
                this.params.config['max-length'],
                this.params.config.type,
                this.params.config.timeout,
                this.params.config['max-tokens'],
                this.params.config.proxy
            )
        ).pipe(
            concatMap(messages => from(messages)), // flat messages
            map(message => ({
                name: `${this.serviceName} ${message}`,
                value: message,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    handleError$ = (error: AIServiceError) => {
        const errorAI = chalk.red.bold(`[ChatGPT]`);
        let simpleMessage = 'An error occurred';
        if (error.message) {
            simpleMessage = error.message.split('\n')[0];
            const errorJson = this.extractJSONFromError(error.message);
            simpleMessage += `: ${errorJson.error.message}`;
        }
        return of({
            name: `${errorAI} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
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
}
