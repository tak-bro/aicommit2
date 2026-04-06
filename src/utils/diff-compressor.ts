export type DiffCompressionMode = 'none' | 'compact';

export interface DiffCompressionConfig {
    mode: DiffCompressionMode;
    maxHunkLines: number; // 0 = unlimited
    maxDiffLines: number; // 0 = unlimited
}

export interface DiffCompressionStats {
    originalLines: number;
    compressedLines: number;
    truncatedHunks: number;
    truncatedFiles: number;
}

export interface CompressedDiff {
    diff: string;
    stats: DiffCompressionStats;
}

export interface DiffCompressionResult {
    originalChars: number;
    compressedChars: number;
    truncatedHunks: number;
    truncatedFiles: number;
}

export const DEFAULT_DIFF_CONTEXT = 3;

export const DEFAULT_DIFF_COMPRESSION_CONFIG: DiffCompressionConfig = {
    mode: 'compact',
    maxHunkLines: 200,
    maxDiffLines: 1000,
};

/**
 * Main entry point for diff compression.
 * Applies the selected compression mode to raw diff output.
 */
export const compressDiff = (raw: string, config: Partial<DiffCompressionConfig> = {}): CompressedDiff => {
    const resolved: DiffCompressionConfig = { ...DEFAULT_DIFF_COMPRESSION_CONFIG, ...config };
    const originalLines = raw.split('\n').length;

    if (resolved.mode === 'none' || !raw.trim()) {
        return {
            diff: raw,
            stats: { originalLines, compressedLines: originalLines, truncatedHunks: 0, truncatedFiles: 0 },
        };
    }

    return compactDiff(raw, resolved, originalLines);
};

/**
 * Compact mode: strip diff metadata headers, cap hunks, cap total lines.
 * Preserves +/- lines and context for AI commit message generation.
 */
const compactDiff = (raw: string, config: DiffCompressionConfig, originalLines: number): CompressedDiff => {
    const fileBlocks = splitIntoFileBlocks(raw);
    const outputLines: string[] = [];
    let truncatedHunks = 0;
    let truncatedFiles = 0;
    const maxDiffLines = config.maxDiffLines > 0 ? config.maxDiffLines : Infinity;
    const maxHunkLines = config.maxHunkLines > 0 ? config.maxHunkLines : Infinity;

    for (let i = 0; i < fileBlocks.length; i++) {
        if (outputLines.length >= maxDiffLines) {
            // All remaining files are fully omitted
            truncatedFiles += fileBlocks.length - i;
            break;
        }

        const { lines, hunksTruncated } = compactFileBlock(fileBlocks[i], maxHunkLines);
        truncatedHunks += hunksTruncated;

        const remaining = maxDiffLines - outputLines.length;
        if (lines.length > remaining) {
            outputLines.push(...lines.slice(0, remaining));
            // Current block was partially included; remaining files after it are omitted
            truncatedFiles += fileBlocks.length - i - 1;
            break;
        }

        outputLines.push(...lines);
    }

    // Append truncation notice if anything was cut
    const hasTruncation = truncatedHunks > 0 || truncatedFiles > 0;
    if (hasTruncation) {
        const parts: string[] = [];
        if (truncatedHunks > 0) {
            parts.push(`${truncatedHunks} hunk${truncatedHunks > 1 ? 's' : ''} truncated`);
        }
        if (truncatedFiles > 0) {
            parts.push(`${truncatedFiles} file${truncatedFiles > 1 ? 's' : ''} omitted`);
        }
        outputLines.push('', `[diff compressed — ${parts.join(', ')}]`);
    }

    const compressedText = outputLines.join('\n');
    return {
        diff: compressedText,
        stats: {
            originalLines,
            compressedLines: outputLines.length,
            truncatedHunks,
            truncatedFiles,
        },
    };
};

/**
 * Split raw diff into per-file blocks using "diff --git" delimiter.
 */
const splitIntoFileBlocks = (raw: string): string[][] => {
    const lines = raw.split('\n');
    const blocks: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
        if (line.startsWith('diff --git ')) {
            if (current.length > 0) {
                blocks.push(current);
            }
            current = [line];
        } else {
            current.push(line);
        }
    }

    if (current.length > 0) {
        blocks.push(current);
    }

    return blocks;
};

