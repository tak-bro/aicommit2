import { buildBounceFrames } from 'inquirer-reactive-list-prompt';

// Bounce-bar ora spinner for the auto-select single-AI wait — the one generation path with
// no interactive prompt (and so no library loading bar) to provide feedback. Reuses the
// library's bounce-frame builder so this spinner and the prompt loader's bar stay in sync.
const BAR_WIDTH = 14;
const BAR_BLOCK = 4;

export const barSpinner = {
    interval: 80,
    frames: buildBounceFrames(BAR_WIDTH, BAR_BLOCK),
};
