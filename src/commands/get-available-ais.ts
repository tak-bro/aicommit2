import { RequestType } from '../utils/ai-log.js';
import { BUILTIN_SERVICES, BuiltinService, ModelName, RawConfig, ValidConfig } from '../utils/config.js';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const hasConfiguredModels = (value: RawConfig): boolean => {
    const models = Array.isArray(value.model)
        ? (value.model as string[])
        : isNonEmptyString(value.model)
          ? [(value.model as string).trim()]
          : [];
    return models.length > 0;
};

const hasBedrockAccess = (value: RawConfig): boolean => {
    const runtimeMode = isNonEmptyString(value.runtimeMode)
        ? ((value.runtimeMode as string).toLowerCase() as 'foundation' | 'application')
        : 'foundation';

    const hasApiKey = isNonEmptyString(value.key as string);

    // Check region from config or environment variables (matching bedrock.service.ts getRegion())
    const hasRegion =
        isNonEmptyString(value.region as string) ||
        isNonEmptyString(process.env.AWS_REGION) ||
        isNonEmptyString(process.env.AWS_DEFAULT_REGION);

    // Check profile from config or environment variable
    const hasProfile = isNonEmptyString(value.profile as string) || isNonEmptyString(process.env.AWS_PROFILE);

    // Check access keys from config or environment variables
    const hasAccessKeys =
        (isNonEmptyString(value.accessKeyId as string) && isNonEmptyString(value.secretAccessKey as string)) ||
        (isNonEmptyString(process.env.AWS_ACCESS_KEY_ID) && isNonEmptyString(process.env.AWS_SECRET_ACCESS_KEY));

    // Foundation mode: requires region and IAM credentials (profile or access keys)
    const hasFoundationAccess = runtimeMode === 'foundation' && hasRegion && (hasProfile || hasAccessKeys);

    // Application mode: REQUIRES an API key and region
    // If no specific application endpoint config is provided, will default to Converse API endpoint
    const hasApplicationAccess =
        runtimeMode === 'application' &&
        hasApiKey &&
        (hasRegion ||
            isNonEmptyString(value.applicationBaseUrl as string) ||
            isNonEmptyString(value.applicationEndpointId as string) ||
            isNonEmptyString(value.applicationInferenceProfileArn as string) ||
            isNonEmptyString(process.env.BEDROCK_APPLICATION_BASE_URL) ||
            isNonEmptyString(process.env.BEDROCK_APPLICATION_ENDPOINT_ID) ||
            isNonEmptyString(process.env.BEDROCK_APPLICATION_INFERENCE_PROFILE_ARN) ||
            isNonEmptyString(process.env.BEDROCK_INFERENCE_PROFILE_ARN));

    return hasFoundationAccess || hasApplicationAccess;
};

export const getAvailableAIs = (config: ValidConfig, requestType: RequestType): ModelName[] => {
    return Object.entries(config)
        .map(([key, value]) => [key, value] as [ModelName, RawConfig])
        .filter(([key, value]) => !value.disabled)
        .filter(([key, value]) => BUILTIN_SERVICES.includes(key as BuiltinService) || value.compatible === true)
        .filter(([key, value]) => {
            switch (requestType) {
                case 'commit':
                    if (key === 'OLLAMA') {
                        return !!value && hasConfiguredModels(value);
                    }
                    if (key === 'HUGGINGFACE') {
                        return !!value && !!value.cookie;
                    }
                    if (key === 'BEDROCK') {
                        return hasConfiguredModels(value) && hasBedrockAccess(value);
                    }
                    return !!value.key && value.key.length > 0;
                case 'review':
                    const codeReview = config.codeReview || value.codeReview;
                    if (key === 'OLLAMA') {
                        return !!value && hasConfiguredModels(value) && codeReview;
                    }
                    if (key === 'HUGGINGFACE') {
                        return !!value && !!value.cookie && codeReview;
                    }
                    if (key === 'BEDROCK') {
                        return hasConfiguredModels(value) && hasBedrockAccess(value) && codeReview;
                    }
                    return !!value.key && value.key.length > 0 && codeReview;
            }
        })
        .map(([key]) => key);
};

export { hasBedrockAccess, hasConfiguredModels };
