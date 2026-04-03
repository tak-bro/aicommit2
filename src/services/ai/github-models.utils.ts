export const GITHUB_MODELS_BASE_URL = 'https://models.github.ai';
export const GITHUB_MODELS_INFERENCE_PATH = '/inference/chat/completions';
export const GITHUB_MODELS_API_VERSION = '2026-03-10';
export const GITHUB_MODELS_DEFAULT_MODEL = 'openai/gpt-4o-mini';

const GITHUB_MODEL_ID_PATTERN = /^([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._:-]*)$/;

export const normalizeGitHubModelsModelId = (model?: string): string => {
    return (model || '').trim();
};

export const isValidGitHubModelsModelId = (model?: string): boolean => {
    const normalized = normalizeGitHubModelsModelId(model);
    return normalized.length > 0 && GITHUB_MODEL_ID_PATTERN.test(normalized);
};

export const ensureGitHubModelsModelId = (model?: string): string => {
    const normalized = normalizeGitHubModelsModelId(model);
    if (!isValidGitHubModelsModelId(normalized)) {
        throw new Error(
            `Invalid GitHub Models model ID "${normalized || '(empty)'}". Expected format: "publisher/model" (example: "openai/gpt-4o-mini").`
        );
    }
    return normalized;
};

export const isValidGitHubTokenFormat = (token?: string): boolean => {
    const normalized = (token || '').trim();
    if (!normalized) {
        return false;
    }

    const supportedPrefixes = ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_'];
    return supportedPrefixes.some(prefix => normalized.startsWith(prefix));
};
