import { GenerationConfig, GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';
import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map, of } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { KnownError } from '../../utils/error.js';
import { RequestType, createLogResponse } from '../../utils/log.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt } from '../../utils/prompt.js';

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
        try {
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

            const result = await model.generateContent(`Here is the diff: ${diff}`);
            const response = result.response;
            const completion = response.text();

            logging && createLogResponse('Gemini', diff, generatedSystemPrompt, completion, requestType);
            if (requestType === 'review') {
                return this.sanitizeResponse(completion);
            }
            return this.parseMessage(completion, type, generate);
        } catch (error) {
            const errorAsAny = error as any;
            if (errorAsAny.code === 'ENOTFOUND') {
                throw new KnownError(`Error connecting to ${errorAsAny.hostname} (${errorAsAny.syscall})`);
            }
            throw errorAsAny;
        }
    }

    handleError$ = (geminiError: AIServiceError) => {
        const geminiErrorMessage = geminiError.message || geminiError.toString();
        const regex = /(\[.*?\]\s*[^[]*)/g;
        const matches = [...geminiErrorMessage.matchAll(regex)];
        const result: string[] = [];
        matches.forEach(match => result.push(match[1]));

        const message = result[1] || 'An error occurred';
        return of({
            name: `${this.errorPrefix} ${message}`,
            value: message,
            isError: true,
            disabled: true,
        });
    };
}
