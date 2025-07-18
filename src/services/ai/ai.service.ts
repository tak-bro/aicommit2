import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { addLogEntry } from '../../utils/ai-log.js';
import { CommitType, ModelConfig, ModelName } from '../../utils/config.js';
import { GitDiff } from '../../utils/git.js';
import { logger } from '../../utils/logger.js';
import { getFirstWordsFrom, safeJsonParse } from '../../utils/utils.js';

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
    logSessionId?: string;
}

export interface AIServiceError extends Error {
    status?: number;
    code?: string;
    content?: any;
    originalError?: any;
}

export interface Theme {
    primary: string;
    [key: string]: string;
}

export abstract class AIService {
    protected serviceName: string;
    protected errorPrefix: string;
    protected colors: Theme;
    protected params: AIServiceParams;
    protected logSessionId?: string;

    protected constructor(params: AIServiceParams) {
        this.serviceName = 'AI';
        this.errorPrefix = 'ERROR';
        this.colors = {
            primary: '',
        };
        this.params = params;
        this.logSessionId = params.logSessionId;
    }

    abstract generateCommitMessage$(): Observable<ReactiveListChoice>;
    abstract generateCodeReview$(): Observable<ReactiveListChoice>;

    protected getDetailedErrorMessage(error: AIServiceError): string {
        // Common error patterns that apply to most AI services
        const errorMsg = error.message || '';

        // API key related errors
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your API key configuration';
        }

        // Rate limiting errors
        if (
            errorMsg.includes('rate_limit') ||
            errorMsg.includes('Rate limit') ||
            errorMsg.includes('429') ||
            errorMsg.includes('Too Many Requests')
        ) {
            return 'Rate limit exceeded. Wait a moment and try again, or upgrade your plan';
        }

        // Model related errors
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the model name is correct';
        }

        // Timeout errors
        if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
            return 'Request timed out. Try again or increase the timeout setting';
        }

        // Network errors
        if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('ECONNREFUSED')) {
            return 'Network error. Check your internet connection and try again';
        }

        // Quota/usage errors
        if (errorMsg.includes('quota') || errorMsg.includes('usage') || errorMsg.includes('QUOTA_EXCEEDED')) {
            return 'API quota exceeded. Check your usage limits';
        }

        // HTTP status code specific errors
        if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
            return 'Authentication failed. Your API key may be invalid or expired';
        }

        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this model';
        }

        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your model configuration';
        }

        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Server error. Try again later';
        }

        // Service overload
        if (
            errorMsg.includes('overloaded') ||
            errorMsg.includes('capacity') ||
            errorMsg.includes('SERVICE_UNAVAILABLE') ||
            errorMsg.includes('unavailable')
        ) {
            return 'Service is temporarily unavailable. Try again in a few minutes';
        }

        // Allow services to override with their own logic
        return this.getServiceSpecificErrorMessage(error) || errorMsg || 'Unknown error occurred';
    }

    // Override this method in child classes for service-specific error messages
    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        return null;
    }

    handleError$ = (error: AIServiceError) => {
        const detailedMessage = this.getDetailedErrorMessage(error);

        // Add status code if available
        const finalMessage = error.status ? `HTTP ${error.status}: ${detailedMessage}` : detailedMessage;

        // 에러 로깅
        if (this.params.config.logging) {
            const diff = this.params.stagedDiff.diff;
            const serviceName = this.serviceName.replace(/\[|\]/g, '').trim();
            addLogEntry(diff, 'commit', serviceName, 'Error occurred', '', undefined, finalMessage);
        }

        logger.error(`${this.errorPrefix} ${finalMessage}`);
        if (error.stack) {
            logger.error(`    ${error.stack}`);
        }
        if (error.content) {
            logger.error(`    Problematic content: ${error.content}`);
        }
        if (error.originalError) {
            logger.error(`    Original error: ${error.originalError}`);
        }

        return of({
            name: `${this.errorPrefix} ${finalMessage}`,
            value: finalMessage,
            isError: true,
            disabled: true,
        });
    };

    protected cleanJsonCodeBlock(response: string): string {
        const codeBlockPattern = /```(?:json|JSON)?\s*([\s\S]*?)\s*```/;
        const match = response.match(codeBlockPattern);

        if (match) {
            return match[1].trim();
        }

        // 코드블록이 없으면 원본 반환
        return response;
    }

    protected parseMessage(aiGeneratedText: string, type: CommitType, maxCount: number): AIResponse[] {
        // 먼저 코드블록을 제거 (```json ... ``` 또는 ``` ... ``` 형태)
        const cleanedText = this.cleanJsonCodeBlock(aiGeneratedText);

        const jsonContentPattern = /(\[\s*\{[\s\S]*?\}\s*\]|\{[\s\S]*?\})/;
        const matchedJsonContent = cleanedText.match(jsonContentPattern);
        if (!matchedJsonContent) {
            const error: AIServiceError = new Error('AI response did not contain a valid JSON object or array.');
            error.name = 'InvalidJsonResponse';
            error.content = aiGeneratedText;
            throw error;
        }

        const jsonString = matchedJsonContent[0];
        const parseResult = safeJsonParse(jsonString);
        if (!parseResult.ok) {
            const error: AIServiceError = new Error(`Failed to parse AI response as JSON`);
            error.name = 'JsonParseError';
            error.content = jsonString;
            error.originalError = parseResult.error;
            throw error;
        }
        const parsedContent = parseResult.data;
        const rawCommitMessages: RawCommitMessage[] = Array.isArray(parsedContent) ? parsedContent : [parsedContent];

        if (!rawCommitMessages.length || !rawCommitMessages.every(msg => typeof msg.subject === 'string')) {
            const error: AIServiceError = new Error('AI response contained malformed commit message data.');
            error.name = 'MalformedCommitMessage';
            error.content = aiGeneratedText;
            throw error;
        }

        const formattedCommitMessages = rawCommitMessages
            .map(rawMessageData => this.extractMessageAsType(rawMessageData, type))
            .map((rawMessageData: RawCommitMessage) => ({
                title: `${rawMessageData.subject}`,
                value: `${rawMessageData.subject}${rawMessageData.body ? `\n\n${rawMessageData.body}` : ''}${rawMessageData.footer ? `\n\n${rawMessageData.footer}` : ''}`,
            }));

        const results = formattedCommitMessages.slice(0, maxCount);

        // 성공적인 파싱 결과 로깅
        if (this.isLoggingEnabled()) {
            const resultSummary = results.map(r => r.title).join(', ');
            logger.info(`${this.serviceName} Parsed ${results.length} commit messages: ${resultSummary}`);
        }

        return results;
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

    protected isLoggingEnabled(): boolean {
        return this.params.config.logging && !!this.logSessionId;
    }
}
