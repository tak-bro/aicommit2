import { expect, testSuite } from 'manten';

import { analyzeConventions, buildCommitContext, extractTickets, parseBranchIntent } from '../../../src/utils/commit-context/index.js';

export default testSuite(({ describe }) => {
    describe('Commit Context', ({ describe }) => {
        describe('extractTickets', ({ test }) => {
            test('extracts JIRA/Linear-style key from branch', () => {
                const tickets = extractTickets('feature/PROJ-123-add-login');
                expect(tickets.length).toBe(1);
                expect(tickets[0].id).toBe('PROJ-123');
                expect(tickets[0].kind).toBe('key');
                expect(tickets[0].footerHint).toBe('Refs PROJ-123');
            });

            test('extracts GitHub-style numeric reference', () => {
                const tickets = extractTickets('fix/#42-null-check');
                expect(tickets[0].id).toBe('#42');
                expect(tickets[0].kind).toBe('github');
                expect(tickets[0].footerHint).toBe('Closes #42');
            });

            test('returns empty for branch without ticket', () => {
                expect(extractTickets('feature/improve-aic2').length).toBe(0);
            });

            test('ignores version-tag-like segments (V2-0)', () => {
                expect(extractTickets('release/V2-0').length).toBe(0);
            });

            test('returns empty for empty branch', () => {
                expect(extractTickets('').length).toBe(0);
            });

            test('de-duplicates repeated ids', () => {
                const tickets = extractTickets('ENG-7/ENG-7-retry');
                expect(tickets.length).toBe(1);
            });
        });

        describe('parseBranchIntent', ({ test }) => {
            test('maps feature/ prefix to feat', () => {
                expect(parseBranchIntent('feature/improve-aic2').type).toBe('feat');
            });

            test('maps hotfix/ and bugfix/ to fix', () => {
                expect(parseBranchIntent('hotfix/login').type).toBe('fix');
                expect(parseBranchIntent('bugfix/crash').type).toBe('fix');
            });

            test('returns null type for unknown prefix', () => {
                const intent = parseBranchIntent('main');
                expect(intent.type).toBe(null);
                expect(intent.rawPrefix).toBe('main');
            });

            test('handles empty branch', () => {
                expect(parseBranchIntent('').type).toBe(null);
            });
        });

        describe('analyzeConventions', ({ test }) => {
            test('returns null for no subjects', () => {
                expect(analyzeConventions([])).toBe(null);
                expect(analyzeConventions(['', '  '])).toBe(null);
            });

            test('returns null for unstructured history (no learnable convention)', () => {
                expect(analyzeConventions(['update stuff', 'wip', 'more changes'])).toBe(null);
            });

            test('detects conventional dominance and type distribution', () => {
                const profile = analyzeConventions(['feat(auth): add login', 'fix(api): handle null', 'feat(ui): add button']);
                expect(profile?.dominantType).toBe('conventional');
                expect(profile?.typeDistribution.feat).toBe(2);
                expect(profile?.typeDistribution.fix).toBe(1);
            });

            test('collects common scopes', () => {
                const profile = analyzeConventions(['feat(auth): a', 'fix(auth): b', 'docs(api): c']);
                expect(profile?.commonScopes[0]).toBe('auth');
            });

            test('computes average subject length', () => {
                // lengths 8 and 12 → avg 10 (subjects must be structured to yield a profile)
                const profile = analyzeConventions(['feat: xx', 'feat: xxxxxx']);
                expect(profile?.avgSubjectLength).toBe(10);
            });

            test('detects gitmoji dominance', () => {
                const profile = analyzeConventions([':sparkles: add chat', ':bug: fix crash']);
                expect(profile?.dominantType).toBe('gitmoji');
            });
        });

        describe('buildCommitContext', ({ test }) => {
            test('assembles enriched context from raw signals', () => {
                const context = buildCommitContext({
                    branchName: 'feature/PROJ-9-login',
                    recentCommits: 'feat(auth): add login\nfix(api): handle null',
                });
                expect(context.tickets?.[0].id).toBe('PROJ-9');
                expect(context.branchIntent?.type).toBe('feat');
                expect(context.convention?.dominantType).toBe('conventional');
                expect(context.recentCommits).toBe('feat(auth): add login\nfix(api): handle null');
            });

            test('respects disabled feature flags', () => {
                const context = buildCommitContext({
                    branchName: 'feature/PROJ-9-login',
                    recentCommits: 'feat(auth): add login',
                    ticketExtraction: false,
                    learnConventions: false,
                });
                expect(context.tickets).toBe(undefined);
                expect(context.convention).toBe(undefined);
                // branch intent is always on (harmless hint)
                expect(context.branchIntent?.type).toBe('feat');
            });

            test('omits enriched fields when no signal', () => {
                const context = buildCommitContext({ branchName: 'main', recentCommits: '' });
                expect(context.tickets).toBe(undefined);
                expect(context.convention).toBe(undefined);
                expect(context.branchIntent).toBe(undefined);
            });
        });
    });
});
