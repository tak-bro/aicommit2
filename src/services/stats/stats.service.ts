import fs from 'fs/promises';
import path from 'path';

import {
    ProviderStats,
    RecordMetricOptions,
    RecordSelectionOptions,
    RequestMetric,
    SelectionMetric,
    StatsData,
    StatsSummary,
} from './stats.types.js';
import { AICOMMIT_CONFIG_DIR } from '../../utils/config.js';
import { fileExists } from '../../utils/fs.js';

const STATS_FILE = 'stats.json';
const STATS_VERSION = 2;
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
        return { version: STATS_VERSION, metrics: [], selections: [] };
    }

    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content) as StatsData;

        // Handle version migration if needed
        if (!data.version || data.version < STATS_VERSION) {
            return {
                version: STATS_VERSION,
                metrics: data.metrics || [],
                selections: data.selections || [], // v1 → v2 migration: add empty selections
            };
        }

        return data;
    } catch {
        return { version: STATS_VERSION, metrics: [], selections: [] };
    }
};

/**
 * Filter out data older than the specified days
 */
const cleanupOldData = (data: StatsData, days: number): StatsData => {
    const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
    return {
        version: data.version,
        metrics: data.metrics.filter(m => m.timestamp >= cutoffTime),
        selections: data.selections.filter(s => s.timestamp >= cutoffTime),
    };
};

/**
 * Write stats data to file with optional auto-cleanup
 */
const writeStatsData = async (data: StatsData, statsDays?: number): Promise<void> => {
    const filePath = getStatsFilePath();
    const dir = path.dirname(filePath);

    // Auto-cleanup old data if statsDays is specified
    const dataToWrite = statsDays ? cleanupOldData(data, statsDays) : data;

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(dataToWrite, null, 2), 'utf-8');
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

    await writeStatsData(data, options.statsDays);
};

/**
 * Record a user selection
 */
export const recordSelection = async (options: RecordSelectionOptions): Promise<void> => {
    const selection: SelectionMetric = {
        timestamp: Date.now(),
        provider: options.provider,
        model: options.model,
    };

    const data = await readStatsData();
    data.selections.push(selection);

    await writeStatsData(data, options.statsDays);
};

/**
 * Calculate stats for a single provider
 */
const calculateProviderStats = (provider: string, metrics: RequestMetric[], selections: SelectionMetric[]): ProviderStats => {
    const providerMetrics = metrics.filter(m => m.provider === provider);
    const providerSelections = selections.filter(s => s.provider === provider);

    if (providerMetrics.length === 0) {
        return {
            provider,
            totalRequests: 0,
            successCount: 0,
            failureCount: 0,
            selectedCount: providerSelections.length,
            selectionRate: 0,
            avgResponseTimeMs: 0,
            minResponseTimeMs: 0,
            maxResponseTimeMs: 0,
        };
    }

    const successMetrics = providerMetrics.filter(m => m.success);
    const responseTimes = providerMetrics.map(m => m.responseTimeMs);
    const selectedCount = providerSelections.length;
    const selectionRate = successMetrics.length > 0 ? Math.min(100, Math.round((selectedCount / successMetrics.length) * 1000) / 10) : 0;

    return {
        provider,
        totalRequests: providerMetrics.length,
        successCount: successMetrics.length,
        failureCount: providerMetrics.length - successMetrics.length,
        selectedCount,
        selectionRate,
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
    const filteredSelections = data.selections.filter(s => s.timestamp >= cutoffTime);

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

    // Get unique providers (selections can only exist for providers with metrics)
    const providers = [...new Set(filteredMetrics.map(m => m.provider))];
    const providerStats = providers
        .map(provider => calculateProviderStats(provider, filteredMetrics, filteredSelections))
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