/**
 * Compact a single file block: replace headers with file name, strip distant context, cap hunks.
 *
 * Context minimization (RTK-style):
 * Only keeps context lines (starting with ' ') that are within 1 line of a change (+/-).
 * Consecutive context-only runs are replaced with a single "..." separator.
 * This eliminates the biggest source of wasted tokens in diffs.
 */
const compactFileBlock = (block: string[], maxHunkLines: number): { lines: string[]; hunksTruncated: number } => {
    const fileName = extractFileName(block);
    const output: string[] = [`=== ${fileName} ===`];
    let hunksTruncated = 0;

    // Collect hunks first, then apply context minimization
    const hunks: { header: string; lines: string[] }[] = [];
    let currentHunk: { header: string; lines: string[] } | null = null;

    for (const line of block) {
        if (isDiffHeader(line)) {
            continue;
        }
        if (line.startsWith('@@')) {
            if (currentHunk) {
                hunks.push(currentHunk);
            }
            currentHunk = { header: line, lines: [] };
            continue;
        }
        if (currentHunk) {
            currentHunk.lines.push(line);
        }
    }
    if (currentHunk) {
        hunks.push(currentHunk);
    }

    for (const hunk of hunks) {
        output.push(hunk.header);
        const minimized = minimizeContext(hunk.lines);

        // Apply hunk line cap
        if (maxHunkLines > 0 && minimized.length > maxHunkLines) {
            const truncatedCount = minimized.length - maxHunkLines;
            output.push(...minimized.slice(0, maxHunkLines));
            output.push(`[... ${truncatedCount} lines truncated]`);
            hunksTruncated++;
        } else {
            output.push(...minimized);
        }
    }

    return { lines: output, hunksTruncated };
};

/**
 * Minimize context lines within a hunk.
 * Keeps context lines only when adjacent (within 1 line) to a change (+/-).
 * Replaces distant context runs with "..." separator.
 */
const minimizeContext = (hunkLines: string[]): string[] => {
    if (hunkLines.length === 0) {
        return [];
    }

    // Mark each line: is it a change line, or adjacent to one?
    const isChange = hunkLines.map(l => l.startsWith('+') || l.startsWith('-'));
    const keep = new Array<boolean>(hunkLines.length).fill(false);

    for (let i = 0; i < hunkLines.length; i++) {
        if (isChange[i]) {
            keep[i] = true;
            // Keep 1 context line before and after
            if (i > 0) {
                keep[i - 1] = true;
            }
            if (i < hunkLines.length - 1) {
                keep[i + 1] = true;
            }
            continue;
        }
    }

    const result: string[] = [];
    let skipped = false;

    for (let i = 0; i < hunkLines.length; i++) {
        if (keep[i]) {
            if (skipped) {
                result.push('  ...');
                skipped = false;
            }
            result.push(hunkLines[i]);
        } else {
            skipped = true;
        }
    }

    return result;
};

/**
 * Extract file name from a diff block.
 * Handles "diff --git a/path b/path" and rename formats.
 */
const extractFileName = (block: string[]): string => {
    const diffLine = block[0] || '';
    const match = diffLine.match(/^diff --git a\/(.+?) b\/(.+)$/);
    if (!match) {
        return 'unknown';
    }

    const [, oldPath, newPath] = match;
    if (oldPath !== newPath) {
        return `${oldPath} → ${newPath}`;
    }
    return newPath;
};

/**
 * Check if a line is a diff metadata header that should be stripped.
 * Uses specific patterns for --- / +++ to avoid stripping hunk body lines
 * that happen to start with those characters (e.g., markdown horizontal rules).
 */
const isDiffHeader = (line: string): boolean => {
    return (
        line.startsWith('diff --git ') ||
        line.startsWith('index ') ||
        line.startsWith('--- a/') ||
        line.startsWith('--- /dev/null') ||
        line.startsWith('+++ b/') ||
        line.startsWith('+++ /dev/null') ||
        line.startsWith('old mode ') ||
        line.startsWith('new mode ') ||
        line.startsWith('new file mode ') ||
        line.startsWith('deleted file mode ') ||
        line.startsWith('similarity index ') ||
        line.startsWith('rename from ') ||
        line.startsWith('rename to ') ||
        line.startsWith('Binary files ')
    );
};
