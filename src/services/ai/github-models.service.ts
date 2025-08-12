import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { isGPT5Model } from '../../utils/openai.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

export class GitHubModelsService extends AIService {
    private readonly baseURL = 'https://models.github.ai';

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#24292e',
            secondary: '#FFF',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[GitHub Models]`);
        this.errorPrefix = chalk.red.bold(`[GitHub Models]`);
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        switch (error.code) {
            case 'MISSING_TOKEN':
                return 'GitHub token is required. Run: aicommit2 github-login';
            case 'AUTHENTICATION_FAILED':
                return 'Authentication failed. Your GitHub token may be expired or invalid. Run: aicommit2 github-login';
            case 'ACCESS_DENIED':
                return 'Access denied. Make sure your GitHub token has "Models" permission in GitHub settings';
            case 'NO_CONTENT':
                return 'No content received from GitHub Models. The model may have failed to generate a response';
            default:
                return null;
        }
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('commit')).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: this.params.config.includeBody ? data.value : data.title,
                description: this.params.config.includeBody ? data.value : '',
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('review')).pipe(
            concatMap(messages => from(messages)),
            map(data => ({
                name: `${this.serviceName} ${data.title}`,
                short: data.title,
                value: data.value,
                description: data.value,
                isError: false,
            })),
            catchError(this.handleError$)
        );
    }

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        if (!this.params.config.key) {
            const tokenError = new Error('GitHub token is required for GitHub Models. Use: aicommit2 github-login') as AIServiceError;
            tokenError.code = 'MISSING_TOKEN';
            throw tokenError;
        }

        const diff = this.params.stagedDiff.diff;
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
        };

        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        const result = await this.makeRequest(generatedSystemPrompt, diff, requestType);

        if (requestType === 'review') {
            return this.sanitizeResponse(result);
        }
        return this.parseMessage(result, type, generate);
    }

    private async makeRequest(systemPrompt: string, diff: string, requestType: RequestType): Promise<string> {
        const model = Array.isArray(this.params.config.model) ? this.params.config.model[0] : this.params.config.model || 'gpt-4o-mini';

        const messages = [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: requestType === 'review' ? diff : `Here's the git diff:\n\n${diff}`,
            },
        ];

        // GPT-5 series models have different parameter requirements
        const isGPT5 = isGPT5Model(model);

        const body: any = {
            messages,
            model,
            stream: false,
            ...(isGPT5
                ? {
                      max_completion_tokens: this.params.config.maxTokens || 1024,
                      temperature: 1,
                  }
                : {
                      max_tokens: this.params.config.maxTokens || 1024,
                      top_p: this.params.config.topP || 0.95,
                      temperature: this.params.config.temperature || 0.7,
                  }),
        };

        const url = `${this.baseURL}/inference/chat/completions`;
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.params.config.key}`,
        };

        const { logging } = this.params.config;
        logAIRequest(diff, requestType, 'GitHub Models', model, url, headers, logging);
        logAIPrompt(
            diff,
            requestType,
            'GitHub Models',
            systemPrompt,
            requestType === 'review' ? diff : `Here's the git diff:\n\n${diff}`,
            logging
        );
        logAIPayload(diff, requestType, 'GitHub Models', body, logging);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.params.config.timeout);

        try {
            const startTime = Date.now();
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                const errorData = {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    headers: Object.fromEntries(response.headers),
                    body: errorText,
                };

                // Winston 형식 에러 로깅
                logAIError(diff, requestType, 'GitHub Models', errorData, logging);

                let errorMessage = `GitHub API request failed: ${response.status} ${response.statusText}`;

                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.error?.message) {
                        errorMessage += ` - ${errorJson.error.message}`;
                    } else if (errorJson.message) {
                        errorMessage += ` - ${errorJson.message}`;
                    }
                } catch {
                    if (errorText) {
                        errorMessage += ` - ${errorText}`;
                    }
                }

                if (response.status === 401) {
                    const authError = new Error('GitHub authentication failed. Please run: aicommit2 github-login') as AIServiceError;
                    authError.status = response.status;
                    authError.code = 'AUTHENTICATION_FAILED';
                    authError.content = errorText;
                    throw authError;
                } else if (response.status === 403) {
                    const accessError = new Error(
                        'GitHub Models access denied. Make sure your token has "Models" permission.'
                    ) as AIServiceError;
                    accessError.status = response.status;
                    accessError.code = 'ACCESS_DENIED';
                    accessError.content = errorText;
                    throw accessError;
                } else if (response.status === 404) {
                    const modelError = new Error(`Model "${model}" not found. Please check the model name.`) as AIServiceError;
                    modelError.status = response.status;
                    modelError.code = 'MODEL_NOT_FOUND';
                    modelError.content = errorText;
                    throw modelError;
                } else if (response.status === 429) {
                    const rateError = new Error('Rate limit exceeded. Please try again later.') as AIServiceError;
                    rateError.status = response.status;
                    rateError.code = 'RATE_LIMIT_EXCEEDED';
                    rateError.content = errorText;
                    throw rateError;
                }

                const generalError = new Error(errorMessage) as AIServiceError;
                generalError.status = response.status;
                generalError.code = 'API_ERROR';
                generalError.content = errorText;
                throw generalError;
            }

            const result = await response.json();

            const duration = Date.now() - startTime;

            // Winston 형식 응답 로깅
            logAIResponse(diff, requestType, 'GitHub Models', result, logging);

            const content = result.choices?.[0]?.message?.content?.trim();

            if (!content) {
                const errorData = { message: 'No content found in GitHub Models response', result };
                logAIError(diff, requestType, 'GitHub Models', errorData, logging);
                const contentError = new Error('No response content received from GitHub Models') as AIServiceError;
                contentError.code = 'NO_CONTENT';
                contentError.content = JSON.stringify(result, null, 2);
                throw contentError;
            }

            // 성공적으로 완료됨을 로깅
            logAIComplete(diff, requestType, 'GitHub Models', duration, content, logging);
            return content;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                const timeoutData = { message: `GitHub Models request timeout after ${this.params.config.timeout}ms`, error };
                logAIError(diff, requestType, 'GitHub Models', timeoutData, logging);
                const timeoutError = new Error(`GitHub Models request timed out after ${this.params.config.timeout}ms`) as AIServiceError;
                timeoutError.code = 'REQUEST_TIMEOUT';
                timeoutError.originalError = error;
                throw timeoutError;
            }

            // If it's already an AIServiceError, just pass it through
            if ((error as AIServiceError).code) {
                throw error;
            }

            // Otherwise, wrap it in an AIServiceError
            const errorData = { message: 'GitHub Models request failed', error };
            logAIError(diff, requestType, 'GitHub Models', errorData, logging);
            const wrappedError = new Error(
                `GitHub Models request failed: ${error instanceof Error ? error.message : String(error)}`
            ) as AIServiceError;
            wrappedError.code = 'REQUEST_FAILED';
            wrappedError.originalError = error;
            throw wrappedError;
        }
    }
}
