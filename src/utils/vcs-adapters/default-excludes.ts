/**
 * Files whose diff is noise to the model. In git and yadm their names still reach it (see
 * assemble-diff.ts), so a lockfile-only or generated-only change still gets a message.
 * Jujutsu drops them entirely (see jujutsu.adapter.ts).
 */
export const LOCK_FILE_PATTERNS = [
    'package-lock.json',
    'pnpm-lock.yaml',
    // yarn.lock, Cargo.lock, Gemfile.lock, Pipfile.lock, etc.
    '*.lock',
    '*.lockb',
];

// `dist/`-style directories stay in: some repos commit build output on purpose (GitHub Actions)
export const GENERATED_FILE_PATTERNS = ['*.min.js', '*.min.css', '*.map', '*.snap'];

export const defaultExcludePatterns = (includeGenerated = false): string[] =>
    includeGenerated ? LOCK_FILE_PATTERNS : [...LOCK_FILE_PATTERNS, ...GENERATED_FILE_PATTERNS];

export const toGitExcludePathspec = (path: string) => `:(exclude)${path}`;

/**
 * Git pathspecs for the default excludes. Pathspecs are cwd-relative by default, so `top` anchors
 * them at the repo root and `glob` with a leading `**` matches at any depth: run from a subdirectory,
 * root lockfiles still drop out, and so do nested ones like `packages/x/package-lock.json`.
 * `attr:` magic honors `linguist-generated` in .gitattributes, the repo's own statement of what
 * is generated (needs git >= 2.13). User `--exclude` paths stay cwd-relative, like git's own.
 */
export const defaultGitExcludePathspecs = (includeGenerated = false): string[] => [
    ...defaultExcludePatterns(includeGenerated).map(pattern => `:(top,exclude,glob)**/${pattern}`),
    ...(includeGenerated ? [] : [':(top,exclude,attr:linguist-generated)']),
];

/**
 * Jujutsu fileset terms for the default excludes. `glob:` is cwd-relative and matches one
 * directory level, so `root-glob:` with a leading `**` is the equivalent of git's `top,glob`.
 */
export const defaultJjExcludeFilesets = (includeGenerated = false): string[] =>
    defaultExcludePatterns(includeGenerated).map(pattern => `~root-glob:"**/${pattern}"`);
