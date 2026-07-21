import { expect, testSuite } from 'manten';

import { BAR_BLOCK, BAR_WIDTH, barSpinner, buildBounceFrames } from '../../../src/utils/loading-bar.js';

// Count grapheme cells, not UTF-16 code units — ▰/▱ are single BMP chars here but
// spread guards against a future multi-byte glyph silently breaking the invariant.
const cellCount = (track: string): number => [...track].length;

export default testSuite(({ describe }) => {
    describe('loading-bar buildBounceFrames', ({ test }) => {
        test('produces one full there-and-back period', () => {
            const width = 14;
            const block = 4;
            expect(buildBounceFrames(width, block).length).toBe((width - block) * 2);
        });

        test('every frame is `width` cells with `block` filled', () => {
            const width = 14;
            const block = 4;
            for (const frame of buildBounceFrames(width, block)) {
                expect(cellCount(frame)).toBe(width);
                expect([...frame].filter(cell => cell === '▰').length).toBe(block);
            }
        });

        test('block travels out to the far edge then back (ping-pong, no wrap)', () => {
            const frames = buildBounceFrames(14, 4);
            const positions = frames.map(f => f.indexOf('▰'));
            expect(positions[0]).toBe(0);
            expect(Math.max(...positions)).toBe(14 - 4);
            // last frame is one step before returning to 0 → mirrors the second frame
            expect(positions[positions.length - 1]).toBe(1);
        });

        test('offset advances by one cell per frame on the way out', () => {
            const frames = buildBounceFrames(14, 4);
            expect(frames[1].indexOf('▰')).toBe(1);
            expect(frames[5].indexOf('▰')).toBe(5);
        });
    });

    describe('loading-bar barSpinner', ({ test }) => {
        test('is a valid ora spinner: positive interval + non-empty frames', () => {
            expect(barSpinner.interval > 0).toBe(true);
            expect(barSpinner.frames.length).toBe((BAR_WIDTH - BAR_BLOCK) * 2);
        });

        test('every spinner frame is BAR_WIDTH cells wide', () => {
            for (const frame of barSpinner.frames) {
                expect(cellCount(frame)).toBe(BAR_WIDTH);
            }
        });
    });
});
