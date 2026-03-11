import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, of } from 'rxjs';

import { AIService, AIServiceParams } from './ai.service.js';
import { AnthropicService } from './anthropic.service.js';
import { BedrockService } from './bedrock.service.js';
import { CodestralService } from './codestral.service.js';
import { CohereService } from './cohere.service.js';
import { DeepSeekService } from './deep-seek.service.js';
import { GeminiService } from './gemini.service.js';
import { GitHubModelsService } from './github-models.service.js';
import { GroqService } from './groq.service.js';
import { HuggingFaceService } from './hugging-face.service.js';
import { MistralService } from './mistral.service.js';
import { OllamaService } from './ollama.service.js';
import { OpenAIService } from './openai.service.js';
import { PerplexityService } from './perplexity.service.js';
import { ModelName } from '../../utils/config.js';

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
 * Service constructor type for the registry
 */
type AIServiceConstructor = new (params: AIServiceParams) => AIService;

/**
 * Provider Registry - manages AI service providers dynamically
 * Replaces the giant switch statement with Open/Closed principle compliance
 */
class ProviderRegistryClass {
    private readonly providers = new Map<string, AIServiceConstructor>();

    constructor() {
        this.registerBuiltinProviders();
    }

    /**
     * Register a new AI service provider
     */
    register = (name: string, service: AIServiceConstructor): void => {
        this.providers.set(name, service);
    };

    /**
     * Check if a provider is registered
     */
    has = (name: string): boolean => {
        return this.providers.has(name);
    };

    /**
     * Create a service instance for the given provider
     */
    createService = (name: ModelName, params: AIServiceParams): AIService | null => {
        const ServiceClass = this.providers.get(name);
        if (!ServiceClass) {
            return null;
        }
        return new ServiceClass(params);
    };

    /**
     * Create Observable for service request (commit or review)
     */
    createRequest$ = (name: ModelName, params: AIServiceParams, requestType: 'commit' | 'review'): Observable<ReactiveListChoice> => {
        const service = this.createService(name, params);

        if (!service) {
            return createErrorChoice(name, 'Invalid AI type');
        }

        return requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();
    };

    /**
     * Get all registered provider names
     */
    getRegisteredProviders = (): string[] => {
        return Array.from(this.providers.keys());
    };

    /**
     * Register all built-in providers
     */
    private registerBuiltinProviders = (): void => {
        this.register('OPENAI', OpenAIService);
        this.register('GEMINI', GeminiService);
        this.register('ANTHROPIC', AnthropicService);
        this.register('HUGGINGFACE', HuggingFaceService);
        this.register('MISTRAL', MistralService);
        this.register('CODESTRAL', CodestralService);
        this.register('OLLAMA', OllamaService);
        this.register('COHERE', CohereService);
        this.register('GROQ', GroqService);
        this.register('PERPLEXITY', PerplexityService);
        this.register('BEDROCK', BedrockService);
        this.register('GITHUB_MODELS', GitHubModelsService);
        this.register('DEEPSEEK', DeepSeekService);
    };
}

/**
 * Singleton instance of the Provider Registry
 */
export const ProviderRegistry = new ProviderRegistryClass();
