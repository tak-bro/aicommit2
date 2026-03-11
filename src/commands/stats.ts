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
 * Generate a progress bar string
 */
const createProgressBar = (percentage: number): string => {
    const filled = Math.round((percentage / 100) * PROGRESS_BAR_WIDTH);
    const empty = PROGRESS_BAR_WIDTH - filled;
    return chalk.cyan('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
};

/**
 * Print provider statistics row
 */
const printProviderRow = (stats: ProviderStats, maxRequests: number): void => {
    const percentage = Math.round((stats.totalRequests / maxRequests) * 100);
    const bar = createProgressBar(percentage);
    const successRate = stats.totalRequests > 0 ? Math.round((stats.successCount / stats.totalRequests) * 100) : 0;

    const providerName = stats.provider.padEnd(14);
    const requestCount = `${stats.totalRequests}`.padStart(4);
    const percentStr = `(${percentage}%)`.padStart(6);
    const avgTime = formatTime(stats.avgResponseTimeMs).padStart(6);
    const successStr = `${successRate}%`.padStart(4);

    console.log(`  ${chalk.bold(providerName)} ${bar} ${requestCount} ${chalk.gray(percentStr)}  ${avgTime}  ${chalk.green(successStr)}`);
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
        const maxRequests = Math.max(...summary.providerStats.map(p => p.totalRequests));

        console.log(chalk.bold('Provider Usage:'));
        console.log(chalk.gray('                                                      Avg    Success'));
        console.log(chalk.gray('  Provider       Progress             Count           Time   Rate'));

        for (const providerStats of summary.providerStats) {
            printProviderRow(providerStats, maxRequests);
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
