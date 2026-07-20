import { execSync } from 'child_process';
import { createRequire } from 'module';

export const COPILOT_SDK_DEFAULT_MODEL = 'gpt-4.1';

/**
 * Whether the optional @github/copilot-sdk package can be resolved. The service
 * imports it lazily at request time, so a missing package is a request-time
 * failure, not an availability signal (see get-available-ais.ts, issue #256).
 * doctor uses this to warn the user proactively instead of letting the run fail.
 */
export const isCopilotSdkPackageInstalled = (): boolean => {
    try {
        createRequire(import.meta.url).resolve('@github/copilot-sdk');
        return true;
    } catch {
        return false;
    }
};
export const COPILOT_SDK_FALLBACK_MODELS = ['gpt-4.1', 'gpt-4o', 'gpt-5-mini'] as const;

/**
 * Known working models by subscription tier (community-tested).
 * This list may lag behind GitHub's actual model availability.
 */
export const COPILOT_SDK_KNOWN_MODELS = {
    free: ['claude-haiku-4.5', 'gpt-5-mini', 'gpt-4.1'] as const,
    pro: [
        'gpt-5.4',
        'claude-sonnet-4.5',
        'claude-opus-4.5',
        'claude-sonnet-4',
        'gpt-5.3-codex',
        'gpt-5.2-codex',
        'gpt-5.2',
        'gpt-5.1',
        'gpt-5.4-mini',
    ] as const,
} as const;

export const ALL_COPILOT_SDK_KNOWN_MODELS: readonly string[] = [...COPILOT_SDK_KNOWN_MODELS.free, ...COPILOT_SDK_KNOWN_MODELS.pro];

export interface CopilotSdkClientOptions {
    /** SDK >=1.0 spells this `gitHubToken`; the 0.x `githubToken` spelling is silently ignored. */
    gitHubToken?: string;
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
        normalized.includes('authentication') ||
        normalized.includes('unauthorized') ||
        normalized.includes('forbidden') ||
        normalized.includes('invalid token') ||
        normalized.includes('token expired') ||
        normalized.includes('no authentication') ||
        normalized.includes('copilot cli authentication')
    );
};

/**
 * The SDK's bundled Copilot CLI could not be resolved or spawned. This is an
 * installation problem (broken/missing @github/copilot), not an auth problem —
 * telling the user to log in cannot fix it (issue #259: copilot-sdk 0.2.0
 * mis-resolved the CLI path against @github/copilot >=1.0.39 layouts).
 */
export const isCopilotSdkCliNotFoundError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('copilot cli not found') || normalized.includes('could not find @github/copilot package');
};

export const isCopilotSdkClassicPatError = (message: string): boolean => {
    const normalized = message.toLowerCase();
    return normalized.includes('classic personal access tokens') && normalized.includes('ghp_');
};

/**
 * Read a Copilot-scoped token from the GitHub CLI. The Copilot CLI's own OAuth
 * token lives in the OS keychain (not file-readable), so `gh` is the reliable
 * explicit-token source. Gated on the `copilot` scope: a repo-only gh token
 * would authenticate but be rejected by Copilot, so we skip it and let the
 * caller fall back to useLoggedInUser. Returns undefined when gh is absent,
 * logged out, or lacks the scope (issue #259).
 */
export const readGhCopilotToken = (): string | undefined => {
    try {
        const status = execSync('gh auth status 2>&1', { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
        const hasCopilotScope = status.toLowerCase().includes("'copilot'");
        if (!hasCopilotScope) {
            return undefined;
        }
        const token = execSync('gh auth token', { stdio: ['ignore', 'pipe', 'pipe'] })
            .toString()
            .trim();
        return token || undefined;
    } catch {
        // gh not installed, not authenticated, or unexpected output — fall back.
        return undefined;
    }
};

/**
 * Resolve an explicit Copilot token, preferring COPILOT_GITHUB_TOKEN and
 * falling back to a Copilot-scoped gh token. Returns undefined when neither is
 * available so the caller uses useLoggedInUser. ghReader is injectable for tests.
 */
export const resolveCopilotSdkToken = (
    env: NodeJS.ProcessEnv = process.env,
    ghReader: () => string | undefined = readGhCopilotToken
): string | undefined => {
    const envToken = (env.COPILOT_GITHUB_TOKEN || '').trim();
    if (envToken) {
        return envToken;
    }
    return ghReader();
};

/**
 * Build Copilot SDK client options. Never invokes gh itself: callers resolve the
 * token once (via resolveCopilotSdkToken) and pass it as resolvedToken so the gh
 * subprocess is not repeated across the model-retry loop. Without a token, falls
 * back to useLoggedInUser (the SDK's stored-OAuth/gh discovery).
 */
export const buildCopilotSdkClientOptions = (env: NodeJS.ProcessEnv = process.env, resolvedToken?: string): CopilotSdkClientOptions => {
    const sanitizedEnv: NodeJS.ProcessEnv = { ...env };

    // Suppress Node.js ExperimentalWarning (e.g., SQLite) in the Copilot CLI subprocess.
    sanitizedEnv.NODE_NO_WARNINGS = '1';

    // Prevent COPILOT_SDK auth from being hijacked by generic GitHub token envs.
    delete sanitizedEnv.GH_TOKEN;
    delete sanitizedEnv.GITHUB_TOKEN;

    const explicitToken = (resolvedToken ?? env.COPILOT_GITHUB_TOKEN ?? '').trim();
    if (explicitToken.length > 0) {
        sanitizedEnv.COPILOT_GITHUB_TOKEN = explicitToken;
        return {
            gitHubToken: explicitToken,
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
