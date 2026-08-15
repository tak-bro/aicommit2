import { execSync } from 'child_process';

import chalk from 'chalk';
import { command } from 'cleye';

import { getConfiguredModels, hasBedrockAccess, hasConfiguredModels, hasCopilotSdkAvailable } from './get-available-ais.js';
import {
    ALL_COPILOT_SDK_KNOWN_MODELS,
    buildCopilotSdkClientOptions,
    isCopilotSdkCliNotFoundError,
    isCopilotSdkPackageInstalled,
    normalizeCopilotSdkModel,
    resolveCopilotSdkToken,
} from '../services/ai/copilot-sdk.utils.js';
import {
    GITHUB_MODELS_API_VERSION,
    GITHUB_MODELS_BASE_URL,
    GITHUB_MODELS_DEFAULT_MODEL,
    GITHUB_MODELS_INFERENCE_PATH,
    isValidGitHubModelsModelId,
} from '../services/ai/github-models.utils.js';
import { HttpRequestBuilder } from '../services/http/http-request.builder.js';
import {
    BUILTIN_SERVICES,
    BuiltinService,
    DEFAULT_OLLAMA_HOST,
    RawConfig,
    SUBSCRIPTION_CLI_SERVICES,
    ValidConfig,
    getConfig,
} from '../utils/config.js';
import { handleCliError } from '../utils/error.js';
import { findLazygitConfig, hasAicommitIntegration, isLazygitInstalled } from '../utils/lazygit.js';

/**
 * Health check status for a provider
 */
export type HealthStatus = 'healthy' | 'error' | 'warning' | 'skipped';

/**
 * Health check result for a single provider
 */
export interface ProviderHealthResult {
    provider: string;
    status: HealthStatus;
    message: string;
    details?: string;
}

interface OpenRouterModel {
    id?: string;
    canonical_slug?: string;
    name?: string;
    context_length?: number;
    supported_parameters?: string[];
    top_provider?: {
        context_length?: number;
        max_completion_tokens?: number;
        is_moderated?: boolean;
    };
}

interface OpenRouterModelsListResponse {
    data?: OpenRouterModel[];
}

/**
 * Status icons for display
 */
const STATUS_ICONS: Record<HealthStatus, string> = {
    healthy: chalk.green('✅'),
    error: chalk.red('❌'),
    warning: chalk.yellow('⚠️'),
    skipped: chalk.gray('⏭️'),
};

/**
 * Status labels for display
 */
const STATUS_LABELS: Record<HealthStatus, (text: string) => string> = {
    healthy: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
    skipped: chalk.gray,
};

/**
 * Check if a provider has API key configured
 */
const hasApiKey = (value: RawConfig): boolean => {
    return typeof value.key === 'string' && value.key.trim().length > 0;
};

const isNonEmptyObject = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length > 0;
};

const normalizeOpenRouterBaseUrl = (url?: unknown): string => {
    if (typeof url === 'string' && url.trim()) {
        return url.replace(/\/$/, '');
    }
    return 'https://openrouter.ai';
};

const getOpenRouterCatalogUrl = (providerConfig: RawConfig): string => {
    return `${normalizeOpenRouterBaseUrl(providerConfig.url)}/api/v1`;
};

const getOpenRouterHeaders = (key: string): Record<string, string> => ({
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/tak-bro/aicommit2',
    'X-OpenRouter-Title': 'aicommit2',
    'X-OpenRouter-Categories': 'cli-agent',
});

const matchOpenRouterModel = (model: string, catalog: OpenRouterModel[]): OpenRouterModel | undefined => {
    const normalized = model.trim();

    return catalog.find(entry => {
        const candidates = [entry.id, entry.canonical_slug, entry.name].filter((value): value is string => !!value);
        return candidates.some(candidate => candidate === normalized);
    });
};

const supportsParameter = (model: OpenRouterModel, parameter: string): boolean => {
    return model.supported_parameters?.includes(parameter) ?? false;
};

