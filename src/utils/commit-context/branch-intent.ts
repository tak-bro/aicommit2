import { BranchIntent } from './types.js';

// Branch prefix → conventional commit type.
const PREFIX_TO_TYPE: Record<string, string> = {
    feat: 'feat',
    feature: 'feat',
    fix: 'fix',
    bugfix: 'fix',
    hotfix: 'fix',
    docs: 'docs',
    doc: 'docs',
    refactor: 'refactor',
    perf: 'perf',
    test: 'test',
    tests: 'test',
    chore: 'chore',
    ci: 'ci',
    build: 'build',
    style: 'style',
};

/**
 * Infer commit intent from a branch name's leading segment.
 *
 * `feature/improve-aic2` → feat, `hotfix/login` → fix, `main` → null.
 */
export const parseBranchIntent = (branchName: string): BranchIntent => {
    const empty: BranchIntent = { type: null, rawPrefix: '' };
    if (!branchName) {
        return empty;
    }

    const rawPrefix = branchName.split('/')[0].toLowerCase();
    const type = PREFIX_TO_TYPE[rawPrefix] || null;

    return { type, rawPrefix };
};
