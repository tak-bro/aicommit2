/**
 * Single metric entry for an AI request
 */
export interface RequestMetric {
    timestamp: number;
    provider: string;
    model: string;
    responseTimeMs: number;
    success: boolean;
    errorCode?: string;
    tokensUsed?: number;
}

/**
 * Aggregated stats for a provider
 */
export interface ProviderStats {
    provider: string;
    totalRequests: number;
    successCount: number;
    failureCount: number;
    avgResponseTimeMs: number;
    minResponseTimeMs: number;
    maxResponseTimeMs: number;
}

/**
 * Overall statistics summary
 */
export interface StatsSummary {
    totalRequests: number;
    successRate: number;
    avgResponseTimeMs: number;
    providerStats: ProviderStats[];
    periodStart: number;
    periodEnd: number;
}

/**
 * Persisted stats data structure
 */
export interface StatsData {
    version: number;
    metrics: RequestMetric[];
}

/**
 * Options for recording a metric
 */
export interface RecordMetricOptions {
    provider: string;
    model: string;
    responseTimeMs: number;
    success: boolean;
    errorCode?: string;
    tokensUsed?: number;
}
