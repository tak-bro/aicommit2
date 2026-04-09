import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, Subject, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';

export interface DeepSeekServiceError extends AIServiceError {}

interface DeepSeekMessage extends OpenAI.Chat.Completions.ChatCompletionMessage {
    reasoning_content?: string;
}

interface DeepSeekChoice {
    message: DeepSeekMessage;
    finish_reason: string | null;
    index: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    logprobs?: any;
}

interface DeepSeekChatCompletion extends Omit<OpenAI.Chat.Completions.ChatCompletion, 'choices'> {
    choices: DeepSeekChoice[];
}

export class DeepSeekService extends AIService {
    private deepSeek: OpenAI;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#53a3f9',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[DeepSeek/${this.params.config.model}]`);
        this.errorPrefix = chalk.red.bold(`[DeepSeek/${this.params.config.model}]`);

        const baseUrl = this.params.config.url || 'https://api.deepseek.com';
        this.deepSeek = new OpenAI({
            baseURL: baseUrl,
            apiKey: this.params.config.key,
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

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
        const isStream = this.params.config.stream || false;

        if (isStream) {
            return this.generateStreamingCommitMessage$();
        }

        return fromPromise(this.generateMessage('commit')).pipe(
            concatMap(messages => from(messages)),
            map(this.formatAsChoice),
            catchError(this.handleError$)
        );
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return fromPromise(this.generateMessage('review')).pipe(
            concatMap(messages => from(messages)),
            map(this.formatCodeReviewAsChoice),
            catchError(this.handleError$)
        );
    }

    private generateStreamingCommitMessage$ = (): Observable<ReactiveListChoice> => {
        const { generate, type } = this.params.config;

        return this.createStreamingCommitMessages$(
            subject => {
                this.streamChunks(subject).catch(err => subject.error(err));
            },
            type,
            generate
        );
    };

    private streamChunks = async (subject: Subject<string>): Promise<void> => {
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
            vcs_branch: this.params.branchName || '',
        };
        const generatedSystemPrompt = generatePrompt(promptOptions);

        this.checkAvailableModels();

        const userPrompt = generateUserPrompt(diff, 'commit');
        const baseUrl = this.params.config.url || 'https://api.deepseek.com';
        const url = `${baseUrl}/chat/completions`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
        };

        logAIRequest(diff, 'commit', 'DeepSeek', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, 'commit', 'DeepSeek', generatedSystemPrompt, userPrompt, logging);

        // OpenAI SDK typing requires `any` for stream-conditional payload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = {
            messages: [
                { role: 'system', content: generatedSystemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: this.params.config.model,
            max_tokens: this.params.config.maxTokens,
            top_p: this.params.config.topP,
            temperature: this.params.config.temperature,
            stream: true,
        };

        logAIPayload(diff, 'commit', 'DeepSeek', payload, logging);

        const startTime = Date.now();
        let accumulatedText = '';

        try {
            const stream = await this.deepSeek.chat.completions.create(payload, {
                timeout: this.params.config.timeout,
            });
            const chatCompletionStream = stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

            for await (const chunk of chatCompletionStream) {
                const content = chunk.choices?.[0]?.delta?.content || '';
                // DeepSeek reasoning models emit reasoning_content
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const reasoning = (chunk.choices?.[0]?.delta as any)?.reasoning_content || '';
                const chunkText = `${content}${reasoning}`;

                if (chunkText) {
                    accumulatedText += chunkText;
                    subject.next(chunkText);
                }
            }

            const duration = Date.now() - startTime;
            logAIResponse(diff, 'commit', 'DeepSeek', { streamed: true, totalLength: accumulatedText.length }, logging);
            logAIComplete(diff, 'commit', 'DeepSeek', duration, accumulatedText, logging);

            subject.complete();
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, 'commit', 'DeepSeek', error, logging);
            subject.error(error);
        }
    };

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
            vcs_branch: this.params.branchName || '',
        };
        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);

        this.checkAvailableModels();

        const userPrompt = generateUserPrompt(diff, requestType);
        const baseUrl = this.params.config.url || 'https://api.deepseek.com';
        const url = `${baseUrl}/chat/completions`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
        };

        logAIRequest(diff, requestType, 'DeepSeek', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'DeepSeek', generatedSystemPrompt, userPrompt, logging);

        const chatResponse = await this.createChatCompletions(generatedSystemPrompt, userPrompt, requestType);
        if (requestType === 'review') {
            return this.parseCodeReview(chatResponse);
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

    private async createChatCompletions(systemPrompt: string, userPrompt: string, requestType: RequestType) {
        const diff = this.params.stagedDiff.diff;
        const { logging } = this.params.config;

        const payload = {
            messages: [
                { role: 'system' as const, content: systemPrompt },
                { role: 'user' as const, content: userPrompt },
            ],
            model: this.params.config.model,
            max_tokens: this.params.config.maxTokens,
            top_p: this.params.config.topP,
            temperature: this.params.config.temperature,
        };

        logAIPayload(diff, requestType, 'DeepSeek', payload, logging);

        const startTime = Date.now();

        try {
            const chatCompletion = (await this.deepSeek.chat.completions.create(payload, {
                timeout: this.params.config.timeout,
            })) as DeepSeekChatCompletion;

            const duration = Date.now() - startTime;

            const firstChoice = chatCompletion.choices?.[0];
            if (!firstChoice?.message) {
                throw new Error('DeepSeek API returned invalid response structure');
            }

            const result = firstChoice.message.content || firstChoice.message.reasoning_content || '';

            if (!result) {
                throw new Error('DeepSeek API returned empty response');
            }

            logAIResponse(diff, requestType, 'DeepSeek', chatCompletion, logging);
            logAIComplete(diff, requestType, 'DeepSeek', duration, result, logging);

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'DeepSeek', error, logging);
            throw error;
        }
    }
}
