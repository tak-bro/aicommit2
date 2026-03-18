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
