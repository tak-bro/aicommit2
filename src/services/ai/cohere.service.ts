import chalk from 'chalk';
import { CohereClient } from 'cohere-ai';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, createLogResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { getRandomNumber } from '../../utils/utils.js';

const DEFAULT_TIMEOUT = 2 * 60 * 1000; // 2 minutes in milliseconds

export class CohereService extends AIService {
    private cohere: CohereClient;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#D18EE2',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Cohere]');
        this.errorPrefix = chalk.red.bold(`[Cohere]`);
        this.cohere = new CohereClient({
            token: this.params.config.key,
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Cohere-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Cohere API key in configuration';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or upgrade your Cohere plan';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Cohere model name is correct';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'Cohere service is overloaded. Try again in a few minutes';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Cohere model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Cohere model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Cohere server error. Try again later';
        }

        return null;
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
        const diff = this.params.stagedDiff.diff;
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, temperature, locale, generate, type, maxLength, maxTokens } =
            this.params.config;
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

        const prediction = await this.cohere.chat(
            {
                chatHistory: generatedSystemPrompt ? [{ role: 'SYSTEM', message: generatedSystemPrompt }] : [],
                message: `Here is the diff: ${diff}`,
                connectors: [{ id: 'web-search' }],
                maxTokens,
                temperature,
                model: this.params.config.model,
                seed: getRandomNumber(10, 1000),
                p: this.params.config.topP,
            },
            {
                ...(this.params.config.timeout > DEFAULT_TIMEOUT && {
                    timeoutInSeconds: Math.floor(this.params.config.timeout / 1000),
                }),
            }
        );

        logging && createLogResponse('Cohere', diff, generatedSystemPrompt, prediction.text, requestType);
        if (requestType === 'review') {
            return this.sanitizeResponse(prediction.text);
        }
        return this.parseMessage(prediction.text, type, generate);
    }
}
