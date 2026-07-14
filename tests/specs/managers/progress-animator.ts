import { expect, testSuite } from 'manten';

import {
    createIndeterminateAnimator,
    createProgressAnimator,
    renderIndeterminateBar,
    renderProgressBar,
    shouldAnimateProgress,
} from '../../../src/managers/progress-animator.js';

const wait = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export default testSuite(({ describe }) => {
    describe('renderProgressBar', ({ test }) => {
        test('empty at 0, full at 1, and percent-labelled', () => {
            expect(renderProgressBar(0)).toBe(`  ${'░'.repeat(30)} 0%`);
            expect(renderProgressBar(1)).toBe(`  ${'█'.repeat(30)} 100%`);
            expect(renderProgressBar(0.5)).toBe(`  ${'█'.repeat(15)}${'░'.repeat(15)} 50%`);
        });

        test('clamps out-of-range ratios', () => {
            expect(renderProgressBar(-1)).toBe(`  ${'░'.repeat(30)} 0%`);
            expect(renderProgressBar(2)).toBe(`  ${'█'.repeat(30)} 100%`);
        });
    });

    describe('shouldAnimateProgress', ({ test }) => {
        test('needs at least two requests to be meaningful', () => {
            expect(shouldAnimateProgress(0)).toBe(false);
            expect(shouldAnimateProgress(1)).toBe(false);
            expect(shouldAnimateProgress(2)).toBe(true);
            expect(shouldAnimateProgress(5)).toBe(true);
        });
    });

    describe('renderIndeterminateBar', ({ test }) => {
        test('places a fixed-width block at the given position', () => {
            expect(renderIndeterminateBar(0)).toBe(`  ${'█'.repeat(6)}${'░'.repeat(24)}`);
            expect(renderIndeterminateBar(24)).toBe(`  ${'░'.repeat(24)}${'█'.repeat(6)}`);
            expect(renderIndeterminateBar(10)).toBe(`  ${'░'.repeat(10)}${'█'.repeat(6)}${'░'.repeat(14)}`);
        });
    });

    describe('createIndeterminateAnimator', ({ test }) => {
        test('sweeps the block across frames and stop halts it', async () => {
            const frames: string[] = [];
            const animator = createIndeterminateAnimator(t => frames.push(t));

            for (let i = 0; i < 20 && new Set(frames).size < 3; i++) {
                await wait(20);
            }
            animator.stop();
            const countAfterStop = frames.length;

            // It moved through several distinct positions rather than holding one frame.
            expect(new Set(frames).size).toBeGreaterThan(2);

            await wait(200);
            expect(frames.length).toBe(countAfterStop);
        });

        test('settle is a no-op and stop is idempotent', () => {
            const animator = createIndeterminateAnimator(() => {});
            expect(() => animator.settle()).not.toThrow();
            animator.stop();
            expect(() => animator.stop()).not.toThrow();
        });
    });

    describe('createProgressAnimator', ({ test }) => {
        test('renders 0% immediately on creation', () => {
            const frames: string[] = [];
            const animator = createProgressAnimator(5, t => frames.push(t));
            animator.stop();

            expect(frames[0]).toBe(renderProgressBar(0));
        });

        test('eases toward the settled ratio over several frames', async () => {
            const frames: string[] = [];
            const animator = createProgressAnimator(4, t => frames.push(t));
            const target = renderProgressBar(0.25); // 1/4

            animator.settle();
            // Poll until the slide reaches the target (timing-independent, not a fixed wait).
            for (let i = 0; i < 50 && frames[frames.length - 1] !== target; i++) {
                await wait(20);
            }
            animator.stop();

            expect(frames[frames.length - 1]).toBe(target);
            // More than the initial 0% frame plus one — it animated rather than jumping.
            expect(frames.length).toBeGreaterThan(2);
        });

        test('stop halts further frames', async () => {
            const frames: string[] = [];
            const animator = createProgressAnimator(4, t => frames.push(t));
            animator.settle();
            animator.stop();
            const countAfterStop = frames.length;

            await wait(200);
            expect(frames.length).toBe(countAfterStop);
        });

        test('stop is idempotent', () => {
            const animator = createProgressAnimator(3, () => {});
            animator.stop();
            expect(() => animator.stop()).not.toThrow();
        });
    });
});
