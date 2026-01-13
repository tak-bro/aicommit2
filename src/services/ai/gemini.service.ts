import { GenerationConfig, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';

export class GeminiService extends AIService {
    private genAI: GoogleGenerativeAI;

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.colors = {
            primary: '#0077FF',
            secondary: '#fff',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold('[Gemini]');
        this.errorPrefix = chalk.red.bold(`[Gemini]`);
        this.genAI = new GoogleGenerativeAI(this.params.config.key);
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const errorMsg = error.message || '';

        // Gemini-specific error messages
        if (errorMsg.includes('API key') || errorMsg.includes('api_key')) {
            return 'Invalid API key. Check your Google AI Studio API key in configuration';
        }
        if (errorMsg.includes('quota') || errorMsg.includes('QUOTA_EXCEEDED')) {
            return 'API quota exceeded. Check your Google AI Studio usage limits';
        }
        if (errorMsg.includes('model') || errorMsg.includes('Model')) {
            return 'Model not found or not accessible. Check if the Gemini model name is correct';
        }
        if (errorMsg.includes('SAFETY') || errorMsg.includes('safety')) {
            return 'Content blocked by safety filters. Try rephrasing your request';
        }
        if (errorMsg.includes('RECITATION') || errorMsg.includes('recitation')) {
            return 'Content blocked due to recitation concerns. Try a different approach';
        }
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
            return 'Access denied. Your API key may not have permission for this Gemini model';
        }
        if (errorMsg.includes('404') || errorMsg.includes('Not Found')) {
            return 'Model or endpoint not found. Check your Gemini model configuration';
        }
        if (errorMsg.includes('500') || errorMsg.includes('Internal Server Error')) {
            return 'Google AI service error. Try again later';
        }
        if (errorMsg.includes('MAX_TOKENS') || errorMsg.includes('truncated') || errorMsg.includes('maxOutputTokens')) {
            return 'Response truncated due to token limit. Gemini 2.5+ models use thinking tokens. Try increasing maxTokens (recommended: 8192+)';
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
        const { systemPrompt, systemPromptPath, logging, locale, codeReviewPromptPath, generate, type, maxLength } = this.params.config;
        const maxTokens = this.params.config.maxTokens;
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
        const generationConfig: GenerationConfig = {
            maxOutputTokens: maxTokens,
            temperature: this.params.config.temperature,
            topP: this.params.config.topP,
        };

        // TODO: add below after test
        // if (requestType === 'commit') {
        //     generationConfig = {
        //         ...generationConfig,
        //         responseSchema: {
        //             type: SchemaType.ARRAY,
        //             items: {
        //                 type: SchemaType.OBJECT,
        //                 properties: {
        //                     subject: {
        //                         type: SchemaType.STRING,
        //                         nullable: false,
        //                         format: "enum",
        //                         enum: ["no sleeves", "short", "3/4", "long"]
        //                     },
        //                     body: {
        //                         type: SchemaType.STRING,
        //                         nullable: !this.params.config.includeBody,
        //                         format: "enum",
        //                         enum: ["no sleeves", "short", "3/4", "long"]
        //                     },
        //                     footer: {
        //                         type: SchemaType.STRING,
        //                         nullable: true,
        //                         format: "enum",
        //                         enum: ["no sleeves", "short", "3/4", "long"]
        //                     }
        //                 },
        //                 required: ["subject"],
        //             },
        //         }
        //     }
        // }

        const model = this.genAI.getGenerativeModel({
            model: this.params.config.model,
            systemInstruction: generatedSystemPrompt,
            generationConfig,
            safetySettings: [
                {
                    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                },
                {
                    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                },
            ],
        });

        const userPrompt = generateUserPrompt(diff, requestType);

        // 상세 로깅 (config URL 사용)
        const baseUrl = this.params.config.url || 'https://generativelanguage.googleapis.com';
        const url = `${baseUrl}/v1beta/models/${this.params.config.model}:generateContent`;
        const headers = {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.params.config.key,
        };

        logAIRequest(diff, requestType, 'Gemini', this.params.config.model, url, headers, logging);
        logAIPrompt(diff, requestType, 'Gemini', generatedSystemPrompt, userPrompt, logging);

        const requestPayload = {
            systemInstruction: { parts: [{ text: generatedSystemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig,
        };

        logAIPayload(diff, requestType, 'Gemini', requestPayload, logging);

        const startTime = Date.now();

        try {
            const generateOptions = this.params.config.timeout > 10000 ? { request: { timeout: this.params.config.timeout } } : undefined;

            const result = await model.generateContent(userPrompt, generateOptions);
            const response = result.response;

            // Check if response was truncated due to token limit
            const candidate = response.candidates?.[0];
            if (candidate?.finishReason === 'MAX_TOKENS') {
                const usage = response.usageMetadata as { thoughtsTokenCount?: number; candidatesTokenCount?: number } | undefined;
                throw new Error(
                    `Response truncated: maxOutputTokens exceeded. ` +
                        `Thinking tokens: ${usage?.thoughtsTokenCount ?? 'N/A'}, ` +
                        `Output tokens: ${usage?.candidatesTokenCount ?? 'N/A'}. ` +
                        `Increase maxTokens config for Gemini 2.5+ thinking models.`
                );
            }

            const completion = response.text();
            const duration = Date.now() - startTime;

            // 응답 로깅
            logAIResponse(
                diff,
                requestType,
                'Gemini',
                {
                    response: completion,
                    candidates: result.response.candidates,
                    usageMetadata: result.response.usageMetadata,
                },
                logging
            );

            // 완료 로깅
            logAIComplete(diff, requestType, 'Gemini', duration, completion, logging);

            if (requestType === 'review') {
                return this.sanitizeResponse(completion);
            }
            return this.parseMessage(completion, type, generate);
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, 'Gemini', error, logging);
            throw error;
        }
    }
}
