import https from 'https';

import chalk from 'chalk';
import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { Observable, catchError, concatMap, from, map } from 'rxjs';
import { fromPromise } from 'rxjs/internal/observable/innerFrom';

import { AIResponse, AIService, AIServiceError, AIServiceParams } from './ai.service.js';
import { RequestType, logAIComplete, logAIError, logAIPayload, logAIPrompt, logAIRequest, logAIResponse } from '../../utils/ai-log.js';
import { ModelConfig } from '../../utils/config.js';
import { DEFAULT_PROMPT_OPTIONS, PromptOptions, codeReviewPrompt, generatePrompt, generateUserPrompt } from '../../utils/prompt.js';
import { safeJsonParse } from '../../utils/utils.js';

const SERVICE_NAME = 'Bedrock';

const ERROR_NAMES = {
    MISSING_DEPENDENCY: 'MissingDependencyError',
    MISSING_REGION: 'MissingRegionError',
    MISSING_MODEL_ID: 'MissingModelIdError',
    MISSING_APPLICATION_KEY: 'MissingApplicationKeyError',
    INVALID_RESPONSE: 'InvalidResponseError',
    EMPTY_RESPONSE: 'EmptyResponseError',
} as const;

const isNonEmptyString = (value?: string): value is string => typeof value === 'string' && value.length > 0;

type RuntimeMode = 'foundation' | 'application';

// Type-safe config interface derived from the config parsers
type BedrockConfig = ModelConfig<'BEDROCK'> & {
    model: string; // Single model for the current invocation
};

type AwsCredentialIdentity = {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
};

type AwsCredentialIdentityProvider = () => Promise<AwsCredentialIdentity>;

// Type definitions for lazily-loaded AWS SDK modules
type BedrockRuntimeModule = {
    BedrockRuntimeClient: any;
    ConverseCommand: any;
};

type CredentialProvidersModule = {
    fromIni: (options: { profile?: string }) => AwsCredentialIdentityProvider;
};

// Module-level cache for lazily-loaded AWS SDK modules to avoid repeated dynamic imports
let bedrockRuntimeModule: BedrockRuntimeModule | null = null;
let credentialProvidersModule: CredentialProvidersModule | null = null;

const createMissingDependencyError = (originalError: unknown): AIServiceError => {
    const error: AIServiceError = new Error(
        'Amazon Bedrock support requires "@aws-sdk/client-bedrock-runtime" and "@aws-sdk/credential-providers". Install them with `pnpm add @aws-sdk/client-bedrock-runtime @aws-sdk/credential-providers`.'
    );
    error.name = ERROR_NAMES.MISSING_DEPENDENCY;
    error.originalError = originalError;
    return error;
};

const loadBedrockRuntimeModule = async (): Promise<BedrockRuntimeModule> => {
    if (bedrockRuntimeModule) {
        return bedrockRuntimeModule;
    }

    try {
        const module = await import('@aws-sdk/client-bedrock-runtime');
        bedrockRuntimeModule = module as BedrockRuntimeModule;
        return bedrockRuntimeModule;
    } catch (error) {
        bedrockRuntimeModule = null;
        throw createMissingDependencyError(error);
    }
};

const loadCredentialProvidersModule = async (): Promise<CredentialProvidersModule> => {
    if (credentialProvidersModule) {
        return credentialProvidersModule;
    }

    try {
        const module = await import('@aws-sdk/credential-providers');
        credentialProvidersModule = module as CredentialProvidersModule;
        return credentialProvidersModule;
    } catch (error) {
        credentialProvidersModule = null;
        throw createMissingDependencyError(error);
    }
};

export class BedrockService extends AIService {
    private readonly bedrockConfig: BedrockConfig;
    private credentialCache: AwsCredentialIdentity | AwsCredentialIdentityProvider | undefined = undefined;
    private credentialCacheTimestamp: number = 0;
    private readonly CREDENTIAL_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    constructor(protected readonly params: AIServiceParams) {
        super(params);
        this.bedrockConfig = this.params.config as BedrockConfig;
        this.colors = {
            primary: '#232F3E',
            secondary: '#FF9900',
        };
        this.serviceName = chalk.bgHex(this.colors.primary).hex(this.colors.secondary).bold(`[${SERVICE_NAME}]`);
        this.errorPrefix = chalk.red.bold(`[${SERVICE_NAME}]`);

        // Validate configuration early to fail fast
        this.validateConfiguration();
    }

