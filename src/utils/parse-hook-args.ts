/**
 * Flags known to accept a value argument (e.g., `--type conventional`, `-l ko`).
 * Boolean flags like `--verbose`, `--pre-commit` are NOT listed here
 * so their next argument won't be accidentally consumed.
 */
const VALUE_FLAGS = new Set(['--locale', '-l', '--generate', '-g', '--type', '-t', '--prompt', '--exclude', '-x', '--output']);

/**
 * Extract positional arguments from raw CLI args, skipping all flags and their values.
 *
 * Used by hook entry points (pre-commit, prepare-commit-msg) to reliably
 * extract `[messageFilePath, commitSource]` from `process.argv` regardless
 * of which CLI flags are present.
 *
 * @param rawArgs  - `process.argv.slice(2)`
 * @param skipFlags - Boolean flags to ignore entirely (e.g., `['--pre-commit', '--hook-mode']`)
 */
export const parseHookPositionalArgs = (rawArgs: string[], skipFlags: string[] = []): string[] => {
    const skipSet = new Set(skipFlags);
    const positionalArgs: string[] = [];
    let skipNext = false;

    for (let i = 0; i < rawArgs.length; i++) {
        const arg = rawArgs[i];

        if (skipNext) {
            skipNext = false;
            continue;
        }

        // Skip known boolean flags (e.g., --pre-commit, --hook-mode)
        if (skipSet.has(arg)) {
            continue;
        }

        if (arg.startsWith('-')) {
            // Value-bearing flags consume the next arg (e.g., --type conventional)
            // Flags with `=` (e.g., --type=conventional) are self-contained — no skip needed
            if (VALUE_FLAGS.has(arg) && !arg.includes('=')) {
                skipNext = true;
            }
            continue;
        }

        positionalArgs.push(arg);
    }

    return positionalArgs;
};
