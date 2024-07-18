import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { CommitType, ValidConfig } from '../../utils/config.js';
import { StagedDiff } from '../../utils/git.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';

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
    subject: string;
    body?: string;
    footer?: string;
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
        const defaultPrompt = generatePrompt(promptOption);
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
                            title: `${data.subject}`,
                            value: `${data.subject}`,
                        };
                    }
                    return {
                        title: `${data.subject}`,
                        value: `${data.subject}${data.body ? `\n\n${data.body}` : ''}${data.footer ? `\n\n${data.footer}` : ''}`,
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
                                title: `${data.subject}`,
                                value: `${data.subject}`,
                            };
                        }
                        return {
                            title: `${data.subject}`,
                            value: `${data.subject}${data.body ? `\n\n${data.body}` : ''}${data.footer ? `\n\n${data.footer}` : ''}`,
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
                const conventionalMatch = data.subject.match(conventionalPattern);
                const message = conventionalMatch ? conventionalMatch[0] : data.subject;
                return {
                    ...data,
                    subject: this.normalizeCommitMessage(message),
                };
            case 'gitmoji':
                const gitmojiTypePattern = /:\w*:\s*(.*)/;
                const gitmojiMatch = data.subject.match(gitmojiTypePattern);
                return {
                    ...data,
                    subject: gitmojiMatch ? gitmojiMatch[0].toLowerCase() : data.subject,
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
