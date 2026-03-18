import chalk from 'chalk';
import { command } from 'cleye';

import { type ProviderStats, clearStats, getStatsSummary, hasStats } from '../services/stats/index.js';
import { handleCliError } from '../utils/error.js';

const PROGRESS_BAR_WIDTH = 20;

/**
 * Format milliseconds to human-readable string
 */
const formatTime = (ms: number): string => {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * Format date to locale string
 */
const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString();
};

/**
 * Generate a progress bar string with color based on percentage
 */
const createProgressBar = (percentage: number): string => {
    const filled = Math.round((percentage / 100) * PROGRESS_BAR_WIDTH);
    const empty = PROGRESS_BAR_WIDTH - filled;

    // Color based on success rate: green (≥80%), yellow (50-79%), red (<50%)
    const barColor = percentage >= 80 ? chalk.green : percentage >= 50 ? chalk.yellow : chalk.red;
    return barColor('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
};

/**
 * Print provider statistics row
 */
const printProviderRow = (stats: ProviderStats): void => {
    const successRate = stats.totalRequests > 0 ? Math.round((stats.successCount / stats.totalRequests) * 100) : 0;
    const bar = createProgressBar(successRate);

    const providerName = stats.provider.padEnd(14);
    const successRateStr = `${successRate}%`.padStart(4);
    const requestCount = `${stats.totalRequests}`.padStart(4);
    const selectedCount = `${stats.selectedCount}`.padStart(4);
    const selectionRateStr = stats.selectionRate > 0 ? `(${stats.selectionRate}%)`.padStart(7) : ''.padStart(7);
    const avgTime = formatTime(stats.avgResponseTimeMs).padStart(6);

    console.log(
        `  ${chalk.bold(providerName)} ${successRateStr}  ${bar}  ${requestCount}  ${chalk.cyan(selectedCount)} ${chalk.gray(selectionRateStr)}  ${avgTime}`
    );
};

/**
 * Display statistics summary
 */
const showStats = async (days: number): Promise<void> => {
    const hasData = await hasStats();

    if (!hasData) {
        console.log(chalk.yellow('\nNo statistics recorded yet.'));
        console.log(chalk.gray('Statistics will be collected as you generate commit messages.\n'));
        return;
    }

    const summary = await getStatsSummary(days);

    if (summary.totalRequests === 0) {
        console.log(chalk.yellow(`\nNo statistics in the last ${days} days.\n`));
        return;
    }

    console.log('');
    console.log(chalk.bold(`📊 AICommit2 Statistics`));
    console.log(chalk.gray(`   Period: ${formatDate(summary.periodStart)} - ${formatDate(summary.periodEnd)}`));
    console.log('');

    // Overall summary
    console.log(chalk.bold('Overview:'));
    console.log(`  Total requests:     ${chalk.cyan(summary.totalRequests)}`);
    console.log(`  Success rate:       ${chalk.green(summary.successRate + '%')}`);
    console.log(`  Avg response time:  ${chalk.yellow(formatTime(summary.avgResponseTimeMs))}`);
    console.log('');

    // Provider breakdown
    if (summary.providerStats.length > 0) {
        console.log(chalk.bold('Provider Usage:'));
        // Match exact spacing of data row: 2 + 14 + 1 + 4 + 2 + 20 + 2 + 4 + 2 + 4 + 1 + 7 + 2 + 6
        console.log(chalk.gray('  Provider       Rate  Bar                    Cnt  Selected        Time'));

        for (const providerStats of summary.providerStats) {
            printProviderRow(providerStats);
        }
        console.log('');
    }
};

/**
 * Clear all statistics
 */
const handleClear = async (): Promise<void> => {
    await clearStats();
    console.log(chalk.green('\nStatistics cleared successfully.\n'));
};

export const statsCommand = command(
    {
        name: 'stats',
        parameters: ['[action]'],
        flags: {
            days: {
                type: Number,
                description: 'Number of days to include in statistics (default: 30)',
                alias: 'd',
                default: 30,
            },
        },
        help: {
            description: 'View AI request statistics and performance metrics',
            examples: [
                'aicommit2 stats           Show statistics for last 30 days',
                'aicommit2 stats -d 7      Show statistics for last 7 days',
                'aicommit2 stats clear     Clear all statistics',
            ],
        },
    },
    argv => {
        (async () => {
            const action = argv._[0] as string | undefined;
            const { days } = argv.flags;

            switch (action) {
                case 'clear':
                    await handleClear();
                    break;
                default:
                    await showStats(days);
                    break;
            }
        })().catch(error => {
            console.error(chalk.red(error.message));
            handleCliError(error);
            process.exit(1);
        });
    }
);
