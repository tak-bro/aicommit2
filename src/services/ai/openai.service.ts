import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIService, AIServiceError, AIServiceParams, CommitMessage } from './ai.service.js';
import { generateCommitMessage } from '../../utils/openai.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';
import { flattenDeep } from '../../utils/utils.js';

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
                short: data.title,
                value: this.params.config.ignoreBody ? data.title : data.value,
                description: this.params.config.ignoreBody ? '' : data.value,
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
        const { systemPrompt, systemPromptPath, temperature, logging, locale, generate, type, maxLength, proxy, maxTokens, timeout } =
            this.params.config;
        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            systemPrompt,
            systemPromptPath,
        };
        const generatedSystemPrompt = generatePrompt(promptOptions);

        const results = await generateCommitMessage(
            this.params.config.url,
            this.params.config.path,
            this.params.config.key,
            this.params.config.model,
            locale,
            diff,
            generate,
            type,
            timeout,
            maxTokens,
            temperature,
            generatedSystemPrompt,
            logging,
            proxy
        );

        return flattenDeep(results.map(value => this.parseMessage(value, type, generate)));
    }
}