const OPENROUTER_OPTION_HINTS = [
    {
        configKey: 'OPENROUTER.responseFormat',
        configProperty: 'responseFormat',
        parameters: ['response_format'],
    },
    {
        configKey: 'OPENROUTER.reasoning',
        configProperty: 'reasoning',
        parameters: ['reasoning', 'include_reasoning'],
    },
] as const;

const formatSupportedParameters = (model: OpenRouterModel): string => {
    const parameters = model.supported_parameters || [];
    return parameters.length > 0 ? `supports: ${parameters.join(', ')}` : 'no supported parameters listed';
};

const getOpenRouterOptionRemovals = (providerConfig: RawConfig, model: OpenRouterModel): string[] => {
    const removals: string[] = [];

    for (const hint of OPENROUTER_OPTION_HINTS) {
        if (!isNonEmptyObject(providerConfig[hint.configProperty])) {
            continue;
        }

        const supported = hint.parameters.some(parameter => supportsParameter(model, parameter));
        if (!supported) {
            removals.push(hint.configKey);
        }
    }

    return removals;
};

const formatOpenRouterCapabilityMessage = (selectedModel: string, providerConfig: RawConfig, model: OpenRouterModel): string => {
    const contextLength = model.context_length || model.top_provider?.context_length;
    const supportedParameters = formatSupportedParameters(model);
    const removals = getOpenRouterOptionRemovals(providerConfig, model);
    const contextPart = contextLength ? `${contextLength} ctx` : '';

    if (removals.length > 0) {
        const recommendation = `consider removing ${removals.join(', ')}`;
        const suffixParts = [recommendation, contextPart, supportedParameters].filter(Boolean);
        return `${selectedModel}: ${suffixParts.join('; ')}`;
    }

    const suffixParts = [contextPart, supportedParameters].filter(Boolean);
    return suffixParts.length > 0 ? `${selectedModel} (${suffixParts.join('; ')})` : selectedModel;
};

export const summarizeOpenRouterCapabilities = (providerConfig: RawConfig, catalog: OpenRouterModel[]): string[] => {
    const messages: string[] = [];
    const selectedModels = Array.isArray(providerConfig.model)
        ? (providerConfig.model as string[])
        : typeof providerConfig.model === 'string'
          ? [providerConfig.model]
          : [];

    for (const selectedModel of selectedModels) {
        if (selectedModel === 'openrouter/auto') {
            messages.push('Auto routing enabled');
            continue;
        }

        const model = matchOpenRouterModel(selectedModel, catalog);
        if (!model) {
            messages.push(`Model not found in catalog: ${selectedModel}`);
            continue;
        }

        messages.push(formatOpenRouterCapabilityMessage(selectedModel, providerConfig, model));
    }

    return messages;
};

/**
 * Check if Ollama is running and accessible
 */
const checkOllamaConnection = async (host: string, timeout: number): Promise<{ ok: boolean; error?: string }> => {
    try {
        const builder = new HttpRequestBuilder({
            method: 'GET',
            baseURL: host,
            timeout,
        });
        await builder.execute();
        return { ok: true };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('ECONNREFUSED')) {
            return { ok: false, error: 'Not running' };
        }
        return { ok: false, error: errorMsg };
    }
};

