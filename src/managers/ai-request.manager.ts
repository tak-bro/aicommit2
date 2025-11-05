import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, from, mergeMap, of } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { AnthropicService } from '../services/ai/anthropic.service.js';
import { BedrockService } from '../services/ai/bedrock.service.js';
import { CodestralService } from '../services/ai/codestral.service.js';
import { CohereService } from '../services/ai/cohere.service.js';
import { DeepSeekService } from '../services/ai/deep-seek.service.js';
import { GeminiService } from '../services/ai/gemini.service.js';
import { GitHubModelsService } from '../services/ai/github-models.service.js';
import { GroqService } from '../services/ai/groq.service.js';
import { HuggingFaceService } from '../services/ai/hugging-face.service.js';
import { MistralService } from '../services/ai/mistral.service.js';
import { OllamaService } from '../services/ai/ollama.service.js';
import { OpenAICompatibleService } from '../services/ai/openai-compatible.service.js';
import { OpenAIService } from '../services/ai/openai.service.js';
import { PerplexityService } from '../services/ai/perplexity.service.js';
import { ModelName, ValidConfig } from '../utils/config.js';
import { GitDiff } from '../utils/vcs.js';

export class AIRequestManager {
    constructor(
        private readonly config: ValidConfig,
        private readonly stagedDiff: GitDiff
    ) {}

    createCommitMsgRequests$(modelNames: ModelName[]): Observable<ReactiveListChoice> {
        return this.createServiceRequests$(modelNames, 'commit');
    }

    createCodeReviewRequests$(modelNames: ModelName[]): Observable<ReactiveListChoice> {
        return this.createServiceRequests$(modelNames, 'review');
    }

    private createServiceRequests$(modelNames: ModelName[], requestType: 'commit' | 'review'): Observable<ReactiveListChoice> {
        return from(modelNames).pipe(
            mergeMap(ai => {
                const config = this.config[ai];
                const models = Array.isArray(config.model) ? config.model : [config.model];

                return from(models).pipe(
                    mergeMap(model => {
                        if (config.compatible) {
                            const service = AIServiceFactory.create(OpenAICompatibleService, {
                                config: {
                                    ...config,
                                    url: config.url || '',
                                    path: config.path || '',
                                    model: model,
                                },
                                stagedDiff: this.stagedDiff,
                                keyName: model as ModelName,
                            });
                            return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                        }

                        switch (ai) {
                            case 'OPENAI': {
                                const service = AIServiceFactory.create(OpenAIService, {
                                    config: { ...this.config.OPENAI, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'GEMINI': {
                                const service = AIServiceFactory.create(GeminiService, {
                                    config: { ...this.config.GEMINI, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'ANTHROPIC': {
                                const service = AIServiceFactory.create(AnthropicService, {
                                    config: { ...this.config.ANTHROPIC, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'HUGGINGFACE': {
                                const service = AIServiceFactory.create(HuggingFaceService, {
                                    config: { ...this.config.HUGGINGFACE, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'MISTRAL': {
                                const service = AIServiceFactory.create(MistralService, {
                                    config: { ...this.config.MISTRAL, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'CODESTRAL': {
                                const service = AIServiceFactory.create(CodestralService, {
                                    config: { ...this.config.CODESTRAL, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'OLLAMA': {
                                const service = AIServiceFactory.create(OllamaService, {
                                    config: { ...this.config.OLLAMA, model: model },
                                    keyName: model as ModelName,
                                    stagedDiff: this.stagedDiff,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'COHERE': {
                                const service = AIServiceFactory.create(CohereService, {
                                    config: { ...this.config.COHERE, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'GROQ': {
                                const service = AIServiceFactory.create(GroqService, {
                                    config: { ...this.config.GROQ, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'PERPLEXITY': {
                                const service = AIServiceFactory.create(PerplexityService, {
                                    config: { ...this.config.PERPLEXITY, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'BEDROCK': {
                                const service = AIServiceFactory.create(BedrockService, {
                                    config: { ...this.config.BEDROCK, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'GITHUB_MODELS': {
                                const service = AIServiceFactory.create(GitHubModelsService, {
                                    config: { ...this.config.GITHUB_MODELS, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
                            case 'DEEPSEEK': {
                                const service = AIServiceFactory.create(DeepSeekService, {
                                    config: { ...this.config.DEEPSEEK, model: model },
                                    stagedDiff: this.stagedDiff,
                                    keyName: model as ModelName,
                                });
                                return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
                            }
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
