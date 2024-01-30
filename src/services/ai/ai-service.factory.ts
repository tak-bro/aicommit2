import { ValidConfig } from '../../utils/config.js';
import { StagedDiff } from '../../utils/git.js';
import { Observable, of } from 'rxjs';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

export const AIType = {
    OPEN_AI: 'OPENAI_KEY',
    HUGGING: 'HUGGING_KEY',
} as const;
export type ApiKeyName = (typeof AIType)[keyof typeof AIType];
export const ApiKeyNames: ApiKeyName[] = Object.values(AIType).map(value => value);

export interface AIFactoryParams {
    config: ValidConfig;
    stagedDiff: StagedDiff;
}

export interface AIServiceError extends Error {
    response?: any;
}

export class AIServiceFactory {
    static create<T extends AIService>(className: { new (params: AIFactoryParams): T }, params: AIFactoryParams): T {
        return new className(params);
    }
}

export type Theme = any;

export abstract class AIService {
    protected serviceName: string;
    protected errorPrefix: string;
    protected colors: Theme;

    protected constructor(params: AIFactoryParams) {
        this.serviceName = 'AI';
        this.errorPrefix = 'ERROR';
        this.colors = {
            primary: '',
        };
    }

    abstract generateCommitMessage$(): Observable<ReactiveListChoice>;
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
