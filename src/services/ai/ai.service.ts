import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { CommitType, ModelConfig, ModelName } from '../../utils/config.js';
import { GitDiff } from '../../utils/git.js';
import { getFirstWordsFrom } from '../../utils/utils.js';

export interface AIResponse {
    title: string;
    value: string;
}

export interface RawCommitMessage {
    subject: string;
    body?: string;
    footer?: string;
}

export interface AIServiceParams {
    config: ModelConfig<ModelName>;
    stagedDiff: GitDiff;
    keyName: ModelName;
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
    abstract generateCodeReview$(): Observable<ReactiveListChoice>;

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

    protected parseMessage(generatedText: string, type: CommitType, maxCount: number): AIResponse[] {
        try {
            let commitMessages: RawCommitMessage[];

            try {
                const parsed = JSON.parse(generatedText);
                if (Array.isArray(parsed)) {
                    commitMessages = parsed;
                } else {
                    commitMessages = [parsed];
                }
            } catch (initialError) {
                const jsonPattern = /(\[[\s\S]*?\])|(\{[\s\S]*?\})/;
                const jsonMatch = generatedText.match(jsonPattern);

                if (!jsonMatch) {
                    return [];
                }

                const jsonStr = jsonMatch[0];
                const parsed = JSON.parse(jsonStr);

                commitMessages = Array.isArray(parsed) ? parsed : [parsed];
            }

            if (!commitMessages.length || !commitMessages.every(msg => typeof msg.subject === 'string')) {
                return [];
            }

            const filteredMessages = commitMessages
                .map(data => this.extractMessageAsType(data, type))
                .map((data: RawCommitMessage) => ({
                    title: `${data.subject}`,
                    value: `${data.subject}${data.body ? `\n\n${data.body}` : ''}${data.footer ? `\n\n${data.footer}` : ''}`,
                }));

            return filteredMessages.slice(0, maxCount);
        } catch (error) {
            return [];
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

    protected sanitizeResponse(generatedText: string | string[]): AIResponse[] {
        if (typeof generatedText === 'string') {
            try {
                const title = `${getFirstWordsFrom(generatedText)}...`;
                const value = generatedText;
                return [{ title, value }];
            } catch (error) {
                return [];
            }
        }

        return generatedText.map(text => {
            try {
                const title = `${getFirstWordsFrom(text)}...`;
                const value = text;
                return { title, value };
            } catch (error) {
                return { title: '', value: '' };
            }
        });
    }
}
