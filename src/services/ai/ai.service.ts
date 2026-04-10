import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, Subject, catchError, of } from 'rxjs';

import { addLogEntry } from '../../utils/ai-log.js';
import { CommitType, ModelConfig, ModelName, ModelNameDisplay } from '../../utils/config.js';
import { ErrorCode, ErrorCodeType, detectErrorCode, getPlainErrorMessage, httpStatusToErrorCode } from '../../utils/error-messages.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, generatePrompt } from '../../utils/prompt.js';
import { IncrementalJsonParser } from '../../utils/stream-json-parser.js';
import { getFirstWordsFrom, safeJsonParse } from '../../utils/utils.js';
import { GitDiff } from '../../utils/vcs.js';

export interface AIResponse {
    title: string;
    value: string;
}

export interface RawCommitMessage {
    subject: string;
    body?: string;
    footer?: string;
}

export type CodeReviewSeverity = 'critical' | 'warning' | 'suggestion' | 'praise';
export type CodeReviewCategory = 'bug' | 'security' | 'performance' | 'style' | 'maintainability' | 'other';

export interface CodeReviewItem {
    severity: CodeReviewSeverity;
    category: CodeReviewCategory;
    file?: string;
    line?: string;
    title: string;
    description: string;
    suggestion?: string;
}

export interface CodeReviewResponse {
    summary: string;
    items: CodeReviewItem[];
}

export interface AIServiceParams {
    config: ModelConfig<ModelName>;
    stagedDiff: GitDiff;
    keyName: ModelName;
    logSessionId?: string;
    branchName?: string;
    /** Whether stats recording is enabled */
    statsEnabled?: boolean;
    /** Days to retain stats data */
    statsDays?: number;
    /** How to display model name in service label: none, short, or full */
    modelNameDisplay?: ModelNameDisplay;
}

export interface AIServiceError extends Error {
    status?: number;
    code?: ErrorCodeType;
    content?: unknown;
    originalError?: unknown;
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

    /**
     * Format model name suffix based on modelNameDisplay config.
     * Returns '' for none, '/truncated-name' for short, '/full-name' for full.
     */
    protected formatModelSuffix = (): string => {
        const display = this.params.modelNameDisplay ?? 'short';
        const model = this.params.config.model;
        if (display === 'none' || !model) {
            return '';
        }
        const modelStr = Array.isArray(model) ? model[0] : String(model);
        if (display === 'full') {
            return `/${modelStr}`;
        }
        // short: take last segment of slash-separated name, truncate to 20 chars
        const shortName = modelStr.split('/').pop() || modelStr;
        return shortName.length > 20 ? `/${shortName.slice(0, 19)}…` : `/${shortName}`;
    };

    /**
     * Get provider name for error messages (plain text, no ANSI colors)
     */
    protected getProviderName(): string {
        // Remove ANSI escape codes (ESC[...m) and brackets from serviceName
        // ESC character is \x1b (decimal 27)
        const esc = String.fromCharCode(27);
        const ansiPattern = new RegExp(`${esc}\\[[0-9;]*m`, 'g');
        return this.serviceName.replace(ansiPattern, '').replace(/\[|\]/g, '').trim();
    }

    /**
     * Get detailed error message using centralized error message system
     */
    protected getDetailedErrorMessage(error: AIServiceError): string {
        const errorMsg = error.message || '';
        const provider = this.getProviderName();
        const model = this.params.config.model?.[0];
        const timeout = this.params.config.timeout;

        // Check for service-specific error message first
        const serviceSpecificMessage = this.getServiceSpecificErrorMessage(error);
        if (serviceSpecificMessage) {
            return serviceSpecificMessage;
        }

        // Detect error code from status or message
        const errorCode = error.code || (error.status ? httpStatusToErrorCode(error.status) : detectErrorCode(errorMsg));

        // Get plain text message for select list (no colors)
        if (errorCode !== ErrorCode.UNKNOWN) {
            return getPlainErrorMessage(errorCode, { provider, model, timeout });
        }

        // Fallback to original error message
        return errorMsg || 'Unknown error occurred';
    }

