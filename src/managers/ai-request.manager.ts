import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, from, mergeMap, of } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { AnthropicService } from '../services/ai/anthropic.service.js';
import { CodestralService } from '../services/ai/codestral.service.js';
import { CohereService } from '../services/ai/cohere.service.js';
import { CopilotService } from '../services/ai/copilot.service.js';
import { DeepSeekService } from '../services/ai/deep-seek.service.js';
import { GeminiService } from '../services/ai/gemini.service.js';
import { GroqService } from '../services/ai/groq.service.js';
import { HuggingFaceService } from '../services/ai/hugging-face.service.js';
import { MistralService } from '../services/ai/mistral.service.js';
import { OllamaService } from '../services/ai/ollama.service.js';
import { OpenAICompatibleService } from '../services/ai/openai-compatible.service.js';
import { OpenAIService } from '../services/ai/openai.service.js';
import { PerplexityService } from '../services/ai/perplexity.service.js';
import { ModelName, ValidConfig } from '../utils/config.js';
import { GitDiff } from '../utils/git.js';

export class AIRequestManager {
    constructor(
        private readonly config: ValidConfig,
        private readonly stagedDiff: GitDiff
    ) {}

    createCommitMsgRequests$(modelNames: ModelName[]): Observable<ReactiveListChoice> {
        return from(modelNames).pipe(
            mergeMap(ai => {
                const config = this.config[ai];
                const models = Array.isArray(config.model) ? config.model : [config.model]; // Ensure models is always an array

                return from(models).pipe(
                    // Iterate over the models for this service
                    mergeMap(model => {
                        // Now create the service instance for the specific model
                        if (config.compatible) {
                            return AIServiceFactory.create(OpenAICompatibleService, {
                                config: {
                                    ...config,
                                    url: config.url || '',
                                    path: config.path || '',
                                    model: model, // Pass the single model name to the service
                                },
                                stagedDiff: this.stagedDiff,
                                keyName: model as ModelName, // Use the model name as keyName
                            }).generateCommitMessage$();
                        }

                        switch (ai) {
                            case 'OPENAI':
                                return AIServiceFactory.create(OpenAIService, {
                                    config: { ...this.config.OPENAI, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'GEMINI':
                                return AIServiceFactory.create(GeminiService, {
                                    config: { ...this.config.GEMINI, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'ANTHROPIC':
                                return AIServiceFactory.create(AnthropicService, {
                                    config: { ...this.config.ANTHROPIC, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'HUGGINGFACE':
                                return AIServiceFactory.create(HuggingFaceService, {
                                    config: { ...this.config.HUGGINGFACE, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'MISTRAL':
                                return AIServiceFactory.create(MistralService, {
                                    config: { ...this.config.MISTRAL, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'CODESTRAL':
                                return AIServiceFactory.create(CodestralService, {
                                    config: { ...this.config.CODESTRAL, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'OLLAMA':
                                return AIServiceFactory.create(OllamaService, {
                                    config: { ...this.config.OLLAMA, model: model }, // Pass the single model name
                                    keyName: model as ModelName, // Use the model name as keyName
                                    stagedDiff: this.stagedDiff,
                                }).generateCommitMessage$();
                            case 'COHERE':
                                return AIServiceFactory.create(CohereService, {
                                    config: { ...this.config.COHERE, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'GROQ':
                                return AIServiceFactory.create(GroqService, {
                                    config: { ...this.config.GROQ, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'PERPLEXITY':
                                return AIServiceFactory.create(PerplexityService, {
                                    config: { ...this.config.PERPLEXITY, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'COPILOT':
                                return AIServiceFactory.create(CopilotService, {
                                    config: { ...this.config.COPILOT, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            case 'DEEPSEEK':
                                return AIServiceFactory.create(DeepSeekService, {
                                    config: { ...this.config.DEEPSEEK, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCommitMessage$();
                            default:
                                const prefixError = chalk.red.bold(`[${ai}]`);
                                return of({
                                    name: prefixError + ' Invalid AI type',
                                    value: 'Invalid AI type',
                                    isError: true,
                                    disabled: true,
                                });
                        }
                    })
                );
            }),
            catchError(err => {
                const prefixError = chalk.red.bold(`[UNKNOWN]`);
                return of({
                    name: prefixError + ` ${err.message || ''}`,
                    value: 'Unknown error',
                    isError: true,
                    disabled: true,
                });
            })
        );
    }

    createCodeReviewRequests$(modelNames: ModelName[]): Observable<ReactiveListChoice> {
        return from(modelNames).pipe(
            mergeMap(ai => {
                const config = this.config[ai];
                const models = Array.isArray(config.model) ? config.model : [config.model]; // Ensure models is always an array

                return from(models).pipe(
                    // Iterate over the models for this service
                    mergeMap(model => {
                        // Now create the service instance for the specific model
                        if (config.compatible) {
                            return AIServiceFactory.create(OpenAICompatibleService, {
                                config: {
                                    ...config,
                                    url: config.url || '',
                                    path: config.path || '',
                                    model: model, // Pass the single model name to the service
                                },
                                stagedDiff: this.stagedDiff,
                                keyName: model as ModelName, // Use the model name as keyName
                            }).generateCodeReview$();
                        }

                        switch (ai) {
                            case 'OPENAI':
                                return AIServiceFactory.create(OpenAIService, {
                                    config: { ...this.config.OPENAI, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'GEMINI':
                                return AIServiceFactory.create(GeminiService, {
                                    config: { ...this.config.GEMINI, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'ANTHROPIC':
                                return AIServiceFactory.create(AnthropicService, {
                                    config: { ...this.config.ANTHROPIC, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'HUGGINGFACE':
                                return AIServiceFactory.create(HuggingFaceService, {
                                    config: { ...this.config.HUGGINGFACE, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'MISTRAL':
                                return AIServiceFactory.create(MistralService, {
                                    config: { ...this.config.MISTRAL, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'CODESTRAL':
                                return AIServiceFactory.create(CodestralService, {
                                    config: { ...this.config.CODESTRAL, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'OLLAMA':
                                return AIServiceFactory.create(OllamaService, {
                                    config: { ...this.config.OLLAMA, model: model }, // Pass the single model name
                                    keyName: model as ModelName, // Use the model name as keyName
                                    stagedDiff: this.stagedDiff,
                                }).generateCodeReview$();
                            case 'COHERE':
                                return AIServiceFactory.create(CohereService, {
                                    config: { ...this.config.COHERE, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'GROQ':
                                return AIServiceFactory.create(GroqService, {
                                    config: { ...this.config.GROQ, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'PERPLEXITY':
                                return AIServiceFactory.create(PerplexityService, {
                                    config: { ...this.config.PERPLEXITY, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'COPILOT':
                                return AIServiceFactory.create(CopilotService, {
                                    config: { ...this.config.COPILOT, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            case 'DEEPSEEK':
                                return AIServiceFactory.create(DeepSeekService, {
                                    config: { ...this.config.DEEPSEEK, model: model }, // Pass the single model name
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName, // Use the model name as keyName
                                }).generateCodeReview$();
                            default:
                                const prefixError = chalk.red.bold(`[${ai}]`);
                                return of({
                                    name: prefixError + ' Invalid AI type',
                                    value: 'Invalid AI type',
                                    isError: true,
                                    disabled: true,
                                });
                        }
                    })
                );
            }),
            catchError(err => {
                const prefixError = chalk.red.bold(`[UNKNOWN]`);
                return of({
                    name: prefixError + ` ${err.message || ''}`,
                    value: 'Unknown error',
                    isError: true,
                    disabled: true,
                });
            })
        );
    }
}
