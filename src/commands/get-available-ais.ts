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
    const hasApiKey = isNonEmptyString(value.key as string);
    const hasRegion =
        isNonEmptyString(value.region as string) ||
        isNonEmptyString(process.env.AWS_REGION) ||
        isNonEmptyString(process.env.AWS_DEFAULT_REGION);
    const hasProfile = isNonEmptyString(value.profile as string) || isNonEmptyString(process.env.AWS_PROFILE);
    const hasAccessKeys =
        (isNonEmptyString(value.accessKeyId as string) && isNonEmptyString(value.secretAccessKey as string)) ||
        (isNonEmptyString(process.env.AWS_ACCESS_KEY_ID) && isNonEmptyString(process.env.AWS_SECRET_ACCESS_KEY));

    // Bedrock available if: region + at least one auth method
    return hasRegion && (hasApiKey || hasProfile || hasAccessKeys);
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
                case 'watch':
                    const watchMode = config.watchMode || value.watchMode;
                    if (key === 'OLLAMA') {
                        return !!value && hasConfiguredModels(value) && watchMode;
                    }
                    if (key === 'HUGGINGFACE') {
                        return !!value && !!value.cookie && watchMode;
                    }
                    if (key === 'BEDROCK') {
                        return hasConfiguredModels(value) && hasBedrockAccess(value) && watchMode;
                    }
                    if (value.compatible) {
                        return !!value.url && !!value.key && watchMode;
                    }
                    return !!value.key && value.key.length > 0 && watchMode;
            }
        })
        .map(([key]) => key);
};

export { hasBedrockAccess, hasConfiguredModels };
