import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceParams } from './ai.service.js';
import { logger } from '../../utils/logger.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

export class CopilotService extends AIService {
    private readonly baseURL = 'https://models.inference.ai.azure.com';

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#24292e',
            secondary: '#FFF',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[GitHub Models]`);
        this.errorPrefix = chalk.red.bold(`[GitHub Models]`);
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

    private async generateMessage(type: 'commit' | 'review'): Promise<AIResponse[]> {
        if (!this.params.config.key) {
            throw new Error('GitHub token is required for GitHub Models. Use: aic2 copilot-login');
        }

        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale: this.params.config.locale,
            maxLength: this.params.config.maxLength,
            type: this.params.config.type,
        };

        const systemPrompt = type === 'commit' ? generatePrompt(promptOptions) : codeReviewPrompt(this.params.config.systemPrompt);

        const diff = this.params.stagedDiff.diff;
        const userPrompt = `${systemPrompt}\n\n${diff}`;

        const numOfGeneration = this.params.config.generate;
        const aiResponses: AIResponse[] = [];

        for (let i = 0; i < numOfGeneration; i++) {
            try {
                const response = await this.makeRequest(userPrompt);

                if (!response) {
                    throw new Error('No response content received from GitHub Models');
                }

                const lines = response.split('\n').filter(line => line.trim() !== '');
                const title = lines[0] || response;
                const description = lines.slice(1).join('\n') || '';

                aiResponses.push({
                    title: title.replace(/^#+\s*/, '').trim(),
                    value: description ? `${title}\n\n${description}` : title,
                });
            } catch (error) {
                logger.error(`GitHub Models request failed (attempt ${i + 1}):`, error);
                if (i === numOfGeneration - 1) {
                    throw error;
                }
            }
        }

        return aiResponses;
    }

    private async makeRequest(prompt: string): Promise<string> {
        const model = Array.isArray(this.params.config.model) ? this.params.config.model[0] : this.params.config.model || 'gpt-4o-mini';

        const messages = [
            {
                role: 'user',
                content: prompt,
            },
        ];

        const body = {
            messages,
            model,
            temperature: this.params.config.temperature || 0.7,
            max_tokens: this.params.config.maxTokens || 1024,
            top_p: this.params.config.topP || 0.95,
            stream: false,
        };

        logger.info(`Making request to GitHub Models API with model: ${model}`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.params.config.timeout);

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.params.config.key}`,
                    'User-Agent': 'aicommit2-github-models/1.0',
                },
                body: JSON.stringify(body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                let errorMessage = `GitHub Models API request failed: ${response.status} ${response.statusText}`;

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
                    throw new Error('GitHub authentication failed. Please run: aic2 copilot-login');
                } else if (response.status === 403) {
                    throw new Error('GitHub Models access denied. Make sure your token has "Models" permission.');
                } else if (response.status === 404) {
                    throw new Error(`Model "${model}" not found. Please check the model name.`);
                }

                throw new Error(errorMessage);
            }

            const result = await response.json();
            const content = result.choices?.[0]?.message?.content?.trim();

            if (!content) {
                throw new Error('No response content received from GitHub Models');
            }

            // Log the request for debugging
            if (this.params.config.logging) {
                logger.info('GitHub Models API request completed successfully');
            }

            return content;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`GitHub Models request timed out after ${this.params.config.timeout}ms`);
            }
            throw error;
        }
    }
}
