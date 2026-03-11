import fs from 'fs/promises';
import path from 'path';

import { ProviderStats, RecordMetricOptions, RequestMetric, StatsData, StatsSummary } from './stats.types.js';
import { AICOMMIT_CONFIG_DIR } from '../../utils/config.js';
import { fileExists } from '../../utils/fs.js';

const STATS_FILE = 'stats.json';
const STATS_VERSION = 1;
const DEFAULT_DISPLAY_DAYS = 30;

/**
 * Get the path to the stats file
 */
const getStatsFilePath = (): string => {
    return path.join(AICOMMIT_CONFIG_DIR, STATS_FILE);
};

/**
 * Read stats data from file
 */
const readStatsData = async (): Promise<StatsData> => {
    const filePath = getStatsFilePath();

    if (!(await fileExists(filePath))) {
        return { version: STATS_VERSION, metrics: [] };
    }

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as StatsData;

        // Handle version migration if needed
        if (!data.version || data.version < STATS_VERSION) {
            return { version: STATS_VERSION, metrics: data.metrics || [] };
        }

        return data;
    } catch {
        return { version: STATS_VERSION, metrics: [] };
    }
};

/**
 * Write stats data to file
 */
const writeStatsData = async (data: StatsData): Promise<void> => {
    const filePath = getStatsFilePath();
    const dir = path.dirname(filePath);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
};

/**
 * Record a new metric
 */
export const recordMetric = async (options: RecordMetricOptions): Promise<void> => {
    const metric: RequestMetric = {
        timestamp: Date.now(),
        provider: options.provider,
        model: options.model,
        responseTimeMs: options.responseTimeMs,
        success: options.success,
        errorCode: options.errorCode,
        tokensUsed: options.tokensUsed,
    };

    const data = await readStatsData();
    data.metrics.push(metric);

    await writeStatsData(data);
};

/**
 * Calculate stats for a single provider
 */
const calculateProviderStats = (provider: string, metrics: RequestMetric[]): ProviderStats => {
    const providerMetrics = metrics.filter(m => m.provider === provider);

    if (providerMetrics.length === 0) {
        return {
            provider,
            totalRequests: 0,
            successCount: 0,
            failureCount: 0,
            avgResponseTimeMs: 0,
            minResponseTimeMs: 0,
            maxResponseTimeMs: 0,
        };
    }

    const successMetrics = providerMetrics.filter(m => m.success);
    const responseTimes = providerMetrics.map(m => m.responseTimeMs);

    return {
        provider,
        totalRequests: providerMetrics.length,
        successCount: successMetrics.length,
        failureCount: providerMetrics.length - successMetrics.length,
        avgResponseTimeMs: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
        minResponseTimeMs: Math.min(...responseTimes),
        maxResponseTimeMs: Math.max(...responseTimes),
    };
};

/**
 * Get statistics summary
 */
export const getStatsSummary = async (days: number = DEFAULT_DISPLAY_DAYS): Promise<StatsSummary> => {
    const data = await readStatsData();
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    const filteredMetrics = data.metrics.filter(m => m.timestamp >= cutoffTime);

    if (filteredMetrics.length === 0) {
        return {
            totalRequests: 0,
            successRate: 0,
            avgResponseTimeMs: 0,
            providerStats: [],
            periodStart: cutoffTime,
            periodEnd: Date.now(),
        };
    }

    // Get unique providers
    const providers = [...new Set(filteredMetrics.map(m => m.provider))];
    const providerStats = providers
        .map(provider => calculateProviderStats(provider, filteredMetrics))
        .sort((a, b) => b.totalRequests - a.totalRequests);

    const successCount = filteredMetrics.filter(m => m.success).length;
    const totalResponseTime = filteredMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0);

    return {
        totalRequests: filteredMetrics.length,
        successRate: Math.round((successCount / filteredMetrics.length) * 1000) / 10,
        avgResponseTimeMs: Math.round(totalResponseTime / filteredMetrics.length),
        providerStats,
        periodStart: Math.min(...filteredMetrics.map(m => m.timestamp)),
        periodEnd: Math.max(...filteredMetrics.map(m => m.timestamp)),
    };
};

/**
 * Clear all stats data
 */
export const clearStats = async (): Promise<void> => {
    const filePath = getStatsFilePath();

    if (await fileExists(filePath)) {
        await fs.unlink(filePath);
    }
};

/**
 * Check if stats file exists and has data
 */
export const hasStats = async (): Promise<boolean> => {
    const data = await readStatsData();
    return data.metrics.length > 0;
};
