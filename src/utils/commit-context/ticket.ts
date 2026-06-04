import { TicketKind, TicketRef } from './types.js';

// Each source: how to find an id in a branch name and how to phrase its footer.
// Issue-tracker key (PROJ-123, ENG-45 — JIRA / Linear share this shape) and
// GitHub-style numeric reference (#42). Both `/g` regexes are read via
// String.match, which ignores lastIndex — safe to share at module scope.
const SOURCES: { pattern: RegExp; kind: TicketKind; hint: (id: string) => string }[] = [
    { pattern: /\b[A-Z]{2,}-\d+\b/g, kind: 'key', hint: id => `Refs ${id}` },
    { pattern: /#\d+\b/g, kind: 'github', hint: id => `Closes ${id}` },
];

/**
 * Extract ticket references from a branch name.
 *
 * Pure derivation — no false-positive recovery beyond de-duplication.
 * Returns an empty array when the branch carries no recognizable ticket.
 */
export const extractTickets = (branchName: string): TicketRef[] => {
    if (!branchName) {
        return [];
    }

    const seen = new Set<string>();
    const tickets: TicketRef[] = [];

    for (const { pattern, kind, hint } of SOURCES) {
        for (const id of branchName.match(pattern) || []) {
            if (seen.has(id)) {
                continue;
            }
            seen.add(id);
            tickets.push({ id, kind, footerHint: hint(id) });
        }
    }

    return tickets;
};
