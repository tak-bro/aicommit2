import { RequestType } from '../utils/ai-log.js';
import { BUILTIN_SERVICES, BuiltinService, ModelName, RawConfig, ValidConfig } from '../utils/config.js';

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

const hasCopilotSdkAvailable = (value: RawConfig): boolean => {
    // COPILOT_SDK activates on an explicit opt-in signal only: a configured
    // model, a key, or COPILOT_GITHUB_TOKEN (issue #254 — the SDK ships as an
    // optional dependency, so its mere presence is not user intent).
    //
    // Availability is intentionally NOT gated on whether the @github/copilot-sdk
    // package resolves. That package is an optionalDependency (omitted by
    // Homebrew and `--omit=optional` installs), so probing for it silently
    // dropped the provider even when the user had opted in and the Copilot CLI
    // was healthy (issue #256). If the package is genuinely missing, the service
    // surfaces an actionable SDK_NOT_INSTALLED error at request time instead.
    return hasConfiguredModels(value) || isNonEmptyString(value.key as string) || isNonEmptyString(process.env.COPILOT_GITHUB_TOKEN);
};

const getConfiguredModels = (value: RawConfig): string[] => {
    if (Array.isArray(value.model)) {
        return value.model as string[];
    }
    return isNonEmptyString(value.model) ? [(value.model as string).trim()] : [];
};

const hasConfiguredModels = (value: RawConfig): boolean => getConfiguredModels(value).length > 0;

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

    // Application endpoint auth (no region required)
    const hasApplicationBaseUrl =
        isNonEmptyString(value.applicationBaseUrl as string) || isNonEmptyString(process.env.BEDROCK_APPLICATION_BASE_URL);
    const hasApplicationEndpoint =
        isNonEmptyString(value.applicationEndpointId as string) || isNonEmptyString(process.env.BEDROCK_APPLICATION_ENDPOINT_ID);
    const hasApplicationApiKey = isNonEmptyString(process.env.BEDROCK_APPLICATION_API_KEY);

    // Bedrock available if:
    // 1. Standard auth: region + (apiKey OR profile OR accessKeys)
    // 2. Application endpoint with base URL: applicationBaseUrl + key
    // 3. Application endpoint via env: applicationEndpointId + applicationApiKey
    const hasStandardAuth = hasRegion && (hasApiKey || hasProfile || hasAccessKeys);
    const hasApplicationAuth = (hasApplicationBaseUrl && hasApiKey) || (hasApplicationEndpoint && hasApplicationApiKey);

    return hasStandardAuth || hasApplicationAuth;
};

export const getAvailableAIs = (config: ValidConfig, requestType: RequestType): ModelName[] => {
    return Object.entries(config)
        .map(([key, value]) => [key, value] as [ModelName, RawConfig])
        .filter(([key, value]) => !value.disabled)
        .filter(([key, value]) => BUILTIN_SERVICES.includes(key as BuiltinService) || value.compatible === true)
        .filter(([key, value]) => {
            switch (requestType) {
                case 'commit':
                    // CLAUDE_CODE opts in via a configured model; the CLI binary is checked at request time.
                    if (key === 'OLLAMA' || key === 'CLAUDE_CODE' || key === 'GEMINI_CLI') {
                        return !!value && hasConfiguredModels(value);
                    }
                    if (key === 'COPILOT_SDK') {
                        return !!value && hasCopilotSdkAvailable(value);
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
                    if (key === 'OLLAMA' || key === 'CLAUDE_CODE' || key === 'GEMINI_CLI') {
                        return !!value && hasConfiguredModels(value) && codeReview;
                    }
                    if (key === 'COPILOT_SDK') {
                        return !!value && hasCopilotSdkAvailable(value) && codeReview;
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
                    if (key === 'OLLAMA' || key === 'CLAUDE_CODE' || key === 'GEMINI_CLI') {
                        return !!value && hasConfiguredModels(value) && watchMode;
                    }
                    if (key === 'COPILOT_SDK') {
                        return !!value && hasCopilotSdkAvailable(value) && watchMode;
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

export { getConfiguredModels, hasBedrockAccess, hasConfiguredModels, hasCopilotSdkAvailable };
