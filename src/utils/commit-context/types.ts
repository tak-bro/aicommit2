/**
 * Context-enrichment domain types.
 *
 * These describe the *engineered input* derived from raw VCS signals
 * (branch name, recent commit subjects) before it reaches the model.
 * Kept free of runtime imports so prompt.ts can reference them via
 * `import type` without creating a module cycle.
 */

export type TicketKind = 'key' | 'github';

export interface TicketRef {
    /** Raw ticket identifier, e.g. "PROJ-123" or "#42" */
    id: string;
    kind: TicketKind;
    /** Suggested footer line, e.g. "Refs PROJ-123" or "Closes #42" */
    footerHint: string;
}

export type ConventionStyle = 'conventional' | 'gitmoji';

export interface ConventionProfile {
    /** Predominant style across recent commits, null when no clear signal */
    dominantType: ConventionStyle | null;
    /** Count of each conventional type seen (feat, fix, ...) */
    typeDistribution: Record<string, number>;
    /** Most frequent scopes, highest first (max 5) */
    commonScopes: string[];
    /** Mean subject length in characters */
    avgSubjectLength: number;
}

export interface BranchIntent {
    /** Commit type inferred from the branch prefix, null when none */
    type: string | null;
    /** Raw prefix segment, e.g. "feature", "hotfix" */
    rawPrefix: string;
}
