import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

import chalk from 'chalk';
import { command } from 'cleye';

import { KnownError, handleCliError } from '../utils/error.js';
import { fileExists } from '../utils/fs.js';
import { assertGitRepo, getVCSName } from '../utils/vcs.js';

const hookName = 'prepare-commit-msg';

const getHookPath = async (): Promise<string> => {
    const vcsName = await getVCSName();
    const { execa } = await import('execa');

    if (vcsName === 'git') {
        // git handles worktrees and core.hooksPath (tests/specs/git-hook.ts); output may be cwd-relative
        const { stdout } = await execa('git', ['rev-parse', '--git-path', `hooks/${hookName}`]);
        return path.resolve(stdout.trim());
    }

    if (vcsName === 'yadm') {
        // YADM hooks location can vary, use yadm introspect to get correct path
        const home = process.env.HOME || process.env.USERPROFILE;
        if (!home) {
            throw new KnownError('HOME environment variable not set. Cannot determine YADM hook path.');
        }

        try {
            // Use yadm introspect to get the correct hooks directory
            const { stdout } = await execa('yadm', ['introspect', 'repo']);
            const yadmRepo = stdout.trim();

            if (yadmRepo) {
                // Hook path is in the repo's hooks directory
                return path.join(yadmRepo, 'hooks', hookName);
            }
        } catch (error) {
            // Fallback: if introspect fails, try standard locations
        }

        // Fallback: Check both standard locations
        const xdgPath = path.join(home, '.config/yadm/hooks');
        const legacyPath = path.join(home, '.yadm/hooks');

        // Prefer XDG standard location if it exists, otherwise use legacy
        try {
            await fs.access(xdgPath);
            return path.join(xdgPath, hookName);
        } catch {
            return path.join(legacyPath, hookName);
        }
    }

    if (vcsName === 'jujutsu') {
        throw new KnownError('Hooks are not supported for Jujutsu repositories.');
    }

    throw new KnownError(`Hooks are not supported for ${vcsName} repositories.`);
};

const hookPath = fileURLToPath(new URL('cli.mjs', import.meta.url));

/** Matches the hook file in any hooks directory, including a custom core.hooksPath. */
export const isGitHookInvocation = (scriptPath: string): boolean => {
    const normalizedPath = scriptPath.replace(/\\/g, '/'); // Windows back slashes → forward slashes
    return normalizedPath.endsWith(`/${hookName}`);
};

export const isCalledFromGitHook = isGitHookInvocation(process.argv[1]);

const isWindows = process.platform === 'win32';
const windowsHook = `
#!/usr/bin/env node
import(${JSON.stringify(pathToFileURL(hookPath))})
`.trim();

export default command(
    {
        name: 'hook',
        parameters: ['<install/uninstall>'],
        help: {
            description: 'Install or uninstall the Git prepare-commit-msg hook',
            examples: ['aic2 hook install', 'aic2 hook uninstall'],
        },
    },
    argv => {
        (async () => {
            const gitRepoPath = await assertGitRepo();
            const { installUninstall: mode } = argv._;

            const symlinkPath = await getHookPath();
            const absoltueSymlinkPath = path.isAbsolute(symlinkPath) ? symlinkPath : path.join(gitRepoPath, symlinkPath);
            const hookExists = await fileExists(absoltueSymlinkPath);
            if (mode === 'install') {
                if (hookExists) {
                    // If the symlink is broken, it will throw an error
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    const realpath = await fs.realpath(absoltueSymlinkPath).catch(() => {});
                    if (realpath === hookPath) {
                        console.warn('The hook is already installed');
                        return;
                    }
                    throw new KnownError(
                        `A different ${hookName} hook seems to be installed. Please remove it before installing aicommit2.`
                    );
                }

                await fs.mkdir(path.dirname(absoltueSymlinkPath), { recursive: true });

                if (isWindows) {
                    await fs.writeFile(absoltueSymlinkPath, windowsHook);
                } else {
                    await fs.symlink(hookPath, absoltueSymlinkPath, 'file');
                    await fs.chmod(absoltueSymlinkPath, 0o755);
                }
                console.log(`${chalk.green('✔')} Hook installed`);
                return;
            }

            if (mode === 'uninstall') {
                if (!hookExists) {
                    console.warn('Hook is not installed');
                    return;
                }

                if (isWindows) {
                    const scriptContent = await fs.readFile(absoltueSymlinkPath, 'utf8');
                    if (scriptContent !== windowsHook) {
                        console.warn('Hook is not installed');
                        return;
                    }
                } else {
                    const realpath = await fs.realpath(absoltueSymlinkPath);
                    if (realpath !== hookPath) {
                        console.warn('Hook is not installed');
                        return;
                    }
                }

                await fs.rm(absoltueSymlinkPath);
                console.log(`${chalk.green('✔')} Hook uninstalled`);
                return;
            }

            throw new KnownError(`Invalid mode: ${mode}`);
        })().catch(error => {
            console.error(`${chalk.red('✖')} ${error.message}`);
            handleCliError(error);
            process.exit(1);
        });
    }
);
