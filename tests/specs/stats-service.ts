import { expect, testSuite } from 'manten';

// Direct import for unit testing
import { clearStats, getStatsSummary, hasStats, recordMetric } from '../../src/services/stats/index.js';

export default testSuite(({ describe }) => {
    describe('stats service', async ({ test }) => {
        // Note: These tests modify global stats file, run sequentially
        // Clear at start to ensure clean state

        test('hasStats returns false when no stats', async () => {
            await clearStats();
            const result = await hasStats();
            expect(result).toBe(false);
        });

        test('recordMetric adds a metric', async () => {
            await clearStats();

            await recordMetric({
                provider: 'OPENAI',
                model: 'gpt-4o-mini',
                responseTimeMs: 1500,
                success: true,
            });

            const result = await hasStats();
            expect(result).toBe(true);
            await clearStats();
        });

        test('clearStats removes all data', async () => {
            await clearStats();

            await recordMetric({
                provider: 'TEST',
                model: 'test-model',
                responseTimeMs: 100,
                success: true,
            });

            expect(await hasStats()).toBe(true);

            await clearStats();

            expect(await hasStats()).toBe(false);
        });

        test('getStatsSummary filters by days', async () => {
            await clearStats();

            await recordMetric({
                provider: 'OPENAI',
                model: 'gpt-4o-mini',
                responseTimeMs: 1000,
                success: true,
            });

            // With 30 days, should include the metric
            const summary30Days = await getStatsSummary(30);
            expect(summary30Days.totalRequests).toBeGreaterThanOrEqual(1);

            await clearStats();
        });

        test('getStatsSummary returns correct data', async () => {
            await clearStats();

            // Add some test metrics
            await recordMetric({
                provider: 'OPENAI',
                model: 'gpt-4o-mini',
                responseTimeMs: 1000,
                success: true,
            });

            await recordMetric({
                provider: 'OPENAI',
                model: 'gpt-4o-mini',
                responseTimeMs: 2000,
                success: true,
            });

            await recordMetric({
                provider: 'ANTHROPIC',
                model: 'claude-sonnet-4',
                responseTimeMs: 1500,
                success: false,
                errorCode: 'TIMEOUT',
            });

            const summary = await getStatsSummary(30);

            expect(summary.totalRequests).toBe(3);
            expect(summary.providerStats.length).toBe(2);

            // Find OPENAI stats
            const openaiStats = summary.providerStats.find(p => p.provider === 'OPENAI');
            expect(openaiStats?.totalRequests).toBe(2);
            expect(openaiStats?.successCount).toBe(2);
            expect(openaiStats?.avgResponseTimeMs).toBe(1500);

            // Find ANTHROPIC stats
            const anthropicStats = summary.providerStats.find(p => p.provider === 'ANTHROPIC');
            expect(anthropicStats?.totalRequests).toBe(1);
            expect(anthropicStats?.failureCount).toBe(1);

            await clearStats();
        });
    });
});
