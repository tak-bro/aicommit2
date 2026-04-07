import { expect, testSuite } from 'manten';

import { compressDiff } from '../../src/utils/diff-compressor.js';

const createDiffBlock = (fileName: string, hunks: string[]): string => {
    return [
        `diff --git a/${fileName} b/${fileName}`,
        `index abc1234..def5678 100644`,
        `--- a/${fileName}`,
        `+++ b/${fileName}`,
        ...hunks,
    ].join('\n');
};

const createHunk = (startLine: number, addedLines: number, removedLines: number): string => {
    const lines: string[] = [`@@ -${startLine},${removedLines + 2} +${startLine},${addedLines + 2} @@`];
    lines.push(' context line before');
    for (let i = 0; i < removedLines; i++) {
        lines.push(`-removed line ${i + 1}`);
    }
    for (let i = 0; i < addedLines; i++) {
        lines.push(`+added line ${i + 1}`);
    }
    lines.push(' context line after');
    return lines.join('\n');
};

export default testSuite(({ describe }) => {
    describe('diff-compressor', ({ test }) => {
        test('mode=none returns raw diff unchanged', () => {
            const raw = createDiffBlock('src/foo.ts', [createHunk(1, 3, 2)]);
            const { diff, stats } = compressDiff(raw, { mode: 'none' });
            expect(diff).toBe(raw);
            expect(stats.truncatedHunks).toBe(0);
            expect(stats.truncatedFiles).toBe(0);
        });

        test('mode=compact strips diff headers', () => {
            const raw = createDiffBlock('src/foo.ts', [createHunk(1, 2, 1)]);
            const { diff } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });

            expect(diff).toContain('=== src/foo.ts ===');
            expect(diff).not.toContain('diff --git');
            expect(diff).not.toContain('index abc1234');
            expect(diff).not.toContain('--- a/');
            expect(diff).not.toContain('+++ b/');
            expect(diff).toContain('@@ -1,');
            expect(diff).toContain('+added line 1');
            expect(diff).toContain('-removed line 1');
        });

        test('mode=compact truncates large hunks', () => {
            const largeHunk = createHunk(1, 50, 50); // 102 lines total (2 context + 100 changes)
            const raw = createDiffBlock('src/big.ts', [largeHunk]);
            const { diff, stats } = compressDiff(raw, { mode: 'compact', maxHunkLines: 20, maxDiffLines: 0 });

            expect(diff).toContain('[... ');
            expect(diff).toContain('lines truncated]');
            expect(stats.truncatedHunks).toBe(1);
        });

        test('mode=compact truncates total diff lines', () => {
            const hunks = [createHunk(1, 10, 10), createHunk(50, 10, 10)];
            const file1 = createDiffBlock('src/a.ts', hunks);
            const file2 = createDiffBlock('src/b.ts', hunks);
            const file3 = createDiffBlock('src/c.ts', hunks);
            const raw = [file1, file2, file3].join('\n');

            const { diff, stats } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 30 });

            expect(diff).toContain('[diff compressed');
            expect(stats.compressedLines).toBeLessThanOrEqual(35); // 30 + truncation notice
        });

        test('handles empty diff', () => {
            const { diff } = compressDiff('', { mode: 'compact' });
            expect(diff).toBe('');
        });

        test('handles diff without standard headers (binary section)', () => {
            const raw = '--- Binary Files Changed ---\nBinary file image.png added';
            const { diff } = compressDiff(raw, { mode: 'compact' });
            // No "diff --git" blocks, so no file blocks to process — returns empty-ish
            expect(diff).toBeDefined();
        });

        test('handles renamed files', () => {
            const raw = [
                'diff --git a/old-name.ts b/new-name.ts',
                'similarity index 95%',
                'rename from old-name.ts',
                'rename to new-name.ts',
                'index abc..def 100644',
                '--- a/old-name.ts',
                '+++ b/new-name.ts',
                '@@ -1,3 +1,3 @@',
                ' unchanged',
                '-old line',
                '+new line',
                ' unchanged',
            ].join('\n');

            const { diff } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });
            expect(diff).toContain('old-name.ts → new-name.ts');
        });

        test('default config applies none mode', () => {
            const raw = createDiffBlock('src/foo.ts', [createHunk(1, 2, 1)]);
            const { diff } = compressDiff(raw);
            expect(diff).toBe(raw);
        });

        test('multiple hunks in one file are preserved', () => {
            const raw = createDiffBlock('src/foo.ts', [createHunk(1, 2, 1), createHunk(50, 3, 0)]);
            const { diff } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });

            const hunkHeaders = diff.split('\n').filter((l: string) => l.startsWith('@@'));
            expect(hunkHeaders.length).toBe(2);
        });

        test('compression stats are accurate', () => {
            const raw = createDiffBlock('src/foo.ts', [createHunk(1, 5, 5)]);
            const originalLines = raw.split('\n').length;
            const { stats } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });

            expect(stats.originalLines).toBe(originalLines);
            expect(stats.compressedLines).toBeLessThan(stats.originalLines);
        });

        test('both maxHunkLines=0 and maxDiffLines=0 means unlimited', () => {
            // Create a large diff: 3 files, each with 2 hunks of 50 lines
            const hunks = [createHunk(1, 50, 50), createHunk(200, 50, 50)];
            const files = [createDiffBlock('src/a.ts', hunks), createDiffBlock('src/b.ts', hunks), createDiffBlock('src/c.ts', hunks)];
            const raw = files.join('\n');

            const { diff, stats } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });

            // No truncation should occur
            expect(stats.truncatedHunks).toBe(0);
            expect(stats.truncatedFiles).toBe(0);
            expect(diff).not.toContain('truncated');
            expect(diff).not.toContain('omitted');
            // All 3 files should be present
            expect(diff).toContain('=== src/a.ts ===');
            expect(diff).toContain('=== src/b.ts ===');
            expect(diff).toContain('=== src/c.ts ===');
        });

        test('partial file inclusion does not count as truncated file', () => {
            const hunks = [createHunk(1, 20, 20)]; // ~42 lines per file block after compact
            const file1 = createDiffBlock('src/first.ts', hunks);
            const file2 = createDiffBlock('src/second.ts', hunks);
            const raw = [file1, file2].join('\n');

            // Set maxDiffLines so first file fits fully, second partially
            const { stats } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 50 });

            // second file was partially included, no files fully omitted
            expect(stats.truncatedFiles).toBe(0);
        });

        test('fully omitted files are counted correctly', () => {
            const hunks = [createHunk(1, 20, 20)];
            const files = [createDiffBlock('src/a.ts', hunks), createDiffBlock('src/b.ts', hunks), createDiffBlock('src/c.ts', hunks)];
            const raw = files.join('\n');

            // Set maxDiffLines so only first file fits
            const { diff, stats } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 10 });

            expect(diff).toContain('=== src/a.ts ===');
            expect(stats.truncatedFiles).toBeGreaterThan(0);
        });

        test('context minimization strips distant context lines', () => {
            // Hunk with 3 context → 1 change → 10 context → 1 change → 3 context
            const hunk = [
                '@@ -1,19 +1,19 @@',
                ' ctx 1',
                ' ctx 2',
                ' ctx 3',
                '-old line A',
                '+new line A',
                ' gap 1',
                ' gap 2',
                ' gap 3',
                ' gap 4',
                ' gap 5',
                ' gap 6',
                ' gap 7',
                ' gap 8',
                ' gap 9',
                ' gap 10',
                '-old line B',
                '+new line B',
                ' ctx end 1',
                ' ctx end 2',
                ' ctx end 3',
            ].join('\n');
            const raw = createDiffBlock('src/test.ts', [hunk]);
            const { diff } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });

            // Change lines must be preserved
            expect(diff).toContain('+new line A');
            expect(diff).toContain('+new line B');
            expect(diff).toContain('-old line A');
            expect(diff).toContain('-old line B');

            // Adjacent context (3 lines from change) kept
            expect(diff).toContain(' ctx 1'); // 3 before change A
            expect(diff).toContain(' ctx 2'); // 2 before change A
            expect(diff).toContain(' ctx 3'); // 1 before change A
            expect(diff).toContain(' gap 1'); // 1 after change A
            expect(diff).toContain(' gap 2'); // 2 after change A
            expect(diff).toContain(' gap 3'); // 3 after change A
            expect(diff).toContain(' gap 8'); // 3 before change B
            expect(diff).toContain(' gap 9'); // 2 before change B
            expect(diff).toContain(' gap 10'); // 1 before change B
            expect(diff).toContain(' ctx end 1'); // 1 after change B
            expect(diff).toContain(' ctx end 2'); // 2 after change B
            expect(diff).toContain(' ctx end 3'); // 3 after change B

            // Distant context stripped (gap 4-7 are > 3 lines from any change)
            expect(diff).not.toContain(' gap 5');
            expect(diff).not.toContain(' gap 6');

            // Separator present
            expect(diff).toContain('...');
        });

        test('single file diff with no hunks produces file header only', () => {
            const raw = ['diff --git a/empty.ts b/empty.ts', 'new file mode 100644', 'index 0000000..e69de29'].join('\n');

            const { diff } = compressDiff(raw, { mode: 'compact', maxHunkLines: 0, maxDiffLines: 0 });
            expect(diff).toContain('=== empty.ts ===');
            expect(diff).not.toContain('truncated');
        });
    });
});
