import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { CommitType, ModelConfig, ModelName } from '../../utils/config.js';
import { GitDiff } from '../../utils/git.js';
import { logger } from '../../utils/logger.js';
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
    status?: number;
    code?: string;
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

    handleError$ = (error: AIServiceError) => {
        let message = error.name ?? 'Unknown Error';
        logger.error(`${this.errorPrefix} ${error.toString()}`);
        if (error.status) {
            message = `${error.status} ${message}`;
        } else if (error.code) {
            message = `${error.code} ${message}`;
        }
        return of({
            name: `${this.errorPrefix} ${message}`,
            value: message,
            isError: true,
            disabled: true,
        });
    };

    protected parseMessage(aiGeneratedText: string, type: CommitType, maxCount: number): AIResponse[] {
        const cleanJsonString = (str: string) => {
            // eslint-disable-next-line no-control-regex
            return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
        };

        const jsonContentPattern = /(\[\s*\{[\s\S]*?\}\s*\]|\{[\s\S]*?\})/;
        const matchedJsonContent = aiGeneratedText.match(jsonContentPattern);

        if (!matchedJsonContent) {
            const error = new Error('AI response did not contain a valid JSON object or array.');
            error.name = 'InvalidJsonResponse';
            throw error;
        }

        const sanitizedJsonString = cleanJsonString(matchedJsonContent[0]);
        const parsedContent = JSON.parse(sanitizedJsonString);
        const rawCommitMessages: RawCommitMessage[] = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

        if (!rawCommitMessages.length || !rawCommitMessages.every(msg => typeof msg.subject === 'string')) {
            const error = new Error('AI response contained malformed commit message data.');
            error.name = 'MalformedCommitMessage';
            throw error;
        }

        const formattedCommitMessages = rawCommitMessages
            .map(rawMessageData => this.extractMessageAsType(rawMessageData, type))
            .map((rawMessageData: RawCommitMessage) => ({
                title: `${rawMessageData.subject}`,
                value: `${rawMessageData.subject}${rawMessageData.body ? `\n\n${rawMessageData.body}` : ''}${rawMessageData.footer ? `\n\n${rawMessageData.footer}` : ''}`,
            }));

        return formattedCommitMessages.slice(0, maxCount);
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
