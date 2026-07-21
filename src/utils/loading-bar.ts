// Bounce-bar ora spinner for the auto-select single-AI wait — the one generation path with
// no interactive prompt (and so no library loading bar) to provide feedback. Mirrors the
// bounce animation of inquirer-reactive-list-prompt's `loadingBar`; once the dependency is
// bumped to >= 1.3.0, `buildBounceFrames` can be imported from the library instead.

const FILLED = '▰';
const EMPTY = '▱';

export const BAR_WIDTH = 14;
export const BAR_BLOCK = 4;

/**
 * One full there-and-back bounce period of raw track strings, for driving an ora
 * spinner (which takes a precomputed `frames` array). Each frame is `width` cells wide
 * with exactly `block` filled cells.
 */
export const buildBounceFrames = (width: number, block: number): string[] => {
    const span = width - block;
    const period = span * 2 || 1;
    return Array.from({ length: period }, (_, tick) => {
        const phase = ((tick % period) + period) % period;
        const offset = phase <= span ? phase : period - phase;
        return EMPTY.repeat(offset) + FILLED.repeat(block) + EMPTY.repeat(span - offset);
    });
};

export const barSpinner = {
    interval: 80,
    frames: buildBounceFrames(BAR_WIDTH, BAR_BLOCK),
};
