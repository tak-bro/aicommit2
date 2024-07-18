import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { CommitType, ValidConfig } from '../../utils/config.js';
import { StagedDiff } from '../../utils/git.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generateDefaultPrompt } from '../../utils/prompt.js';

// NOTE: get AI Type from key names
export const AIType = {
    OPEN_AI: 'OPENAI_KEY',
    GEMINI: 'GEMINI_KEY',
    ANTHROPIC: 'ANTHROPIC_KEY',
    HUGGINGFACE: 'HUGGINGFACE_COOKIE',
    MISTRAL: 'MISTRAL_KEY',
    CODESTRAL: 'CODESTRAL_KEY',
    OLLAMA: 'OLLAMA_MODEL',
    COHERE: 'COHERE_KEY',
    GROQ: 'GROQ_KEY',
} as const;
export type ApiKeyName = (typeof AIType)[keyof typeof AIType];
export const ApiKeyNames: ApiKeyName[] = Object.values(AIType).map(value => value);

export interface CommitMessage {
    title: string;
    value: string;
}

export interface RawCommitMessage {
    message: string;
    body: string;
}

export interface AIServiceParams {
    config: ValidConfig;
    stagedDiff: StagedDiff;
    keyName: ApiKeyName;
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

    protected buildPrompt(locale: string, diff: string, generate: number, maxLength: number, type: CommitType, promptPath: string) {
        const promptOption: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            promptPath,
        };
        const defaultPrompt = generateDefaultPrompt(promptOption);
        return `${defaultPrompt}}\nHere are diff: \n${diff}`;
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
            disabled: true,
        });
    };

    protected sanitizeMessage(generatedText: string, type: CommitType, maxCount: number, ignoreBody: boolean): CommitMessage[] {
        try {
            const commitMessages: RawCommitMessage[] = JSON.parse(generatedText);
            const filtedMessages = commitMessages
                .map(data => this.extractMessageAsType(data, type))
                .map((data: RawCommitMessage) => {
                    if (ignoreBody) {
                        return {
                            title: `${data.message}`,
                            value: `${data.message}`,
                        };
                    }
                    return {
                        title: `${data.message}`,
                        value: data.body ? `${data.message}\n\n${data.body}` : `${data.message}`,
                    };
                });

            if (filtedMessages.length > maxCount) {
                return filtedMessages.slice(0, maxCount);
            }
            return filtedMessages;
        } catch (error) {
            const jsonPattern = /\[[\s\S]*?\]/;
            try {
                const jsonMatch = generatedText.match(jsonPattern);
                if (!jsonMatch) {
                    // No valid JSON array found in the response
                    return [];
                }
                const jsonStr = jsonMatch[0];
                const commitMessages: RawCommitMessage[] = JSON.parse(jsonStr);
                const filtedMessages = commitMessages
                    .map(data => this.extractMessageAsType(data, type))
                    .map((data: RawCommitMessage) => {
                        if (ignoreBody) {
                            return {
                                title: `${data.message}`,
                                value: `${data.message}`,
                            };
                        }
                        return {
                            title: `${data.message}`,
                            value: data.body ? `${data.message}\n\n${data.body}` : `${data.message}`,
                        };
                    });

                if (filtedMessages.length > maxCount) {
                    return filtedMessages.slice(0, maxCount);
                }
                return filtedMessages;
            } catch (e) {
                // Error parsing JSON
                return [];
            }
        }
    }

    private extractMessageAsType(data: RawCommitMessage, type: CommitType): RawCommitMessage {
        switch (type) {
            case 'conventional':
                const conventionalPattern = /(\w+)(?:\(.*?\))?:\s*(.*)/;
                const conventionalMatch = data.message.match(conventionalPattern);
                const message = conventionalMatch ? conventionalMatch[0] : data.message;
                return {
                    ...data,
                    message: this.normalizeCommitMessage(message),
                };
            case 'gitmoji':
                const gitmojiTypePattern = /:\w*:\s*(.*)/;
                const gitmojiMatch = data.message.match(gitmojiTypePattern);
                return {
                    ...data,
                    message: gitmojiMatch ? gitmojiMatch[0].toLowerCase() : data.message,
                };
            default:
                return data;
        }
    }

    private normalizeCommitMessage(message: string): string {
        const messagePattern = /^(\w+)(\(.*?\))?:\s(.*)$/;
        const match = message.match(messagePattern);

        if (match) {
            const [, type, scope, description] = match;
            const normalizedType = type.toLowerCase();
            const normalizedDescription = description.charAt(0).toLowerCase() + description.slice(1);
            message = `${normalizedType}${scope || ''}: ${normalizedDescription}`;
        }

        return message;
    }
}
