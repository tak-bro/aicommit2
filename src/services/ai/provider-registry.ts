import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { MonoTypeOperatorFunction, Observable, from, of, switchMap, tap } from 'rxjs';

import { AIService, AIServiceParams } from './ai.service.js';
import { ModelName } from '../../utils/config.js';
import { RecordMetricOptions, recordMetric } from '../stats/index.js';

/**
 * Create an error choice Observable for display in the reactive list
 */
export const createErrorChoice = (prefix: string, message: string): Observable<ReactiveListChoice> => {
    const prefixError = chalk.red.bold(`[${prefix}]`);
    return of({
        name: `${prefixError} ${message}`,
        value: message,
        isError: true,
        disabled: true,
    });
};

/**
 * Options for the withProviderMetadata RxJS operator
 */
interface ProviderMetadataOptions {
    provider: string;
    model: string;
    startTime: number;
    statsEnabled?: boolean;
    statsDays?: number;
}

/**
 * Shared RxJS operator that attaches provider metadata and records metrics.
 * Used by both ProviderRegistry and AIRequestManager to avoid duplication.
 */
export const withProviderMetadata = (opts: ProviderMetadataOptions): MonoTypeOperatorFunction<ReactiveListChoice> => {
    let metricRecorded = false;

    return tap({
        next: choice => {
            // Attach provider metadata to the choice for selection tracking
            Object.assign(choice, { provider: opts.provider, model: opts.model });

            // Skip metric recording if stats is disabled (enabled by default)
            if (opts.statsEnabled === false) {
                return;
            }

            // Record metric only once per request (first emission)
            if (metricRecorded) {
                return;
            }
            metricRecorded = true;

            const isError = choice.isError === true;
            const metricOpts: RecordMetricOptions = {
                provider: opts.provider,
                model: opts.model,
                responseTimeMs: Date.now() - opts.startTime,
                success: !isError,
                errorCode: isError ? 'REQUEST_ERROR' : undefined,
                statsDays: opts.statsDays,
            };
            recordMetric(metricOpts).catch(() => {
                // Silently ignore metric recording errors
            });
        },
    });
};

/**
 * Service constructor type for the registry
 */
type AIServiceConstructor = new (params: AIServiceParams) => AIService;

/**
 * Lazy loader that resolves to a service constructor on first use
 */
type LazyServiceLoader = () => Promise<AIServiceConstructor>;

/**
 * Provider Registry - manages AI service providers with lazy-loading
 * SDKs are only imported when a provider is actually used
 */
class ProviderRegistryClass {
    private readonly loaders = new Map<string, LazyServiceLoader>();
    private readonly cache = new Map<string, AIServiceConstructor>();

    constructor() {
        this.registerBuiltinProviders();
    }

    /**
     * Load and cache a service constructor
     */
    private loadService = async (name: string): Promise<AIServiceConstructor | null> => {
        const cached = this.cache.get(name);
        if (cached) {
            return cached;
        }

        const loader = this.loaders.get(name);
        if (!loader) {
            return null;
        }

        const ServiceClass = await loader();
        this.cache.set(name, ServiceClass);
        return ServiceClass;
    };

    /**
     * Create a service instance for the given provider (async - loads SDK on demand)
     */
    createService = async (name: ModelName, params: AIServiceParams): Promise<AIService | null> => {
        const ServiceClass = await this.loadService(name);
        if (!ServiceClass) {
            return null;
        }
        return new ServiceClass(params);
    };

    /**
     * Create Observable for service request (commit or review)
     * Wraps the request with metric recording and provider metadata
     */
    createRequest$ = (name: ModelName, params: AIServiceParams, requestType: 'commit' | 'review'): Observable<ReactiveListChoice> => {
        const startTime = Date.now();
        const model = Array.isArray(params.config.model) ? params.config.model[0] : params.config.model;

        return from(this.createService(name, params)).pipe(
            switchMap(service => {
                if (!service) {
                    return createErrorChoice(name, 'Invalid AI type');
                }

                const request$ = requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();

                return request$.pipe(
                    withProviderMetadata({
                        provider: name,
                        model: model || 'unknown',
                        startTime,
                        statsEnabled: params.statsEnabled,
                        statsDays: params.statsDays,
                    })
                );
            })
        );
    };

    /**
     * Register all built-in providers with lazy-loading
     * SDKs are only imported when the provider is first used
     */
    private registerBuiltinProviders = (): void => {
        this.loaders.set('OPENAI', () => import('./openai.service.js').then(m => m.OpenAIService));
        this.loaders.set('GEMINI', () => import('./gemini.service.js').then(m => m.GeminiService));
        this.loaders.set('ANTHROPIC', () => import('./anthropic.service.js').then(m => m.AnthropicService));
        this.loaders.set('HUGGINGFACE', () => import('./hugging-face.service.js').then(m => m.HuggingFaceService));
        this.loaders.set('MISTRAL', () => import('./mistral.service.js').then(m => m.MistralService));
        this.loaders.set('CODESTRAL', () => import('./codestral.service.js').then(m => m.CodestralService));
        this.loaders.set('OLLAMA', () => import('./ollama.service.js').then(m => m.OllamaService));
        this.loaders.set('COHERE', () => import('./cohere.service.js').then(m => m.CohereService));
        this.loaders.set('GROQ', () => import('./groq.service.js').then(m => m.GroqService));
        this.loaders.set('PERPLEXITY', () => import('./perplexity.service.js').then(m => m.PerplexityService));
        this.loaders.set('BEDROCK', () => import('./bedrock.service.js').then(m => m.BedrockService));
        this.loaders.set('GITHUB_MODELS', () => import('./github-models.service.js').then(m => m.GitHubModelsService));
        this.loaders.set('DEEPSEEK', () => import('./deep-seek.service.js').then(m => m.DeepSeekService));
    };
}

/**
 * Singleton instance of the Provider Registry
 */
export const ProviderRegistry = new ProviderRegistryClass();
