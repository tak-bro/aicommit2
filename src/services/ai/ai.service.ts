import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { CommitType, ValidConfig } from '../../utils/config.js';
import { StagedDiff } from '../../utils/git.js';
import { extraPrompt, generateDefaultPrompt, isValidConventionalMessage, isValidGitmojiMessage } from '../../utils/prompt.js';

// NOTE: get AI Type from key names
export const AIType = {
    OPEN_AI: 'OPENAI_KEY',
    GEMINI: 'GEMINI_KEY',
    ANTHROPIC: 'ANTHROPIC_KEY',
    HUGGING: 'HUGGING_COOKIE',
    CLOVA_X: 'CLOVAX_COOKIE',
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

export interface ParsedMessage {
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

    protected buildPrompt(locale: string, diff: string, completions: number, maxLength: number, type: CommitType, prompt: string) {
        const defaultPrompt = generateDefaultPrompt(locale, maxLength, type, prompt);
        return `${defaultPrompt}\n${extraPrompt(completions)}\nHere are diff: \n${diff}`;
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

    protected sanitizeMessage(generatedText: string, type: CommitType, maxCount: number) {
        const jsonPattern = /\[[\s\S]*?\]/;

        try {
            const jsonMatch = generatedText.match(jsonPattern);
            if (!jsonMatch) {
                // No valid JSON array found in the response
                return [];
            }
            const jsonStr = jsonMatch[0];
            const commitMessages: ParsedMessage[] = JSON.parse(jsonStr);
            const filtedMessages = commitMessages
                .filter(data => {
                    switch (type) {
                        case 'conventional':
                            return isValidConventionalMessage(data.message);
                        case 'gitmoji':
                            return isValidGitmojiMessage(data.message);
                        default:
                            return true;
                    }
                })
                .map((data: ParsedMessage) => {
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
