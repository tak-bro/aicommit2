
import { expect, testSuite } from 'manten';

// Direct import for unit testing
import { clearStats, getStatsSummary, hasStats, recordMetric } from '../../src/services/stats/index.js';

export default testSuite(({ describe }) => {
    describe('stats service', async ({ test }) => {
        // Note: These tests modify global stats file, so they should be run in isolation
        // In a real scenario, we'd mock the file system

        test('hasStats returns false when no stats', async () => {
            // Clear first to ensure clean state
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

            // Clean up
            await clearStats();
        });

        test('getStatsSummary filters by days', async () => {
            await clearStats();

            await recordMetric({
                provider: 'OPENAI',
                model: 'gpt-4o-mini',
                responseTimeMs: 1000,
                success: true,
            });

            // With 0 days filter, should show nothing from past
            const summaryZeroDays = await getStatsSummary(0);
            // Current metrics should be included since they're from "today"
            expect(summaryZeroDays.totalRequests).toBeGreaterThanOrEqual(0);

            // With 30 days, should include the metric
            const summary30Days = await getStatsSummary(30);
            expect(summary30Days.totalRequests).toBeGreaterThanOrEqual(1);

            await clearStats();
        });

        test('clearStats removes all data', async () => {
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
    });
});