    private validateConfiguration(): void {
        const config = this.bedrockConfig;
        const runtimeMode = config.runtimeMode as RuntimeMode;

        // Validate application mode has an API key
        if (runtimeMode === 'application' && !isNonEmptyString(config.key)) {
            const error: AIServiceError = new Error(
                'Application mode requires a Bedrock API key. Set BEDROCK.key or BEDROCK_APPLICATION_API_KEY environment variable.'
            );
            error.name = ERROR_NAMES.MISSING_APPLICATION_KEY;
            throw error;
        }

        // Validate region is set (required for both modes)
        if (!this.getRegion()) {
            const error: AIServiceError = new Error(
                'AWS region is required to use Bedrock. Configure BEDROCK.region or set AWS_REGION/AWS_DEFAULT_REGION.'
            );
            error.name = ERROR_NAMES.MISSING_REGION;
            throw error;
        }

        // Validate model ID is set
        if (!isNonEmptyString(config.model)) {
            const error: AIServiceError = new Error('Model ID or inference profile ARN is required.');
            error.name = ERROR_NAMES.MISSING_MODEL_ID;
            throw error;
        }
    }

    protected getServiceSpecificErrorMessage(error: AIServiceError): string | null {
        const code = (error as any)?.name || error.code;
        const message = error.message || '';

        switch (code) {
            case 'UnrecognizedClientException':
            case 'InvalidSignatureException':
                return 'Authentication with AWS failed. Check your IAM credentials or Bedrock API key settings.';
            case 'AccessDeniedException':
                return 'Access denied. Ensure the IAM principal or application key has permission to invoke the Bedrock resource.';
            case 'ValidationException':
                return 'Invalid request for the selected Bedrock model. Verify the model ID and payload.';
            case 'ResourceNotFoundException':
                return 'The specified Bedrock model, endpoint, or inference profile could not be found.';
            case 'ThrottlingException':
                return 'Request throttled by Bedrock. Reduce request rate or check service quotas.';
            default:
                break;
        }

        if (message.includes('Region')) {
            return 'AWS region is required for Bedrock. Configure BEDROCK.region or set AWS_REGION/AWS_DEFAULT_REGION.';
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
        const config = this.bedrockConfig;
        const model = config.model;
        const { logging, temperature, topP, maxTokens } = config;

        const promptOptions: PromptOptions = {
            ...DEFAULT_PROMPT_OPTIONS,
            locale: config.locale,
            maxLength: config.maxLength,
            type: config.type,
            generate: config.generate,
            systemPrompt: config.systemPrompt,
            systemPromptPath: config.systemPromptPath,
            codeReviewPromptPath: config.codeReviewPromptPath,
        };

        const generatedSystemPrompt = requestType === 'review' ? codeReviewPrompt(promptOptions) : generatePrompt(promptOptions);
        const userPrompt = generateUserPrompt(diff, requestType);

        // SECURITY: Ensure credentials are never logged - only configuration metadata
        const loggingHeaders: Record<string, unknown> = {
            region: this.getRegion(),
            profile: config.profile,
            modelId: model,
        };

        const loggingUrl = `https://bedrock-runtime.${this.getRegion() || 'unknown'}.amazonaws.com/model/${encodeURIComponent(model)}/converse`;

        logAIRequest(diff, requestType, SERVICE_NAME, model, loggingUrl, loggingHeaders, logging);
        logAIPrompt(diff, requestType, SERVICE_NAME, generatedSystemPrompt, userPrompt, logging);

        const payload = {
            modelId: model,
            systemPrompt: generatedSystemPrompt,
            userPrompt,
            inferenceConfig: {
                temperature,
                topP,
                maxTokens,
            },
        };
        logAIPayload(diff, requestType, SERVICE_NAME, payload, logging);

        const startTime = Date.now();

        try {
            const runtimeMode = config.runtimeMode as RuntimeMode;
            const completion =
                runtimeMode === 'application'
                    ? await this.invokeApplicationEndpoint({
                          model,
                          systemPrompt: generatedSystemPrompt,
                          userPrompt,
                          logging,
                          requestType,
                          diff,
                          inferenceConfig: payload.inferenceConfig,
                      })
                    : await this.invokeFoundationModel({
                          model,
                          systemPrompt: generatedSystemPrompt,
                          userPrompt,
                          logging,
                          requestType,
                          diff,
                          inferenceConfig: payload.inferenceConfig,
                      });

            const duration = Date.now() - startTime;
            logAIComplete(diff, requestType, SERVICE_NAME, duration, completion, logging);

            if (requestType === 'review') {
                return this.sanitizeResponse(completion);
            }

            return this.parseMessage(completion, config.type, config.generate);
        } catch (error) {
            const duration = Date.now() - startTime;
            logAIError(diff, requestType, SERVICE_NAME, error, logging);
            if (error instanceof Error) {
                (error as AIServiceError).status = (error as any)?.status || (error as any)?.$metadata?.httpStatusCode;
            }
            throw error;
        }
    }

    private async invokeFoundationModel(args: {
        model: string;
        systemPrompt: string;
        userPrompt: string;
        inferenceConfig: { temperature: number; topP: number; maxTokens: number };
        logging: boolean;
        requestType: RequestType;
        diff: string;
    }): Promise<string> {
        const region = this.getRegion();
        const { model, systemPrompt, userPrompt, inferenceConfig, logging, requestType, diff } = args;

        const { BedrockRuntimeClient, ConverseCommand } = await loadBedrockRuntimeModule();

        const config = this.bedrockConfig;
        const clientConfig: Record<string, unknown> = {
            region,
            requestHandler: {
                requestTimeout: config.timeout || 120000,
            },
        };
        const credentials = await this.resolveCredentials();
        if (credentials) {
            clientConfig.credentials = credentials;
        }

        const client = new BedrockRuntimeClient(clientConfig);
        const command = new ConverseCommand({
            modelId: model,
            messages: [
                {
                    role: 'user',
                    content: [{ text: userPrompt }],
                },
            ],
            ...(systemPrompt
                ? {
                      system: [
                          {
                              text: systemPrompt,
                          },
                      ],
                  }
                : {}),
            inferenceConfig: {
                ...(typeof inferenceConfig.temperature === 'number' && { temperature: inferenceConfig.temperature }),
                ...(typeof inferenceConfig.topP === 'number' && { topP: inferenceConfig.topP }),
                ...(typeof inferenceConfig.maxTokens === 'number' && { maxTokens: inferenceConfig.maxTokens }),
            },
        });

        const response = await client.send(command);
        logAIResponse(diff, requestType, SERVICE_NAME, response, logging);

        const text = response.output?.message?.content?.[0]?.text || '';
        if (!text) {
            const error: AIServiceError = new Error('No text content found in Bedrock response.');
            error.name = ERROR_NAMES.EMPTY_RESPONSE;
            error.content = response;
            throw error;
        }

        return text;
    }

    private invokeApplicationEndpoint(args: {
        model: string;
        systemPrompt: string;
        userPrompt: string;
        inferenceConfig: { temperature: number; topP: number; maxTokens: number };
        logging: boolean;
        requestType: RequestType;
        diff: string;
    }): Promise<string> {
        const { model, systemPrompt, userPrompt, inferenceConfig, logging, requestType, diff } = args;
        const config = this.bedrockConfig;

        // Build the application endpoint URL
        const region = this.getRegion();
        const encodedModelId = encodeURIComponent(model);
        const urlString = config.applicationBaseUrl || `https://bedrock-runtime.${region}.amazonaws.com/model/${encodedModelId}/converse`;
        const url = new URL(urlString);

        // Use Bedrock Converse API format
        const requestBody: any = {
            modelId: model,
            messages: [
                {
                    role: 'user',
                    content: [{ text: userPrompt }],
                },
            ],
            inferenceConfig: {
                // Only include temperature OR topP, not both (some models don't support both)
                ...(typeof inferenceConfig.temperature === 'number' && { temperature: inferenceConfig.temperature }),
                // Skip topP if temperature is set
                // ...(typeof inferenceConfig.topP === 'number' && { topP: inferenceConfig.topP }),
                ...(typeof inferenceConfig.maxTokens === 'number' && { maxTokens: inferenceConfig.maxTokens }),
            },
        };

        // Add system prompt if provided
        if (systemPrompt) {
            requestBody.system = [{ text: systemPrompt }];
        }

        const body = JSON.stringify(requestBody);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body).toString(),
        };

