import chalk from 'chalk';
import { CohereClientV2 } from 'cohere-ai';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { getRandomNumber } from '../../utils/utils.js';

type CohereV2Message = {
    role: 'system' | 'user';
    content: string;
};

type CohereV2Response = {
    message: {
        content: Array<{ text: string }>;
    };
};

export class CohereService extends AIService {
    private cohere: CohereClientV2;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#D18EE2',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Cohere]');
        this.errorPrefix = chalk.red.bold(`[Cohere]`);
        this.cohere = new CohereClientV2({
            token: this.params.config.key,
        });
    }

    private isValidCohereV2Response(response: unknown): response is CohereV2Response {
        const pred = response as any;
        return (
            pred?.message?.content !== undefined &&
            Array.isArray(pred.message.content) &&
            pred.message.content.length > 0 &&
            typeof pred.message.content[0]?.text === 'string'
        );
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
        const userPrompt = `Here is the diff: ${diff}`;

        const messages: CohereV2Message[] = [
            ...(generatedSystemPrompt ? [{ role: 'system' as const, content: generatedSystemPrompt }] : []),
            { role: 'user' as const, content: userPrompt },
        ];

        const baseUrl = this.params.config.url;
        const url = `${baseUrl}/v2/chat`;

        logAIRequest(diff, requestType, 'Cohere', this.params.config.model, url, {}, logging);
        logAIPrompt(diff, requestType, 'Cohere', generatedSystemPrompt, userPrompt, logging);

        const payload = {
            model: this.params.config.model,
            messages,
            max_tokens: maxTokens,
            temperature,
            seed: getRandomNumber(10, 1000),
            p: this.params.config.topP,
        };

        logAIPayload(diff, requestType, 'Cohere', payload, logging);

        const startTime = Date.now();

        try {
            const prediction = await this.cohere.chat(payload, {
                timeoutInSeconds: Math.floor(this.params.config.timeout / 1000),
            });

            const duration = Date.now() - startTime;
            if (!this.isValidCohereV2Response(prediction)) {
                throw new Error('Invalid response structure from Cohere v2 API');
            }

            const result = prediction.message.content[0].text;

            logAIResponse(diff, requestType, 'Cohere', prediction, logging);
            logAIComplete(diff, requestType, 'Cohere', duration, result, logging);

            if (requestType === 'review') {
                return this.sanitizeResponse(result);
            }
            return this.parseMessage(result, type, generate);
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'Cohere', error, logging);
            throw error;
        }
    }
}
