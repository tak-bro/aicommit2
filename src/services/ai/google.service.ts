import chalk from 'chalk';
import { catchError, concatMap, from, map, Observable, of } from 'rxjs';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';
import { CommitType } from '../../utils/config.js';
import { DiscussServiceClient } from '@google-ai/generativelanguage';
import { GoogleAuth } from 'google-auth-library';
import { generatePrompt } from '../../utils/prompt.js';
import { KnownError } from '../../utils/error.js';
import { AIFactoryParams, AIService, AIServiceError } from './ai-service.factory.js';

export class GoogleService extends AIService {
    constructor(private readonly params: AIFactoryParams) {
        super(params);
        const googleColors = {
            red: '#DB4437',
            yellow: '#F4B400',
            blue: '#4285F4',
            green: '#0F9D58',
        };
        this.serviceName = chalk.bgHex(googleColors.blue).white.bold('[Bard AI]');
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(
            this.generateMessage(
                this.params.config.OPENAI_KEY,
                this.params.config.locale,
                this.params.stagedDiff.diff,
                this.params.config.generate,
                this.params.config['max-length'],
                this.params.config.type,
                this.params.config.timeout,
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
        const errorAI = chalk.red.bold(`[Bard AI]`);
        let simpleMessage = 'An error occurred';
        if (error.response && error.response.data && error.response.data.error) {
            simpleMessage = error.response.data.error.split('\n')[0];
        } else if (error.message) {
            simpleMessage = error.message.split('\n')[0];
        }
        return of({
            name: `${errorAI} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
        });
    };

    private async generateMessage(
        key: string,
        locale: string,
        diff: string,
        completions: number,
        maxLength: number,
        type: CommitType,
        timeout: number,
        proxy?: string
    ) {
        try {
            const discussServiceClient = new DiscussServiceClient({ authClient: new GoogleAuth().fromAPIKey(key) });
            const result = await discussServiceClient.generateMessage(
                {
                    model: 'models/chat-bison-001',
                    prompt: {
                        context: '',
                        messages: [{ content: generatePrompt(locale, maxLength, type) + `\nHere is diff: ${diff}` }],
                    },
                    candidateCount: 1,
                    temperature: 0.7,
                    top_p: 1,
                    top_k: 40,
                    context: '',
                    examples: [],
                    format: 'json',
                } as any,
                {
                    timeout,
                    maxResults: completions,
                }
            );
            return ['chore: temp message'];
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }
}