        // Use Authorization Bearer token for authentication
        if (isNonEmptyString(config.key)) {
            headers['Authorization'] = `Bearer ${config.key}`;
        }
        if (isNonEmptyString(config.applicationInferenceProfileArn)) {
            headers['x-amzn-bedrock-inference-profile-arn'] = config.applicationInferenceProfileArn;
        }
        if (isNonEmptyString(config.applicationEndpointId)) {
            headers['x-amzn-bedrock-endpoint-id'] = config.applicationEndpointId;
        }

        return new Promise((resolve, reject) => {
            const request = https.request(
                {
                    method: 'POST',
                    protocol: url.protocol,
                    hostname: url.hostname,
                    port: url.port,
                    path: url.pathname + url.search,
                    headers,
                    timeout: config.timeout,
                },
                response => {
                    const chunks: Buffer[] = [];

                    response.on('data', chunk => chunks.push(chunk));
                    response.on('end', () => {
                        const responseBody = Buffer.concat(chunks).toString('utf8');

                        if (response.statusCode && response.statusCode >= 400) {
                            const error: AIServiceError = new Error(
                                `Bedrock application endpoint responded with status ${response.statusCode}.`
                            );
                            error.status = response.statusCode;
                            error.content = responseBody;
                            logAIError(diff, requestType, SERVICE_NAME, error, logging);
                            return reject(error);
                        }

                        // Bedrock Converse API should always return JSON-formatted responses
                        const parsed = safeJsonParse(responseBody);
                        if (!parsed.ok) {
                            const error: AIServiceError = new Error(
                                'Failed to parse Bedrock application response as JSON. The Bedrock Converse API should always return valid JSON.'
                            );
                            error.name = ERROR_NAMES.INVALID_RESPONSE;
                            error.content = responseBody;
                            logAIError(diff, requestType, SERVICE_NAME, error, logging);
                            return reject(error);
                        }

                        const parsedResponse = parsed.data;
                        logAIResponse(diff, requestType, SERVICE_NAME, parsedResponse, logging);

                        const text = parsedResponse.output?.message?.content?.[0]?.text || '';
                        if (!text) {
                            const error: AIServiceError = new Error('No text content found in Bedrock response.');
                            error.name = ERROR_NAMES.EMPTY_RESPONSE;
                            error.content = parsedResponse;
                            logAIError(diff, requestType, SERVICE_NAME, error, logging);
                            return reject(error);
                        }
                        resolve(text);
                    });
                }
            );

            request.on('error', error => {
                const aiError: AIServiceError = error as AIServiceError;
                logAIError(diff, requestType, SERVICE_NAME, aiError, logging);
                reject(aiError);
            });

            request.write(body);
            request.end();
        });
    }

    private getRegion(): string {
        const config = this.bedrockConfig;
        return config.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '';
    }

    private async resolveCredentials(): Promise<AwsCredentialIdentityProvider | AwsCredentialIdentity | undefined> {
        // Check cache validity
        const now = Date.now();
        if (this.credentialCache && now - this.credentialCacheTimestamp < this.CREDENTIAL_CACHE_TTL) {
            return this.credentialCache;
        }

        const config = this.bedrockConfig;
        const profile = config.profile;
        const accessKeyId = config.accessKeyId;
        const secretAccessKey = config.secretAccessKey;
        const sessionToken = config.sessionToken;

        let credentials: AwsCredentialIdentityProvider | AwsCredentialIdentity | undefined;

        // If explicit profile is configured, use fromIni
        if (isNonEmptyString(profile)) {
            const { fromIni } = await loadCredentialProvidersModule();
            credentials = fromIni({ profile });
        }
        // If explicit credentials are configured, use them
        else if (isNonEmptyString(accessKeyId) && isNonEmptyString(secretAccessKey)) {
            credentials = async () => ({
                accessKeyId,
                secretAccessKey,
                sessionToken: sessionToken || process.env.AWS_SESSION_TOKEN || undefined,
            });
        }
        // If AWS_PROFILE is set in environment, use fromIni
        else if (process.env.AWS_PROFILE) {
            const { fromIni } = await loadCredentialProvidersModule();
            credentials = fromIni({ profile: process.env.AWS_PROFILE });
        }
        // Otherwise, return undefined to use SDK's default credential provider chain
        // which automatically checks env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY),
        // EC2 instance metadata, ECS container credentials, etc.

        // Update cache
        if (credentials) {
            this.credentialCache = credentials;
            this.credentialCacheTimestamp = now;
        }

        return credentials;
    }
}
