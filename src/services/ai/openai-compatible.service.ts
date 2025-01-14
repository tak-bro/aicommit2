import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType } from '../../utils/log.js';
import { generateCommitMessage } from '../../utils/openai.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { capitalizeFirstLetter, flattenDeep, generateColors } from '../../utils/utils.js';

export class OpenAICompatibleService extends AIService {
    constructor(private readonly params: AIServiceParams) {
        super(params);
        const keyName = this.params.keyName || 'OPENAI_COMPATIBLE';
        this.colors = generateColors(keyName);
        this.serviceName = chalk
            .bgHex(this.colors.primary)
            .hex(this.colors.secondary)
            .bold(`[${capitalizeFirstLetter(keyName)}]`);
        this.errorPrefix = chalk.red.bold(`[${capitalizeFirstLetter(keyName)}]`);
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

    handleError$ = (error: AIServiceError) => {
        let simpleMessage = 'An error occurred';
        if (error.message) {
            simpleMessage = error.message.split('\n')[0];
            if (simpleMessage.includes('NO_URL') || simpleMessage.includes('NO_MODEL')) {
                try {
                    simpleMessage = JSON.parse(error.message).message;
                } catch (e) {
                    simpleMessage += '';
                }
            } else {
                const errorJson = this.extractJSONFromError(error.message);
                simpleMessage += `: ${errorJson.error.message}`;
            }
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

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        const diff = this.params.stagedDiff.diff;
        const {
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            temperature,
            logging,
            locale,
            generate,
            type,
            maxLength,
            proxy,
            maxTokens,
            timeout,
            compatible,
        } = this.params.config;
        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
        };
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        if (compatible) {
            if (!this.params.config.url) {
                const errorObj = {
                    code: 'NO_URL',
                    message: `Invalid url for ${this.params.keyName}. Please set the url via the 'aicommit2 config set ${this.params.keyName}.url='`,
                };
                throw new Error(JSON.stringify(errorObj));
            }

            if (!this.params.config.model) {
                const errorObj = {
                    code: 'NO_MODEL',
                    message: `Invalid model for ${this.params.keyName}. Please set the url via the 'aicommit2 config set ${this.params.keyName}.model='`,
                };
                throw new Error(JSON.stringify(errorObj));
            }
        }

        const results = await generateCommitMessage(
            this.params.keyName,
            this.params.config.url,
            this.params.config.path,
            this.params.config.key,
            this.params.config.model,
            diff,
            timeout,
            maxTokens,
            temperature,
            this.params.config.topP,
            generatedSystemPrompt,
            logging,
            requestType,
            proxy
        );

        if (requestType === 'review') {
            return flattenDeep(results.map(value => this.sanitizeResponse(value)));
        }
        return flattenDeep(results.map(value => this.parseMessage(value, type, generate)));
    }
}
