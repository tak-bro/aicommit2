import { DEFAULT_DIFF_CONTEXT } from '../diff-compressor.js';
import { defaultGitExcludePathspecs, toGitExcludePathspec } from './default-excludes.js';

import type { DiffOptions, VCSDiff } from './base.adapter.js';

interface StatusEntry {
    status: string;
    path: string;
}

const STATUS_VERBS: Record<string, string> = {
    A: 'added',
    M: 'modified',
    D: 'deleted',
    R: 'renamed',
    C: 'copied',
    T: 'type changed',
};

const toVerb = (status: string) => STATUS_VERBS[status.charAt(0)] ?? 'changed';

/**
 * `--name-status -z`: `M\0path\0`, or `R100\0old\0new\0` for renames and copies.
 * The new path is the key, matching numstat.
 */
const parseNameStatus = (output: string): StatusEntry[] => {
    const fields = output.split('\0');
    const entries: StatusEntry[] = [];
    let index = 0;
    while (index < fields.length && fields[index]) {
        const status = fields[index];
        const hasTwoPaths = status.startsWith('R') || status.startsWith('C');
        const path = hasTwoPaths ? fields[index + 2] : fields[index + 1];
        entries.push({ status, path });
        index += hasTwoPaths ? 3 : 2;
    }
    return entries;
};

/**
 * `--numstat -z`: `added\tdeleted\tpath\0`, or `added\tdeleted\t\0old\0new\0` for renames.
 * Binary files report `-\t-`. Returns path → isBinary.
 */
const parseNumstat = (output: string): Map<string, boolean> => {
    const fields = output.split('\0');
    const files = new Map<string, boolean>();
    let index = 0;
    while (index < fields.length && fields[index]) {
        // Split on the first two tabs only: a path may itself contain tabs
        const field = fields[index];
        const firstTab = field.indexOf('\t');
        const secondTab = field.indexOf('\t', firstTab + 1);
        const added = field.slice(0, firstTab);
        const deleted = field.slice(firstTab + 1, secondTab);
        const path = field.slice(secondTab + 1);
        const isBinary = added === '-' && deleted === '-';
        if (path) {
            files.set(path, isBinary);
            index += 1;
        } else {
            files.set(fields[index + 2], isBinary);
            index += 3;
        }
    }
    return files;
};

/**
 * Builds the model's view of a change from three git outputs:
 * - `nameStatusZ`: every changed file (user excludes applied, default excludes not)
 * - `numstatZ` and `diff`: the files whose content is shown (default excludes applied too)
 *
 * Files only in the first set had their diff omitted as lockfile/generated, and are listed by name.
 */
export const assembleDiff = ({ nameStatusZ, numstatZ, diff }: { nameStatusZ: string; numstatZ: string; diff: string }): VCSDiff | null => {
    const entries = parseNameStatus(nameStatusZ);
    if (entries.length === 0) {
        return null;
    }

    const shown = parseNumstat(numstatZ);
    const binaryEntries = entries.filter(entry => shown.get(entry.path) === true);
    const omittedEntries = entries.filter(entry => !shown.has(entry.path));

    let assembled = diff.trim() ? diff : '';
    if (binaryEntries.length > 0) {
        assembled += '\n\n--- Binary Files Changed ---\n';
        assembled += binaryEntries.map(entry => `Binary file ${entry.path} ${toVerb(entry.status)}\n`).join('');
    }
    if (omittedEntries.length > 0) {
        assembled += '\n\n--- Files Changed (diff omitted: lockfile/generated) ---\n';
        assembled += omittedEntries.map(entry => `${entry.path} ${toVerb(entry.status)}\n`).join('');
    }

    const files = entries.map(entry => entry.path);
    return {
        files,
        diff: assembled || `Files changed: ${files.join(', ')}`,
        ...(omittedEntries.length > 0 ? { omittedFiles: omittedEntries.map(entry => entry.path) } : {}),
    };
};

type RunGit = (args: string[]) => Promise<{ stdout: string }>;

interface DiffRequest {
    excludeFiles?: string[];
    exclude?: string[];
    options?: DiffOptions;
}

const excludeArgs = ({ excludeFiles, exclude, options }: DiffRequest) => {
    const user = [...(excludeFiles ?? []), ...(exclude ?? [])].map(toGitExcludePathspec);
    return {
        user,
        shown: [...defaultGitExcludePathspecs(options?.includeGenerated), ...user],
        context: `-U${options?.diffContext ?? DEFAULT_DIFF_CONTEXT}`,
    };
};

/**
 * Three views in parallel: every changed file (user excludes only), and the diff plus numstat
 * of the files whose content is shown (default excludes too). Shared by the git and yadm
 * adapters, which differ only in the binary `run` invokes.
 */
export const readStagedDiff = async (run: RunGit, request: DiffRequest): Promise<VCSDiff | null> => {
    const { user, shown, context } = excludeArgs(request);
    const [nameStatus, diff, numstat] = await Promise.all([
        run(['diff', '--cached', '--name-status', '-z', ...user]),
        run(['diff', '--cached', '--diff-algorithm=minimal', context, ...shown]),
        run(['diff', '--cached', '--numstat', '-z', ...shown]),
    ]);
    return assembleDiff({ nameStatusZ: nameStatus.stdout, numstatZ: numstat.stdout, diff: diff.stdout });
};

export const readCommitDiff = async (run: RunGit, commitHash: string, request: DiffRequest): Promise<VCSDiff | null> => {
    const { user, shown, context } = excludeArgs(request);
    const [nameStatus, diff, numstat] = await Promise.all([
        run(['diff-tree', '-r', '--no-commit-id', '--name-status', '-z', commitHash, '--', ...user]),
        run(['show', context, commitHash, '--', ...shown]),
        run(['diff-tree', '-r', '--no-commit-id', '--numstat', '-z', commitHash, '--', ...shown]),
    ]);
    return assembleDiff({ nameStatusZ: nameStatus.stdout, numstatZ: numstat.stdout, diff: diff.stdout });
};
