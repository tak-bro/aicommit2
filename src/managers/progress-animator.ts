const BAR_WIDTH = 30;
const FRAME_MS = 80;
// Ratio advanced per frame. A settlement moves the target by 1/total; at this step a
// jump slides over ~a few frames, keeping frame count (and full-prompt re-renders) low.
const STEP = 0.08;
// Width of the block that sweeps back and forth in the indeterminate bar.
const SWEEP_WINDOW = 6;
// Leading indent so the bar's left edge lines up with the list items. The prompt renders
// choices at column 4 ("  " + pointer + " " + name); the ora spinner consumes the first
// two columns before this text, so two more spaces put the bar at column 4.
const PAD = '  ';

/**
 * A determinate progress bar over the request axis. The token axis (how far along a
 * single response is) has no known end, but the number of requests is known up front,
 * so this ratio is honest rather than fabricated.
 */
export const renderProgressBar = (ratio: number): string => {
    const clamped = Math.min(Math.max(ratio, 0), 1);
    const filled = Math.round(clamped * BAR_WIDTH);
    const percent = Math.round(clamped * 100);
    return `${PAD}${'█'.repeat(filled)}${'░'.repeat(BAR_WIDTH - filled)} ${percent}%`;
};

/**
 * A determinate bar only carries information across multiple requests. With a single
 * request the ratio is binary — it can only ever read 0% then 100% — so callers gate on
 * this and fall back to the indeterminate sweep bar (motion without a fabricated percent).
 */
export const shouldAnimateProgress = (totalRequests: number): boolean => totalRequests >= 2;

/**
 * A percent-less bar for the single-request case: a block sweeps across the track to
 * signal "working, duration unknown". No ratio is claimed, so nothing is fabricated —
 * it is the honest indeterminate counterpart to the determinate bar above.
 */
export const renderIndeterminateBar = (position: number): string => {
    let track = '';
    for (let i = 0; i < BAR_WIDTH; i++) {
        track += i >= position && i < position + SWEEP_WINDOW ? '█' : '░';
    }
    return `${PAD}${track}`;
};

export interface ProgressAnimator {
    /** Mark one request settled (succeeded or failed); the bar eases toward the new ratio. */
    settle: () => void;
    /** Stop the animation loop. Idempotent — safe to call from finally and stream handlers. */
    stop: () => void;
}

/**
 * Eases a progress bar from its current fill toward `settled/total` a step per frame.
 * The bar only moves when a request settles — between settlements there is no new
 * information, so it holds (the spinner covers the wait). Fabricating motion during the
 * wait would be a bar that never honestly reaches its mark, which is the very problem
 * this feature exists to fix.
 */
export const createProgressAnimator = (total: number, onText: (text: string) => void): ProgressAnimator => {
    let displayed = 0;
    let target = 0;
    let settled = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    onText(renderProgressBar(0));

    const tick = (): void => {
        if (displayed >= target) {
            return;
        }
        displayed = Math.min(displayed + STEP, target);
        onText(renderProgressBar(displayed));
    };

    timer = setInterval(tick, FRAME_MS);
    // Don't let the animation loop keep the process alive on its own.
    timer.unref?.();

    return {
        settle: () => {
            settled += 1;
            target = total > 0 ? Math.min(settled / total, 1) : 1;
        },
        stop: () => {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
        },
    };
};

/**
 * Drives the indeterminate sweep bar: a block bounces left-to-right and back on the frame
 * timer. `settle` is a no-op — there is no ratio to advance — so it satisfies the same
 * ProgressAnimator contract and call sites need no branching beyond which one they create.
 */
export const createIndeterminateAnimator = (onText: (text: string) => void): ProgressAnimator => {
    const maxPosition = BAR_WIDTH - SWEEP_WINDOW;
    let position = 0;
    let direction = 1;
    let timer: ReturnType<typeof setInterval> | undefined;

    onText(renderIndeterminateBar(0));

    const tick = (): void => {
        position += direction;
        if (position >= maxPosition) {
            position = maxPosition;
            direction = -1;
        } else if (position <= 0) {
            position = 0;
            direction = 1;
        }
        onText(renderIndeterminateBar(position));
    };

    timer = setInterval(tick, FRAME_MS);
    // Don't let the animation loop keep the process alive on its own.
    timer.unref?.();

    return {
        settle: () => {},
        stop: () => {
            if (timer) {
                clearInterval(timer);
                timer = undefined;
            }
        },
    };
};
