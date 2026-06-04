import { ConventionProfile, ConventionStyle } from './types.js';

// conventional: "feat(scope): ..." / "fix!: ..." — capture type + optional scope.
const CONVENTIONAL_PATTERN = /^(\w+)(?:\(([\w\-./]+)\))?!?:\s/;
// gitmoji: leading ":sparkles:" shortcode or a unicode emoji.
const GITMOJI_PATTERN = /^(:\w+:|\p{Extended_Pictographic})/u;

const MAX_SCOPES = 5;

const topKeys = (counts: Record<string, number>, limit: number): string[] =>
    Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key]) => key);

const dominantStyle = (conventionalCount: number, gitmojiCount: number, total: number): ConventionStyle | null => {
    const threshold = total / 2;
    if (conventionalCount > gitmojiCount && conventionalCount >= threshold) {
        return 'conventional';
    }
    if (gitmojiCount > conventionalCount && gitmojiCount >= threshold) {
        return 'gitmoji';
    }
    return null;
};

/**
 * Distill a style profile from recent commit subjects.
 *
 * Subjects-only (v1): body-usage signal is intentionally omitted.
 * Returns null when there are no subjects to learn from.
 */
export const analyzeConventions = (subjects: string[]): ConventionProfile | null => {
    const cleaned = subjects.map(subject => subject.trim()).filter(Boolean);
    if (cleaned.length === 0) {
        return null;
    }

    const typeDistribution: Record<string, number> = {};
    const scopeCounts: Record<string, number> = {};
    let conventionalCount = 0;
    let gitmojiCount = 0;
    let lengthSum = 0;

    for (const subject of cleaned) {
        lengthSum += subject.length;

        const conventionalMatch = subject.match(CONVENTIONAL_PATTERN);
        if (conventionalMatch) {
            conventionalCount++;
            const [, type, scope] = conventionalMatch;
            typeDistribution[type] = (typeDistribution[type] || 0) + 1;
            if (scope) {
                scopeCounts[scope] = (scopeCounts[scope] || 0) + 1;
            }
            continue;
        }

        if (GITMOJI_PATTERN.test(subject)) {
            gitmojiCount++;
        }
    }

    const dominantType = dominantStyle(conventionalCount, gitmojiCount, cleaned.length);

    // No learnable convention (unstructured history) — subject length alone
    // isn't an actionable style signal, so report nothing rather than a
    // hollow "match these" section.
    const hasSignal = dominantType !== null || Object.keys(typeDistribution).length > 0;
    if (!hasSignal) {
        return null;
    }

    return {
        dominantType,
        typeDistribution,
        commonScopes: topKeys(scopeCounts, MAX_SCOPES),
        avgSubjectLength: Math.round(lengthSum / cleaned.length),
    };
};
