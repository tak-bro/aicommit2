import { GenerationConfig, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType } from '../../utils/ai-log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';

export class GeminiService extends AIService {
    private genAI: GoogleGenerativeAI;

    constructor(private readonly params: AIServiceParams) {
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

        const aiRequest = async () => {
            const result = await model.generateContent(generateUserPrompt(diff, requestType));
            const response = result.response;
            return response.text();
        };

        const completion = await this.executeWithLogging(aiRequest, generatedSystemPrompt, requestType);

        // 레거시 로깅 지원 - 새로운 로깅 시스템에서 자동 처리됨
        // if (logging && !this.logSessionId) {
        //     createLogResponse('Gemini', diff, generatedSystemPrompt, completion, requestType);
        // }
        if (requestType === 'review') {
            return this.sanitizeResponse(completion);
        }
        return this.parseMessage(completion, type, generate);
    }
}
