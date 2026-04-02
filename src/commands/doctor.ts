import chalk from 'chalk';
import { command } from 'cleye';

import { hasBedrockAccess, hasConfiguredModels } from './get-available-ais.js';
import { HttpRequestBuilder } from '../services/http/http-request.builder.js';
import { BUILTIN_SERVICES, BuiltinService, DEFAULT_OLLAMA_HOST, RawConfig, ValidConfig, getConfig } from '../utils/config.js';
import { handleCliError } from '../utils/error.js';

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

const hasConfiguredModel = (value: RawConfig): boolean => {
    const models = Array.isArray(value.model)
        ? (value.model as string[])
        : typeof value.model === 'string' && value.model.trim().length > 0
          ? [(value.model as string).trim()]
          : [];
    return models.length > 0;
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

        const configuredModels = hasConfiguredModel(providerConfig)
            ? Array.isArray(providerConfig.model)
                ? (providerConfig.model as string[])
                : [providerConfig.model as string]
            : [];

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

// Pre-calculate max provider name length for consistent formatting
const MAX_PROVIDER_LENGTH = Math.max(...BUILTIN_SERVICES.map(s => s.length));

const formatProviderName = (name: string): string => name.padEnd(MAX_PROVIDER_LENGTH);

/**
 * Print health check results to console
 */
const printResults = (results: ProviderHealthResult[]): void => {
    console.log('');
    console.log(chalk.bold('🩺 aicommit2 Health Check'));
    console.log('');
    console.log(chalk.bold('Providers:'));

    for (const result of results) {
        const icon = STATUS_ICONS[result.status];
        const name = formatProviderName(result.provider);
        const message = STATUS_LABELS[result.status](result.message);
        const details = result.details ? chalk.gray(` (${result.details})`) : '';

        console.log(`  ${icon} ${name}  ${message}${details}`);
    }

    // Summary
    const counts = {
        healthy: results.filter(r => r.status === 'healthy').length,
        error: results.filter(r => r.status === 'error').length,
        warning: results.filter(r => r.status === 'warning').length,
        skipped: results.filter(r => r.status === 'skipped').length,
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
            printResults(results);
        })().catch(error => {
            console.error(chalk.red(error.message));
            handleCliError(error);
            process.exit(1);
        });
    }
);