    /**
     * Override this method in child classes for service-specific error messages
     * Return null to use the default error handling
     */
    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        return null;
    }

    handleError$ = (error: AIServiceError) => {
        const detailedMessage = this.getDetailedErrorMessage(error);

        // Add status code if available
        const finalMessage = error.status ? `HTTP ${error.status}: ${detailedMessage}` : detailedMessage;

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

    /**
     * Extracts a valid JSON string from the response using bracket matching.
     * This is more reliable than regex for handling nested structures and escaped characters.
     */
    protected extractJsonFromResponse(response: string): string | null {
        const candidates: Array<{ startIndex: number; openChar: '[' | '{'; closeChar: ']' | '}' }> = [];

        const arrayIndex = response.indexOf('[');
        if (arrayIndex !== -1) {
            candidates.push({ startIndex: arrayIndex, openChar: '[', closeChar: ']' });
        }

        const objectIndex = response.indexOf('{');
        if (objectIndex !== -1) {
            candidates.push({ startIndex: objectIndex, openChar: '{', closeChar: '}' });
        }

        candidates.sort((left, right) => left.startIndex - right.startIndex);

        for (const candidate of candidates) {
            const result = this.extractBalancedJson(response, candidate.startIndex, candidate.openChar, candidate.closeChar);
            if (result && safeJsonParse(result).ok) {
                return result;
            }
        }

        return null;
    }

    /**
     * Extracts balanced JSON by matching opening and closing brackets.
     * Handles nested structures, strings with escaped quotes, and special characters.
     */
    protected extractBalancedJson(text: string, startIndex: number, openChar: string, closeChar: string): string | null {
        let depth = 0;
        let inString = false;
        let escapeNext = false;

        for (let i = startIndex; i < text.length; i++) {
            const char = text[i];

            if (escapeNext) {
                escapeNext = false;
                continue;
            }

            if (char === '\\' && inString) {
                escapeNext = true;
                continue;
            }

            if (char === '"') {
                inString = !inString;
                continue;
            }

            if (!inString) {
                if (char === openChar) {
                    depth++;
                }
                if (char === closeChar) {
                    depth--;
                }

                if (depth === 0) {
                    return text.slice(startIndex, i + 1);
                }
            }
        }

        return null;
    }

    /**
     * Extract the outermost JSON object from response text.
     * Unlike extractJsonFromResponse (which tries [ first for commit message arrays),
     * this tries { first — required for code review responses where the items array
     * would otherwise be matched before the outer object.
     */
    private extractJsonObjectFromResponse = (response: string): string | null => {
        const startIndex = response.indexOf('{');
        if (startIndex !== -1) {
            return this.extractBalancedJson(response, startIndex, '{', '}');
        }
        return null;
    };

    protected parseMessage(aiGeneratedText: string, type: CommitType, maxCount: number): AIResponse[] {
        const cleanedText = this.cleanJsonCodeBlock(aiGeneratedText);

        // Use bracket-matching extraction for robust JSON parsing
        const jsonString = this.extractJsonFromResponse(cleanedText);
        if (!jsonString) {
            const error: AIServiceError = new Error('AI response did not contain a valid JSON object or array.');
            error.name = 'InvalidJsonResponse';
            error.content = aiGeneratedText;
            throw error;
        }
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

        if (this.isLoggingEnabled()) {
            const resultSummary = results.map(r => r.title).join(', ');
            logger.info(`${this.serviceName} Parsed ${results.length} commit messages: ${resultSummary}`);
        }

        return results;
    }

    protected extractMessageAsType(data: RawCommitMessage, type: CommitType): RawCommitMessage {
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
                const disableLowerCase = this.params.config.disableLowerCase ?? false;
                return {
                    ...data,
                    subject: gitmojiMatch && !disableLowerCase ? gitmojiMatch[0].toLowerCase() : data.subject,
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
            const disableLowerCase = this.params.config.disableLowerCase ?? false;

            const normalizedType = type.toLowerCase();
            const normalizedDescription = disableLowerCase ? description : description.charAt(0).toLowerCase() + description.slice(1);
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

    /**
     * Build the system prompt for commit message generation.
     * Shared across all streaming service implementations.
     */
    protected buildCommitPrompt = (): string => {
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, locale, generate, type, maxLength } = this.params.config;
        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale,
            maxLength,
            type,
            generate,
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            vcs_branch: this.params.branchName || '',
        };
        return generatePrompt(promptOptions);
    };

    /**
     * Format a raw commit message into an AIResponse-like shape (title + full value).
     */
    protected formatRawCommitMessage = (raw: RawCommitMessage, type: CommitType): AIResponse => {
        const formatted = this.extractMessageAsType(raw, type);
        const title = formatted.subject;
        const value = `${formatted.subject}${formatted.body ? `\n\n${formatted.body}` : ''}${formatted.footer ? `\n\n${formatted.footer}` : ''}`;
        return { title, value };
    };

    /**
     * Build a ReactiveListChoice from an AIResponse (title + value).
     */
    protected formatAsChoice = (data: AIResponse): ReactiveListChoice => ({
        name: `${this.serviceName} ${data.title}`,
        short: data.title,
        value: this.params.config.includeBody ? data.value : data.title,
        description: this.params.config.includeBody ? data.value : '',
        isError: false,
    });

    /**
     * Extract a human-readable preview from partial JSON streaming buffer.
     * Tries to pull out subject and body fields even before the JSON object is complete.
     */
    private extractStreamPreview = (buffer: string): { subject: string; body: string } => {
        const subjectMatch = buffer.match(/"subject"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);
        const bodyMatch = buffer.match(/"body"\s*:\s*"((?:[^"\\]|\\.)*)(?:"|$)/);

        const subject = subjectMatch ? subjectMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
        const body = bodyMatch ? bodyMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n') : '';
        return { subject, body };
    };

    protected createStreamingCommitMessages$ = (
        chunkProducer: (subject: Subject<string>) => void,
        type: CommitType,
        maxCount: number
    ): Observable<ReactiveListChoice> => {
        const streamKey = `stream-${this.serviceName}-${Date.now()}`;

        return new Observable<ReactiveListChoice>(subscriber => {
            const parser = new IncrementalJsonParser();
            const subject = new Subject<string>();
            let emittedCount = 0;
            let previewEmitted = false;
            let lastPreviewTime = 0;
            const PREVIEW_THROTTLE_MS = 100;
            const STREAMING_LABEL = 'streaming';
            // ReactiveListChoice.disabled is boolean, but we need streamKey for in-place removal
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const removeSentinel: any = { name: '', value: '', streamKey, disabled: true, isError: false };

            const emitStreamPreview = (force = false): void => {
                const now = Date.now();
                if (!force && now - lastPreviewTime < PREVIEW_THROTTLE_MS) {
                    return;
                }
                lastPreviewTime = now;
                const unparsed = parser.getUnparsedBuffer();
                if (!unparsed.trim()) {
                    return;
                }

                const { subject: partialSubject, body: partialBody } = this.extractStreamPreview(unparsed);
                const displayName = partialSubject ? `${this.serviceName} ${partialSubject}` : `${this.serviceName} Generating...`;
                const displayDescription = partialBody || partialSubject || '';

                // ReactiveListChoice lacks streamKey/disabled-as-string; using any to extend shape
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const preview: any = {
                    name: displayName,
                    short: partialSubject || 'Generating...',
                    value: `__streaming__${streamKey}`,
                    description: displayDescription,
                    disabled: STREAMING_LABEL,
                    isError: false,
                    streamKey,
                };
                subscriber.next(preview);
                previewEmitted = true;
            };

            const emitParsedMessages = (messages: RawCommitMessage[]): void => {
                for (const raw of messages) {
                    if (emittedCount >= maxCount) {
                        break;
                    }
                    subscriber.next(this.formatAsChoice(this.formatRawCommitMessage(raw, type)));
                    emittedCount++;
                }
            };

            const subscription = subject.subscribe({
                next: (chunk: string) => {
                    if (emittedCount >= maxCount) {
                        return;
                    }

                    const parsed = parser.feed(chunk);
                    emitParsedMessages(parsed);

                    // Show/update streaming preview for text being generated
                    if (emittedCount < maxCount) {
                        emitStreamPreview();
                    }
                },
                error: (err: unknown) => {
                    // Remove preview on error
                    if (previewEmitted) {
                        subscriber.next(removeSentinel);
                    }
                    subscriber.error(err);
                },
                complete: () => {
                    emitParsedMessages(parser.flush());

                    // Remove streaming preview by emitting empty sentinel
                    if (previewEmitted) {
                        subscriber.next(removeSentinel);
                    }

                    // Fallback: if incremental parsing yielded nothing, try full parse
                    const buffer = parser.getBuffer();
                    if (emittedCount === 0 && buffer.trim()) {
                        try {
                            const fullParseResults = this.parseMessage(buffer, type, maxCount);
                            for (const data of fullParseResults) {
                                subscriber.next(this.formatAsChoice(data));
                            }
                        } catch (parseError) {
                            subscriber.error(parseError);
                            return;
                        }
                    }

                    subscriber.complete();
                },
            });

            chunkProducer(subject);

            return () => {
                subscription.unsubscribe();
            };
        }).pipe(catchError(this.handleError$));
    };

    /**
     * Parse structured code review JSON from AI response.
     * Falls back to sanitizeResponse() if JSON parsing fails.
     */
    protected parseCodeReview = (aiGeneratedText: string): AIResponse[] => {
        const cleanedText = this.cleanJsonCodeBlock(aiGeneratedText);
        // Code review response is a JSON object {summary, items}, not an array.
        // extractJsonFromResponse tries [ first, which matches the nested "items" array
        // and causes structure validation to fail. Extract { first instead.
        const jsonString = this.extractJsonObjectFromResponse(cleanedText);

        if (!jsonString) {
            logger.warn(`${this.serviceName} Code review response did not contain JSON, falling back to plain text`);
            return this.sanitizeResponse(aiGeneratedText);
        }

        const parseResult = safeJsonParse(jsonString);
        if (!parseResult.ok) {
            logger.warn(`${this.serviceName} Failed to parse code review JSON, falling back to plain text`);
            return this.sanitizeResponse(aiGeneratedText);
        }

        const parsed = parseResult.data as CodeReviewResponse;
        const hasValidStructure = parsed && typeof parsed.summary === 'string' && Array.isArray(parsed.items);
        if (!hasValidStructure) {
            logger.warn(`${this.serviceName} Code review JSON missing summary or items, falling back to plain text`);
            return this.sanitizeResponse(aiGeneratedText);
        }

        const validItems = parsed.items.filter(
            (item): item is CodeReviewItem =>
                typeof item.title === 'string' &&
                typeof item.severity === 'string' &&
                typeof item.description === 'string' &&
                typeof item.category === 'string'
        );

        const hasCritical = validItems.some(item => item.severity === 'critical');
        const title = this.formatReviewSummaryTitle(parsed.summary, validItems);
        const value = this.formatReviewAsMarkdown(parsed.summary, validItems, hasCritical);

        if (this.isLoggingEnabled()) {
            logger.info(`${this.serviceName} Parsed code review: ${validItems.length} items`);
        }

        return [{ title, value }];
    };

    /**
     * Build a ReactiveListChoice from a code review AIResponse.
     */
    protected formatCodeReviewAsChoice = (data: AIResponse): ReactiveListChoice => ({
        name: `${this.serviceName} ${data.title}`,
        short: data.title,
        value: data.value,
        description: data.value,
        isError: false,
    });

    private formatReviewSummaryTitle = (summary: string, items: CodeReviewItem[]): string => {
        const counts = items.reduce(
            (acc, item) => {
                acc[item.severity] = (acc[item.severity] ?? 0) + 1;
                return acc;
            },
            {} as Partial<Record<CodeReviewSeverity, number>>
        );

        const severityOrder: CodeReviewSeverity[] = ['critical', 'warning', 'suggestion', 'praise'];
        const parts = severityOrder.filter(s => counts[s]).map(s => `${counts[s]} ${s}`);

        const severityInfo = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        const MAX_SUMMARY_LENGTH = 60;
        const truncatedSummary = summary.length > MAX_SUMMARY_LENGTH ? `${summary.slice(0, MAX_SUMMARY_LENGTH - 3)}...` : summary;
        return `${truncatedSummary}${severityInfo}`;
    };

    private formatReviewAsMarkdown = (summary: string, items: CodeReviewItem[], hasCritical: boolean): string => {
        const criticalMarker = hasCritical ? '\n<!-- HAS_CRITICAL_ISSUES -->\n' : '';
        const lines: string[] = [`## Summary\n${summary}${criticalMarker}\n`];

        const severityOrder: CodeReviewSeverity[] = ['critical', 'warning', 'suggestion', 'praise'];

        for (const severity of severityOrder) {
            const group = items.filter(item => item.severity === severity);
            if (group.length === 0) {
                continue;
            }

            lines.push(`### [${severity.toUpperCase()}] ${severity.charAt(0).toUpperCase()}${severity.slice(1)}\n`);

            for (const item of group) {
                const location = item.file ? ` (${item.file}${item.line ? `:${item.line}` : ''})` : '';
                lines.push(`- **[${item.category}]** ${item.title}${location}`);
                lines.push(`  ${item.description}`);
                if (item.suggestion) {
                    lines.push(`  > Suggestion: ${item.suggestion}`);
                }
                lines.push('');
            }
        }

        return lines.join('\n');
    };

    protected isLoggingEnabled(): boolean {
        return this.params.config.logging && !!this.logSessionId;
    }
}
