import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, from, mergeMap, switchMap } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { ProviderRegistry, createErrorChoice, withProviderMetadata } from '../services/ai/provider-registry.js';
import { ModelName, ValidConfig } from '../utils/config.js';
import { DiffCompressionConfig } from '../utils/diff-compressor.js';
import { GitDiff, applyDiffCompression } from '../utils/vcs.js';

export class AIRequestManager {
    constructor(
        private readonly config: ValidConfig,
        private readonly stagedDiff: GitDiff,
        private readonly branchName: string = ''
    ) {}

    /**
     * Apply per-model diff compression based on model config.
     * Falls back to raw diff if model has no compression settings.
     */
    private getDiffForModel = (modelConfig: ValidConfig[ModelName]): GitDiff => {
        const compressionConfig: DiffCompressionConfig = {
            mode: modelConfig.diffCompression || 'none',
            maxHunkLines: modelConfig.maxHunkLines || 0,
            maxDiffLines: modelConfig.maxDiffLines || 0,
        };
        return applyDiffCompression(this.stagedDiff, compressionConfig);
    };

    /**
     * Safely extract hostname from URL, returning fallback on invalid URLs
     */
    private extractProviderName = (url: string | undefined): string => {
        if (!url) {
            return 'compatible';
        }
        try {
            return new URL(url).hostname;
        } catch {
            return 'compatible';
        }
    };

    createCommitMsgRequests$ = (modelNames: ModelName[]): Observable<ReactiveListChoice> => {
        return this.createServiceRequests$(modelNames, 'commit');
    };

    createCodeReviewRequests$ = (modelNames: ModelName[]): Observable<ReactiveListChoice> => {
        return this.createServiceRequests$(modelNames, 'review');
    };

    private createServiceRequests$ = (modelNames: ModelName[], requestType: 'commit' | 'review'): Observable<ReactiveListChoice> => {
        return from(modelNames).pipe(
            mergeMap(ai => this.createProviderRequests$(ai, requestType)),
            catchError(err => createErrorChoice('UNKNOWN', err.message || 'Unknown error'))
        );
    };

    private createProviderRequests$ = (ai: ModelName, requestType: 'commit' | 'review'): Observable<ReactiveListChoice> => {
        const config = this.config[ai];
        const models = Array.isArray(config.model) ? config.model : [config.model];

        return from(models).pipe(mergeMap(model => this.createModelRequest$(ai, model, requestType)));
    };

    private createModelRequest$ = (ai: ModelName, model: string, requestType: 'commit' | 'review'): Observable<ReactiveListChoice> => {
        const config = this.config[ai];

        // Handle OpenAI-compatible services
        if (config.compatible) {
            return this.createCompatibleServiceRequest$(config, model, requestType);
        }

        // Use Provider Registry for built-in providers
        const modelDiff = this.getDiffForModel(config);
        return ProviderRegistry.createRequest$(
            ai,
            {
                config: { ...config, model },
                stagedDiff: modelDiff,
                keyName: model as ModelName,
                branchName: this.branchName,
                statsEnabled: this.config.useStats,
                statsDays: this.config.statsDays,
            },
            requestType
        );
    };

    private createCompatibleServiceRequest$ = (
        config: ValidConfig[ModelName],
        model: string,
        requestType: 'commit' | 'review'
    ): Observable<ReactiveListChoice> => {
        const startTime = Date.now();
        const providerName = this.extractProviderName(config.url);

        // Lazy-load OpenAICompatibleService to avoid importing openai SDK at startup
        const modelDiff = this.getDiffForModel(config);
        return from(import('../services/ai/openai-compatible.service.js')).pipe(
            switchMap(({ OpenAICompatibleService }) => {
                const service = AIServiceFactory.create(OpenAICompatibleService, {
                    config: {
                        ...config,
                        url: config.url || '',
                        path: config.path || '',
                        model,
                    },
                    stagedDiff: modelDiff,
                    keyName: model as ModelName,
                    branchName: this.branchName,
                });

                const request$ = requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();

                return request$.pipe(
                    withProviderMetadata({
                        provider: providerName,
                        model,
                        startTime,
                        statsEnabled: this.config.useStats,
                        statsDays: this.config.statsDays,
                    })
                );
            })
        );
    };
}
