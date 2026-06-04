import { parseBranchIntent } from './branch-intent.js';
import { analyzeConventions } from './convention.js';
import { extractTickets } from './ticket.js';

import type { CommitContext } from '../prompt.js';

export interface BuildCommitContextInput {
    branchName?: string;
    recentCommits?: string;
    /** Enable ticket extraction from the branch name (default: true) */
    ticketExtraction?: boolean;
    /** Enable repo-convention learning from recent commits (default: true) */
    learnConventions?: boolean;
}

/**
 * Assemble the enriched commit context from raw VCS signals.
 *
 * Raw inputs (branch name, recent commit subjects) are carried through
 * unchanged for backward compatibility; enriched fields are added only
 * when they yield a signal and their feature flag is enabled.
 */
export const buildCommitContext = (input: BuildCommitContextInput): CommitContext => {
    const { branchName = '', recentCommits = '', ticketExtraction = true, learnConventions = true } = input;

    const context: CommitContext = { recentCommits, branchName };

    if (ticketExtraction && branchName) {
        const tickets = extractTickets(branchName);
        if (tickets.length > 0) {
            context.tickets = tickets;
        }
    }

    const branchIntent = parseBranchIntent(branchName);
    if (branchIntent.type) {
        context.branchIntent = branchIntent;
    }

    if (learnConventions && recentCommits) {
        const profile = analyzeConventions(recentCommits.split('\n'));
        if (profile) {
            context.convention = profile;
        }
    }

    return context;
};
