import { expect, testSuite } from 'manten';

import { isPipedDryRun } from '../../../src/utils/message-flags.js';

const withStdoutTTY = (isTTY: boolean, run: () => void) => {
    const original = process.stdout.isTTY;
    process.stdout.isTTY = isTTY;
    try {
        run();
    } finally {
        process.stdout.isTTY = original;
    }
};

export default testSuite(({ describe }) => {
    describe('isPipedDryRun', ({ test }) => {
        test('true for --dry-run when stdout is not a TTY', () => {
            withStdoutTTY(false, () => expect(isPipedDryRun(true)).toBe(true));
        });

        // An interactive `aicommit2 -d` keeps the picker
        test('false for --dry-run on a TTY', () => {
            withStdoutTTY(true, () => expect(isPipedDryRun(true)).toBe(false));
        });

        test('false without --dry-run', () => {
            withStdoutTTY(false, () => expect(isPipedDryRun(false)).toBe(false));
        });

        // JSON mode already owns stdout for its own format
        test('false in JSON output mode', () => {
            withStdoutTTY(false, () => expect(isPipedDryRun(true, true)).toBe(false));
        });
    });
});
