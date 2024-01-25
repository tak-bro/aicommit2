import { ValidConfig } from '../../utils/config.js';
import { StagedDiff } from '../../utils/git.js';
import { Observable } from 'rxjs';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

export const AIType = {
    OPEN_AI: 'OPENAI_KEY',
    GOOGLE: 'GOOGLE_KEY',
} as const;
export type ApiKeyName = (typeof AIType)[keyof typeof AIType];

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

export abstract class AIService {
    protected serviceName: string;

    protected constructor(params: AIFactoryParams) {
        this.serviceName = 'AI';
    }

    abstract generateCommitMessage$(): Observable<ReactiveListChoice>;
    abstract handleError$(error: AIServiceError): Observable<ReactiveListChoice>;
}
