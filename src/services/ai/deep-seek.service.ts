import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';

export interface DeepSeekServiceError extends AIServiceError {}

export class DeepSeekService extends AIService {
    private host = 'https://api.deepseek.com';
    private deepSeek: OpenAI;

    constructor(private readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#53a3f9',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[DeepSeek]`);
        this.errorPrefix = chalk.red.bold(`[DeepSeek]`);

        this.deepSeek = new OpenAI({
            baseURL: this.host,
            apiKey: this.params.config.key,
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // DeepSeek-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your DeepSeek API key in configuration';
        }
        if (errorMsg.includes('rate_limit') || errorMsg.includes('Rate limit')) {
            return 'Rate limit exceeded. Wait a moment and try again, or upgrade your DeepSeek plan';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the DeepSeek model name is correct';
        }
        if (errorMsg.includes('Invalid model type')) {
            return 'Invalid model type. Use supported models: deepseek-reasoner, deepseek-chat';
        }
        if (errorMsg.includes('overloaded') || errorMsg.includes('capacity')) {
            return 'DeepSeek service is overloaded. Try again in a few minutes';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this DeepSeek model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your DeepSeek model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'DeepSeek server error. Try again later';
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
        const { systemPrompt, systemPromptPath, codeReviewPromptPath, logging, locale, generate, type, maxLength } = this.params.config;
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
        this.checkAvailableModels();
        const chatResponse = await this.createChatCompletions(generatedSystemPrompt, diff, requestType);
        // logging && createLogResponse('DeepSeek', diff, generatedSystemPrompt, chatResponse, requestType);
        if (requestType === 'review') {
            return this.sanitizeResponse(chatResponse);
        }
        return this.parseMessage(chatResponse, type, generate);
    }

    private checkAvailableModels() {
        const supportModels = [`deepseek-reasoner`, `deepseek-chat`];
        if (supportModels.includes(this.params.config.model)) {
            return true;
        }
        throw new Error(`Invalid model type of DeepSeek`);
    }

    private async createChatCompletions(systemPrompt: string, diff: string, requestType: RequestType) {
        const chatCompletion = await this.deepSeek.chat.completions.create(
            {
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt,
                    },
                    {
                        role: 'user',
                        content: generateUserPrompt(diff, requestType),
                    },
                ],
                model: this.params.config.model,
                max_tokens: this.params.config.maxTokens,
                top_p: this.params.config.topP,
                temperature: this.params.config.temperature,
            },
            {
                timeout: this.params.config.timeout,
            }
        );

        return chatCompletion.choices[0].message.content || '';
    }
}
