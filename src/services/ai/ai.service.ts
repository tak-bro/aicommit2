import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { RequestType, addLogEntry } from '../../utils/ai-log.js';
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

    // 개선된 로깅 메서드
    protected logAIRequest(prompt: string, response: string, duration?: number, error?: string) {
        if (this.params.config.logging) {
            const diff = this.params.stagedDiff.diff;
            const requestType: RequestType = 'commit'; // 기본값, 서비스에서 오버라이드 가능
            const serviceName = this.serviceName.replace(/\[|\]/g, '').trim();
            addLogEntry(diff, requestType, serviceName, prompt, response, duration, error);
        }
    }

    // 성능 측정과 함께 AI 요청 실행
    protected async executeWithLogging<T>(aiRequest: () => Promise<T>, prompt: string, requestType: RequestType): Promise<T> {
        const startTime = new Date();
        const serviceName = this.serviceName.replace(/\[|\]/g, '').trim();

        try {
            logger.info(`${this.serviceName} Starting ${requestType} request...`);

            const result = await aiRequest();
            const duration = Date.now() - startTime.getTime();

            logger.info(`${this.serviceName} Completed ${requestType} request in ${duration}ms`);

            // 성공적인 요청 로깅
            if (this.params.config.logging && typeof result === 'string') {
                const diff = this.params.stagedDiff.diff;
                addLogEntry(diff, requestType, serviceName, prompt, result, duration);
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime.getTime();
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            logger.error(`${this.serviceName} Failed ${requestType} request in ${duration}ms: ${errorMessage}`);

            // 실패한 요청 로깅
            if (this.params.config.logging) {
                const diff = this.params.stagedDiff.diff;
                addLogEntry(diff, requestType, serviceName, prompt, '', duration, errorMessage);
            }

            throw error;
        }
    }

    protected parseMessage(aiGeneratedText: string, type: CommitType, maxCount: number): AIResponse[] {
        const jsonContentPattern = /(\[\s*\{[\s\S]*?\}\s*\]|\{[\s\S]*?\})/;
        const matchedJsonContent = aiGeneratedText.match(jsonContentPattern);
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

    // 로깅 활성화 여부 확인
    protected isLoggingEnabled(): boolean {
        return this.params.config.logging && !!this.logSessionId;
    }

    // 서비스 이름 getter (로깅용)
    protected getServiceName(): string {
        return this.serviceName.replace(/\[|\]/g, '').trim();
    }
}

// 유틸리티 함수: 여러 AI 서비스 결과를 병합하여 로깅
export const mergeAIResponses = (responses: { service: string; response: AIResponse[] }[]): string => {
    return responses
        .map(({ service, response }) => {
            const titles = response.map(r => r.title).join(', ');
            return `${service}: ${titles}`;
        })
        .join(' | ');
};

// 유틸리티 함수: 로깅 세션 요약 생성
export const generateLogSummary = (services: string[], successful: number, failed: number, totalDuration: number): string => {
    return `Services: ${services.join(', ')} | Success: ${successful}/${services.length} | Duration: ${totalDuration}ms`;
};
