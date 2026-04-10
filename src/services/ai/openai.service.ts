import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import OpenAI from 'openai';
import { Observable, Subject, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { generateCommitMessage, isReasoningModel } from '../../utils/openai.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';
import { flattenDeep } from '../../utils/utils.js';

export class OpenAIService extends AIService {
    private openAI: OpenAI;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#74AA9C',
            secondary: '#FFF',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[ChatGPT${this.formatModelSuffix()}]`);
        this.errorPrefix = chalk.red.bold(`[ChatGPT${this.formatModelSuffix()}]`);
        // SDK appends /chat/completions internally, so strip it from the configured path
        // Default: url='https://api.openai.com', path='/v1/chat/completions'
        // baseURL must be 'https://api.openai.com/v1' (without /chat/completions)
        const baseUrl = this.params.config.url || 'https://api.openai.com';
        const basePath = (this.params.config.path || '/v1/chat/completions').replace(/\/chat\/completions\/?$/, '');
        this.openAI = new OpenAI({
            apiKey: this.params.config.key,
            baseURL: `${baseUrl}${basePath}`,
        });
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // OpenAI-specific error messages
        if (errorMsg.includes('API key')) {
            return 'Invalid API key. Check your OpenAI API key in configuration';
        }
        if (errorMsg.includes('quota')) {
            return 'API quota exceeded. Check your OpenAI usage limits';
        }
        if (errorMsg.includes('500')) {
            return 'OpenAI server error. Try again later';
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
        const {
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            temperature,
            logging,
            locale,
            generate,
            type,
            maxLength,
            maxTokens,
            timeout,
        } = this.params.config;
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
        const userPrompt = `Here is the diff: ${diff}`;

        const url = `${this.params.config.url}${this.params.config.path}`;
        const headers = {
            Authorization: `Bearer ${this.params.config.key}`,
            'Content-Type': 'application/json',
        };

        logAIRequest(diff, 'commit', 'ChatGPT', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, 'commit', 'ChatGPT', generatedSystemPrompt, userPrompt, logging);

        const reasoningModel = isReasoningModel(this.params.config.model);

        // OpenAI SDK typing requires `any` for stream-conditional payload
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: any = {
            messages: [
                { role: 'system', content: generatedSystemPrompt },
                { role: 'user', content: userPrompt },
            ],
            model: this.params.config.model,
            stream: true,
            ...(reasoningModel
                ? {
                      max_completion_tokens: maxTokens,
                      temperature: 1,
                  }
                : {
                      max_tokens: maxTokens,
                      top_p: this.params.config.topP,
                      temperature: temperature,
                  }),
        };

        logAIPayload(diff, 'commit', 'ChatGPT', payload, logging);

        const startTime = Date.now();
        let accumulatedText = '';

        try {
            const stream = await this.openAI.chat.completions.create(payload, { timeout });
            const chatCompletionStream = stream as unknown as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

            for await (const chunk of chatCompletionStream) {
                const content = chunk.choices?.[0]?.delta?.content || '';
                if (content) {
                    accumulatedText += content;
                    subject.next(content);
                }
            }

            const duration = Date.now() - startTime;
            logAIResponse(diff, 'commit', 'ChatGPT', { streamed: true, totalLength: accumulatedText.length }, logging);
            logAIComplete(diff, 'commit', 'ChatGPT', duration, accumulatedText, logging);

            subject.complete();
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, 'commit', 'ChatGPT', error, logging);
            subject.error(error);
        }
    };

    private async generateMessage(requestType: RequestType): Promise<AIResponse[]> {
        const diff = this.params.stagedDiff.diff;
        const {
            systemPrompt,
            systemPromptPath,
            codeReviewPromptPath,
            temperature,
            logging,
            locale,
            generate,
            type,
            maxLength,
            proxy,
            maxTokens,
            timeout,
        } = this.params.config;
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

        const results = await generateCommitMessage(
            'ChatGPT',
            this.params.config.url,
            this.params.config.path,
            this.params.config.key,
            this.params.config.model,
            diff,
            timeout,
            maxTokens,
            temperature,
            this.params.config.topP,
            generatedSystemPrompt,
            logging,
            requestType,
            proxy
        );

        if (requestType === 'review') {
            return flattenDeep(results.map(value => this.parseCodeReview(value)));
        }
        return flattenDeep(results.map(value => this.parseMessage(value, type, generate)));
    }
}
