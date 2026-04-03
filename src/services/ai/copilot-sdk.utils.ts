export const COPILOT_SDK_DEFAULT_MODEL = 'gpt-4.1';
export const COPILOT_SDK_FALLBACK_MODELS = ['gpt-4.1', 'gpt-4o', 'gpt-5-mini'] as const;

export interface CopilotSdkClientOptions {
    githubToken?: string;
    useLoggedInUser?: boolean;
    env?: NodeJS.ProcessEnv;
}

const COPILOT_SDK_MODEL_ALIASES: Record<string, string> = {
    'openai/gpt-4.1': 'gpt-4.1',
    'openai/gpt-4o': 'gpt-4o',
    'openai/gpt-5-mini': 'gpt-5-mini',
};

export const normalizeCopilotSdkModel = (model?: string): string => {
    const normalized = (model || '').trim().toLowerCase();
    if (!normalized) {
        return COPILOT_SDK_DEFAULT_MODEL;
    }

    if (normalized in COPILOT_SDK_MODEL_ALIASES) {
        return COPILOT_SDK_MODEL_ALIASES[normalized];
    }

    // Accept GitHub Models style IDs by stripping provider prefix.
    if (normalized.includes('/')) {
        return normalized.split('/').pop() || normalized;
    }

    return normalized;
};

export const getCopilotSdkModelCandidates = (primary?: string): string[] => {
    const normalizedPrimary = normalizeCopilotSdkModel(primary);
    return [normalizedPrimary, ...COPILOT_SDK_FALLBACK_MODELS].filter((model, index, arr) => arr.indexOf(model) === index);
};

export const isCopilotSdkModelAccessError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('unknown_model') ||
        normalized.includes('unknown model') ||
        normalized.includes('unavailable_model') ||
        normalized.includes('unavailable model') ||
        normalized.includes('model not found') ||
        normalized.includes('not available') ||
        normalized.includes('not enabled') ||
        normalized.includes('not allowed')
    );
};

export const isCopilotSdkAuthError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return (
        normalized.includes('auth') ||
        normalized.includes('unauthorized') ||
        normalized.includes('forbidden') ||
        normalized.includes('token') ||
        normalized.includes('copilot cli')
    );
};

export const isCopilotSdkClassicPatError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('classic personal access tokens') && normalized.includes('ghp_');
};

export const buildCopilotSdkClientOptions = (env: NodeJS.ProcessEnv = process.env): CopilotSdkClientOptions => {
    const sanitizedEnv: NodeJS.ProcessEnv = { ...env };

    // Prevent COPILOT_SDK auth from being hijacked by generic GitHub token envs.
    delete sanitizedEnv.GH_TOKEN;
    delete sanitizedEnv.GITHUB_TOKEN;

    const copilotToken = (env.COPILOT_GITHUB_TOKEN || '').trim();
    if (copilotToken.length > 0) {
        sanitizedEnv.COPILOT_GITHUB_TOKEN = copilotToken;
        return {
            githubToken: copilotToken,
            useLoggedInUser: false,
            env: sanitizedEnv,
        };
    }

    delete sanitizedEnv.COPILOT_GITHUB_TOKEN;
    return {
        useLoggedInUser: true,
        env: sanitizedEnv,
    };
};