const checkOpenRouterConnection = async (
    providerConfig: RawConfig,
    timeout: number
): Promise<{ ok: boolean; error?: string; details?: string }> => {
    const key = typeof providerConfig.key === 'string' ? providerConfig.key.trim() : '';
    if (!key) {
        return { ok: false, error: 'No API key configured' };
    }

    try {
        const baseUrl = getOpenRouterCatalogUrl(providerConfig);
        const headers = getOpenRouterHeaders(key);
        const catalogPaths = ['/models/user', '/models'];
        let response: { data?: OpenRouterModelsListResponse } | undefined;
        let lastError: unknown;

        for (const catalogPath of catalogPaths) {
            try {
                const builder = new HttpRequestBuilder({
                    method: 'GET',
                    baseURL: `${baseUrl}${catalogPath}`,
                    timeout,
                }).setHeaders(headers);

                response = await builder.execute<OpenRouterModelsListResponse>();
                break;
            } catch (error) {
                lastError = error;
                const errorMsg = error instanceof Error ? error.message : String(error);
                if (!errorMsg.includes('404')) {
                    throw error;
                }
            }
        }

        if (!response) {
            throw lastError instanceof Error ? lastError : new Error(String(lastError));
        }

        const models = response.data?.data ?? [];

        const configuredModels = getConfiguredModels(providerConfig);

        if (configuredModels.length === 0) {
            return {
                ok: true,
                details: `Catalog reachable (${models.length} models)`,
            };
        }

        const openRouterAuto = configuredModels.includes('openrouter/auto');
        if (openRouterAuto) {
            const notes = summarizeOpenRouterCapabilities(providerConfig, models);
            return {
                ok: true,
                details: notes.length > 0 ? notes.join('; ') : `Auto routing enabled (${models.length} models)`,
            };
        }

        const capabilityNotes = summarizeOpenRouterCapabilities(providerConfig, models);
        const hasMissingModel = capabilityNotes.some(note => note.startsWith('Model not found in catalog:'));
        if (hasMissingModel) {
            return {
                ok: false,
                error: 'Selected model not found in OpenRouter catalog',
                details: capabilityNotes.join('; '),
            };
        }

        return {
            ok: true,
            details: capabilityNotes.join('; '),
        };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);

        if (errorMsg.includes('401') || errorMsg.includes('403')) {
            return { ok: false, error: 'Unauthorized or forbidden when reading OpenRouter catalog' };
        }
        if (errorMsg.includes('404')) {
            return { ok: false, error: 'OpenRouter catalog endpoint not found' };
        }

        return { ok: false, error: errorMsg };
    }
};

const getGitHubModelsSelection = (providerConfig: RawConfig): string => {
    if (Array.isArray(providerConfig.model) && providerConfig.model.length > 0) {
        return String(providerConfig.model[0]).trim();
    }
    if (typeof providerConfig.model === 'string' && providerConfig.model.trim().length > 0) {
        return providerConfig.model.trim();
    }
    return GITHUB_MODELS_DEFAULT_MODEL;
};

const checkGitHubModelsConnection = async (
    providerConfig: RawConfig,
    timeout: number
): Promise<{ ok: boolean; error?: string; details?: string }> => {
    const key = typeof providerConfig.key === 'string' ? providerConfig.key.trim() : '';
    if (!key) {
        return { ok: false, error: 'No API key configured' };
    }

    const model = getGitHubModelsSelection(providerConfig);
    if (!isValidGitHubModelsModelId(model)) {
        return {
            ok: false,
            error: 'Invalid model ID format',
            details: `Expected "publisher/model", got "${model || '(empty)'}"`,
        };
    }

    try {
        const url = `${GITHUB_MODELS_BASE_URL}${GITHUB_MODELS_INFERENCE_PATH}`;
        const builder = new HttpRequestBuilder({
            method: 'POST',
            baseURL: url,
            timeout,
        })
            .setHeaders({
                'Content-Type': 'application/json',
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': GITHUB_MODELS_API_VERSION,
                Authorization: `Bearer ${key}`,
            })
            .setBody({
                model,
                messages: [{ role: 'user', content: 'health-check' }],
                max_tokens: 1,
                stream: false,
            });

        await builder.execute();
        return { ok: true, details: `Model: ${model}` };
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes('401')) {
            return { ok: false, error: 'Authentication failed (401)' };
        }
        if (errorMsg.includes('403')) {
            return { ok: false, error: 'Access denied (403). Check token permission: models: read' };
        }
        if (errorMsg.includes('404')) {
            return { ok: false, error: `Model not found (404): ${model}` };
        }
        if (errorMsg.includes('422')) {
            return { ok: false, error: `Request validation failed (422) for model: ${model}` };
        }
        return { ok: false, error: errorMsg };
    }
};

