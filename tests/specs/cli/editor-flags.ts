import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { assertOpenAiKey, createFixture, createGit, files } from '../../utils.js';

const EDITOR_GENERATION_TIMEOUT_MS = 5000;

export default testSuite(({ describe }) => {
    if (process.platform === 'win32') {
        // https://github.com/nodejs/node/issues/31409
        console.warn("Skipping tests on Windows because Node.js spawn can't open TTYs");
        return;
    }

    assertOpenAiKey();

    describe('Editor with flags', async ({ test }) => {
        test('should open editor with flags (e.g., "zed --new --wait")', async () => {
            const { fixture, aicommit2 } = await createFixture(files);
            const git = await createGit(fixture.path);

            await git('add', ['data.json']);

            // Create mock editor that verifies it received flags correctly
            const mockEditorPath = path.join(fixture.path, 'mock-editor.sh');
            await fs.writeFile(
                mockEditorPath,
                `#!/bin/bash
# Verify flags are parsed: $1 should be --new, $2 should be --wait, $3 should be the file
if [ "$1" = "--new" ] && [ "$2" = "--wait" ]; then
    echo "Editor flags test passed" > "$3"
    exit 0
else
    echo "ERROR: Expected flags --new --wait, got: $@" >&2
    exit 1
fi
`,
                { mode: 0o755 }
            );

            const committing = aicommit2(['--edit'], {
                env: {
                    EDITOR: `${mockEditorPath} --new --wait`,
                    OPENAI_KEY: process.env.OPENAI_KEY,
                },
            });

            // Wait for commit message generation
            await new Promise(resolve => setTimeout(resolve, EDITOR_GENERATION_TIMEOUT_MS));

            const { exitCode } = await committing;
            expect(exitCode).toBe(0);

            const statusAfter = await git('status', ['--porcelain', '--untracked-files=no']);
            expect(statusAfter.stdout).toBe('');

            await fixture.rm();
        });

        test('should handle invalid editor command gracefully', async () => {
            const { fixture, aicommit2 } = await createFixture(files);
            const git = await createGit(fixture.path);

            await git('add', ['data.json']);

            const committing = aicommit2(['--edit'], {
                env: {
                    EDITOR: 'nonexistent-editor --wait',
                    OPENAI_KEY: process.env.OPENAI_KEY,
                },
                reject: false,
            });

            await new Promise(resolve => setTimeout(resolve, EDITOR_GENERATION_TIMEOUT_MS));

            const { exitCode, stdout } = await committing;

            expect(exitCode).toBe(1);
            expect(stdout).toMatch(/Failed to open editor/);

            await fixture.rm();
        });
    });
});
