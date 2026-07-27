import { expect, testSuite } from 'manten';

import { barSpinner } from '../../../src/utils/loading-bar.js';

// Count grapheme cells, not UTF-16 code units — guards against a future multi-byte glyph
// silently breaking the width invariant.
const cellCount = (frame: string): number => [...frame].length;

// The bounce-frame algorithm itself lives in (and is tested by) inquirer-reactive-list-prompt;
// here we only assert the composed ora spinner is well-formed.
export default testSuite(({ describe }) => {
    describe('loading-bar barSpinner', ({ test }) => {
        test('is a valid ora spinner: positive interval + non-empty frames', () => {
            expect(barSpinner.interval > 0).toBe(true);
            expect(barSpinner.frames.length > 0).toBe(true);
        });

        test('every frame is the same width and carries a filled block', () => {
            const width = cellCount(barSpinner.frames[0]);
            for (const frame of barSpinner.frames) {
                expect(cellCount(frame)).toBe(width);
                expect([...frame].some(cell => cell === '▰')).toBe(true);
            }
        });
    });
});