// Minimal shape of the lazily-imported Copilot SDK client used by the auth probe.
type CopilotProbeClient = {
    start: () => Promise<void>;
    getAuthStatus: () => Promise<{ isAuthenticated?: boolean; authType?: string }>;
    stop?: () => Promise<unknown> | unknown;
};

const withTimeout = <T>(promise: Promise<T>, ms: number, message: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(message)), ms);
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });

/**
 * Actually authenticate against the Copilot SDK the same way a real request does:
 * spawn the CLI server with the resolved auth options and call getAuthStatus.
 * This closes the gap where doctor reported "healthy" on CLI presence alone while
 * runtime auth failed (issue #259).
 */
const probeCopilotSdkAuth = async (
    timeout: number
): Promise<{ ok: boolean; authenticated: boolean; authType?: string; error?: string }> => {
    let client: CopilotProbeClient | undefined;
    try {
        const sdkModule = (await import('@github/copilot-sdk')) as unknown as {
            CopilotClient: new (options?: unknown) => CopilotProbeClient;
        };
        const options = buildCopilotSdkClientOptions(process.env, resolveCopilotSdkToken(process.env));
        client = new sdkModule.CopilotClient(options);
        const timeoutMessage = 'Copilot SDK authentication check timed out';
        await withTimeout(client.start(), timeout, timeoutMessage);
        const status = await withTimeout(client.getAuthStatus(), timeout, timeoutMessage);
        return { ok: true, authenticated: status.isAuthenticated === true, authType: status.authType };
    } catch (error) {
        return { ok: false, authenticated: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
        if (client?.stop) {
            try {
                await client.stop();
            } catch {
                // Ignore stop failures so they don't mask the probe result.
            }
        }
    }
};

// Static (non-network) prerequisites for COPILOT_SDK. Returns a failure reason,
// or null when the environment is ready for the live auth probe.
const checkCopilotSdkPrereqs = (): { error: string; details?: string } | null => {
    const copilotEnvToken = (process.env.COPILOT_GITHUB_TOKEN || '').trim();
    if (copilotEnvToken.startsWith('ghp_')) {
        return {
            error: 'Unsupported classic PAT in COPILOT_GITHUB_TOKEN',
            details: 'Copilot CLI requires Fine-Grained PAT (github_pat_...) or Copilot login flow',
        };
    }

    const nodeMajor = Number(process.versions.node.split('.')[0] || '0');
    if (Number.isFinite(nodeMajor) && nodeMajor < 22) {
        return {
            error: `Node.js ${process.versions.node} is too old for Copilot SDK`,
            details: 'Copilot SDK requires Node.js 22+',
        };
    }

    if (!isCopilotSdkPackageInstalled()) {
        return {
            error: '@github/copilot-sdk package not installed',
            details:
                'The optional dependency is missing (common with Homebrew or --omit=optional installs). Install with: npm install -g @github/copilot-sdk',
        };
    }

    return null;
};

const checkCopilotSdkEnvironment = async (
    providerConfig: RawConfig,
    timeout: number
): Promise<{ ok: boolean; error?: string; details?: string; modelWarning?: string }> => {
    // Callers gate on a configured model before reaching here, so this is never empty.
    // The service's own `|| COPILOT_SDK_DEFAULT_MODEL` fallback cannot stand in for it:
    // the fan-out is `from(getModels(ai))` (ai-request.manager.ts), so an empty model
    // list emits zero requests and the service default is never consulted.
    const model = getConfiguredModels(providerConfig)[0] || '';

    const prereqFailure = checkCopilotSdkPrereqs();
    if (prereqFailure) {
        return { ok: false, ...prereqFailure };
    }

    const nodeVersion = process.versions.node;
    // Global `copilot` binary is informational only: the SDK spawns its own
    // bundled CLI from @github/copilot, so a missing global install is fine.
    let version = '';
    try {
        version = execSync('copilot --version', { stdio: ['ignore', 'pipe', 'pipe'] })
            .toString()
            .trim();
    } catch {
        version = '';
    }

    // Probe real authentication, not just CLI presence (issue #259).
    const auth = await probeCopilotSdkAuth(timeout);
    if (!auth.ok) {
        if (isCopilotSdkCliNotFoundError(auth.error || '')) {
            return {
                ok: false,
                error: 'Copilot CLI runtime is missing or broken',
                details: `${auth.error}. Reinstall: npm install -g aicommit2 @github/copilot-sdk`,
            };
        }
        return {
            ok: false,
            error: 'Could not verify Copilot authentication',
            details: `${auth.error || 'auth probe failed'}. Run \`copilot\` to log in, or set COPILOT_GITHUB_TOKEN.`,
        };
    }
    if (!auth.authenticated) {
        return {
            ok: false,
            error: 'Copilot CLI installed but SDK is not authenticated',
            details: 'Run `copilot` to log in, `gh auth login --scopes copilot`, or set COPILOT_GITHUB_TOKEN (fine-grained PAT).',
        };
    }

    const normalizedModel = normalizeCopilotSdkModel(model);
    const isKnownModel = ALL_COPILOT_SDK_KNOWN_MODELS.includes(normalizedModel);
    const modelWarning = isKnownModel ? undefined : `Model '${model}' is not in the known working models list and may not work`;

    const authLabel = auth.authType ? `; Auth: ${auth.authType}` : '';
    return {
        ok: true,
        details: version
            ? `CLI: ${version}${authLabel}; Model: ${model}; Node: ${nodeVersion}`
            : `Model: ${model}${authLabel}; Node: ${nodeVersion}`,
        modelWarning,
    };
};

/**
 * Check health of a single provider
 */
const checkProviderHealth = async (provider: BuiltinService, providerConfig: RawConfig, timeout: number): Promise<ProviderHealthResult> => {
    // Special handling for Ollama
    if (provider === 'OLLAMA') {
        if (!hasConfiguredModels(providerConfig)) {
            return {
                provider,
                status: 'skipped',
                message: 'No models configured',
            };
        }

        const host = typeof providerConfig.host === 'string' && providerConfig.host.trim() ? providerConfig.host : DEFAULT_OLLAMA_HOST;
        const result = await checkOllamaConnection(host, timeout);

        if (!result.ok) {
            return {
                provider,
                status: 'warning',
                message: result.error || 'Connection failed',
                details: `Host: ${host}`,
            };
        }

        return {
            provider,
            status: 'healthy',
            message: 'Running',
            details: `Host: ${host}`,
        };
    }

    // Special handling for HuggingFace
    if (provider === 'HUGGINGFACE') {
        if (!providerConfig.cookie) {
            return {
                provider,
                status: 'skipped',
                message: 'No cookie configured',
            };
        }
        return {
            provider,
            status: 'healthy',
            message: 'Cookie configured',
        };
    }

    // Special handling for Bedrock
    // Note: Bedrock has default models, so we check credentials first
    if (provider === 'BEDROCK') {
        const hasCredentials = hasBedrockAccess(providerConfig);

        if (!hasCredentials) {
            return {
                provider,
                status: 'skipped',
                message: 'Not configured',
            };
        }

        return {
            provider,
            status: 'healthy',
            message: 'Credentials configured',
        };
    }

    if (provider === 'OPENROUTER') {
        if (!hasApiKey(providerConfig)) {
            return {
                provider,
                status: 'skipped',
                message: 'Not configured',
            };
        }

        const result = await checkOpenRouterConnection(providerConfig, timeout);

        if (!result.ok) {
            return {
                provider,
                status: 'warning',
                message: result.error || 'Catalog check failed',
                details: result.details,
            };
        }

        return {
            provider,
            status: 'healthy',
            message: 'Catalog reachable',
            details: result.details,
        };
    }

    if (provider === 'GITHUB_MODELS') {
        if (!hasApiKey(providerConfig)) {
            return {
                provider,
                status: 'skipped',
                message: 'Not configured',
            };
        }

        const result = await checkGitHubModelsConnection(providerConfig, timeout);
        if (!result.ok) {
            return {
                provider,
                status: 'warning',
                message: result.error || 'Connection check failed',
                details: result.details,
            };
        }

        return {
            provider,
            status: 'healthy',
            message: 'Models API reachable',
            details: result.details,
        };
    }

    if (provider === 'COPILOT_SDK') {
        // Opt-in is a model OR a key OR COPILOT_GITHUB_TOKEN — the same signal the
        // runtime uses (issue #254). Gating the skip on the model alone told a user who
        // opted in with a key or a token that nothing was configured (issue #268).
        if (!hasCopilotSdkAvailable(providerConfig)) {
            return {
                provider,
                status: 'skipped',
                message: 'Not configured (needs model, key, or COPILOT_GITHUB_TOKEN)',
            };
        }

        // Opted in, but the request fan-out is one request per configured model
        // (ai-request.manager.ts), so an empty model list sends nothing. The provider is
        // selected and still produces no suggestions — a warning, not healthy.
        if (getConfiguredModels(providerConfig).length === 0) {
            return {
                provider,
                status: 'warning',
                message: 'Opted in but no model configured — no requests will be sent',
                details: 'Set COPILOT_SDK.model (e.g. gpt-4.1)',
            };
        }

        const result = await checkCopilotSdkEnvironment(providerConfig, timeout);
        if (!result.ok) {
            return {
                provider,
                status: 'warning',
                message: result.error || 'Environment check failed',
                details: result.details,
            };
        }

        // Model warning is shown in `aicommit2 doctor` stdout alongside other provider health checks.
        if (result.modelWarning) {
            return {
                provider,
                status: 'warning',
                message: result.modelWarning,
                details: result.details,
            };
        }

        return {
            provider,
            status: 'healthy',
            message: 'SDK environment ready',
            details: result.details,
        };
    }

    // Subscription-CLI providers authenticate through their own CLI and never carry a
    // key, so a configured model is the opt-in signal (issue #254, mirrors the runtime
    // gate in get-available-ais.ts). Without this branch they fall through to the API
    // key check below and always report "Not configured", even while generation works
    // (issue #268). COPILOT_SDK is a member of the set too but returns from its own branch
    // above, so it never reaches here — the COPILOT_GITHUB_TOKEN test in tests/specs/doctor.ts
    // pins that ordering, since reaching this gate would report it as having no models.
    // Any future member lands on this model gate by default.
    if (SUBSCRIPTION_CLI_SERVICES.includes(provider)) {
        const models = getConfiguredModels(providerConfig);

        if (models.length === 0) {
            return {
                provider,
                status: 'skipped',
                message: 'No models configured',
            };
        }

        return {
            provider,
            status: 'healthy',
            message: 'Model configured',
            details: `Model: ${models.join(', ')}`,
        };
    }

    // Standard API key check for other providers
    if (!hasApiKey(providerConfig)) {
        return {
            provider,
            status: 'skipped',
            message: 'Not configured',
        };
    }

    // API key exists - mark as healthy (actual validation would require API calls)
    return {
        provider,
        status: 'healthy',
        message: 'API key configured',
    };
};

/**
 * Run health checks for all providers
 */
export const runHealthChecks = async (config: ValidConfig): Promise<ProviderHealthResult[]> => {
    const results: ProviderHealthResult[] = [];
    const timeout = config.timeout || 10000;

    for (const provider of BUILTIN_SERVICES) {
        const providerConfig = config[provider];

        if (!providerConfig || typeof providerConfig !== 'object') {
            results.push({
                provider,
                status: 'skipped',
                message: 'Not configured',
            });
            continue;
        }

        if (providerConfig.disabled) {
            results.push({
                provider,
                status: 'skipped',
                message: 'Disabled',
            });
            continue;
        }

        const result = await checkProviderHealth(provider, providerConfig, timeout);
        results.push(result);
    }

    return results;
};

/**
 * Check lazygit integration status
 */
export const checkLazygitIntegration = (): ProviderHealthResult => {
    if (!isLazygitInstalled()) {
        return {
            provider: 'LAZYGIT',
            status: 'skipped',
            message: 'lazygit not installed',
        };
    }

    const location = findLazygitConfig();
    if (!location.exists) {
        return {
            provider: 'LAZYGIT',
            status: 'warning',
            message: 'No lazygit config found',
            details: 'Run `aicommit2 setup lazygit` to configure',
        };
    }

    if (!hasAicommitIntegration(location.path)) {
        return {
            provider: 'LAZYGIT',
            status: 'warning',
            message: 'Integration not configured',
            details: 'Run `aicommit2 setup lazygit` to configure',
        };
    }

    return {
        provider: 'LAZYGIT',
        status: 'healthy',
        message: 'Integration configured',
        details: location.path,
    };
};

// Pre-calculate max provider name length for consistent formatting
const MAX_PROVIDER_LENGTH = Math.max(...BUILTIN_SERVICES.map(s => s.length));

const formatProviderName = (name: string): string => name.padEnd(MAX_PROVIDER_LENGTH);

/**
 * Print health check results to console
 */
const printResults = (results: ProviderHealthResult[], integrations: ProviderHealthResult[] = []): void => {
    console.log('');
    console.log(chalk.bold('🩺 aicommit2 Health Check'));
    console.log('');
    console.log(chalk.bold('Providers:'));

    const printResultLine = (result: ProviderHealthResult) => {
        const icon = STATUS_ICONS[result.status];
        const name = formatProviderName(result.provider);
        const message = STATUS_LABELS[result.status](result.message);
        const details = result.details ? chalk.gray(` (${result.details})`) : '';

        console.log(`  ${icon} ${name}  ${message}${details}`);
    };

    results.forEach(printResultLine);

    if (integrations.length > 0) {
        console.log('');
        console.log(chalk.bold('Integrations:'));
        integrations.forEach(printResultLine);
    }

    // Summary
    const allResults = [...results, ...integrations];
    const counts = {
        healthy: allResults.filter(r => r.status === 'healthy').length,
        error: allResults.filter(r => r.status === 'error').length,
        warning: allResults.filter(r => r.status === 'warning').length,
        skipped: allResults.filter(r => r.status === 'skipped').length,
    };

    console.log('');
    console.log(
        chalk.bold('Summary: ') +
            chalk.green(`${counts.healthy} healthy`) +
            ', ' +
            chalk.red(`${counts.error} error`) +
            ', ' +
            chalk.yellow(`${counts.warning} warning`) +
            ', ' +
            chalk.gray(`${counts.skipped} skipped`)
    );
    console.log('');

    // Exit code based on results
    if (counts.error > 0) {
        process.exitCode = 1;
    }
};

/**
 * Doctor command - health check for AI providers
 */
export const doctorCommand = command(
    {
        name: 'doctor',
        parameters: [],
        help: {
            description: 'Check health status of configured AI providers',
            examples: ['aicommit2 doctor'],
        },
    },
    () => {
        (async () => {
            const config = await getConfig({}, []);
            const results = await runHealthChecks(config);
            printResults(results, [checkLazygitIntegration()]);
        })().catch(error => {
            console.error(chalk.red(error.message));
            handleCliError(error);
            process.exit(1);
        });
    }
);
