import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { CommitType, ValidConfig } from '../../utils/config.js';
import { StagedDiff } from '../../utils/git.js';
import { generatePrompt } from '../../utils/prompt.js';

export const AIType = {
    OPEN_AI: 'OPENAI_KEY',
    HUGGING: 'HUGGING_COOKIE',
    CLOVA_X: 'CLOVAX_COOKIE',
} as const;
export type ApiKeyName = (typeof AIType)[keyof typeof AIType];
export const ApiKeyNames: ApiKeyName[] = Object.values(AIType).map(value => value);

export interface AIServiceParams {
    config: ValidConfig;
    stagedDiff: StagedDiff;
}

export interface AIServiceError extends Error {
    response?: any;
}

export interface Theme {
    primary: string;
    [key: string]: string;
}

export abstract class AIService {
    protected serviceName: string;
    protected errorPrefix: string;
    protected colors: Theme;

    protected constructor(params: AIServiceParams) {
        this.serviceName = 'AI';
        this.errorPrefix = 'ERROR';
        this.colors = {
            primary: '',
        };
    }

    abstract generateCommitMessage$(): Observable<ReactiveListChoice>;

    protected buildPrompt(locale: string, diff: string, completions: number, maxLength: number, type: CommitType) {
        const defaultPrompt = generatePrompt(locale, maxLength, type);
        return `${defaultPrompt}\nPlease just generate ${completions} messages in numbered list format. Here are git diff: \n${diff}`;
    }

    protected handleError$ = (error: AIServiceError): Observable<ReactiveListChoice> => {
        let simpleMessage = 'An error occurred';
        if (error.message) {
            simpleMessage = error.message;
        }
        return of({
            name: `${this.errorPrefix} ${simpleMessage}`,
            value: simpleMessage,
            isError: true,
        });
    };
}
