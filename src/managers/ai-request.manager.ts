import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, from, mergeMap, tap } from 'rxjs';

import { AIServiceFactory } from '../services/ai/ai-service.factory.js';
import { OpenAICompatibleService } from '../services/ai/openai-compatible.service.js';
import { ProviderRegistry, createErrorChoice } from '../services/ai/provider-registry.js';
import { recordMetric } from '../services/stats/index.js';
import { ModelName, ValidConfig } from '../utils/config.js';
import { GitDiff } from '../utils/vcs.js';

export class AIRequestManager {
    constructor(
        private readonly config: ValidConfig,
        private readonly stagedDiff: GitDiff,
        private readonly branchName: string = ''
    ) {}

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
        return ProviderRegistry.createRequest$(
            ai,
            {
                config: { ...config, model },
                stagedDiff: this.stagedDiff,
                keyName: model as ModelName,
                branchName: this.branchName,
            },
            requestType
        );
    };

    private createCompatibleServiceRequest$ = (
        // Config type is inferred from ValidConfig[ModelName]
        config: ValidConfig[ModelName],
        model: string,
        requestType: 'commit' | 'review'
    ): Observable<ReactiveListChoice> => {
        const service = AIServiceFactory.create(OpenAICompatibleService, {
            config: {
                ...config,
                url: config.url || '',
                path: config.path || '',
                model,
            },
            stagedDiff: this.stagedDiff,
            keyName: model as ModelName,
            branchName: this.branchName,
        });

        const startTime = Date.now();
        const providerName = this.extractProviderName(config.url);
        let metricRecorded = false;

        const request$ = requestType === 'commit' ? service.generateCommitMessage$() : service.generateCodeReview$();

        return request$.pipe(
            tap({
                next: choice => {
                    // Attach provider metadata to the choice for selection tracking
                    (choice as ReactiveListChoice & { provider?: string; model?: string }).provider = providerName;
                    (choice as ReactiveListChoice & { provider?: string; model?: string }).model = model;

                    // Record metric only once per request (first emission)
                    if (metricRecorded) {
                        return;
                    }
                    metricRecorded = true;

                    const isError = choice.isError === true;
                    recordMetric({
                        provider: providerName,
                        model,
                        responseTimeMs: Date.now() - startTime,
                        success: !isError,
                        errorCode: isError ? 'REQUEST_ERROR' : undefined,
                    }).catch(() => {
                        // Silently ignore metric recording errors
                    });
                },
            })
        );
    };
}
