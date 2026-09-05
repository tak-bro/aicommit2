import fs from 'fs';

import { HttpRequestBuilder } from '../services/http/http-request.builder.js';

export type InstallSource = 'nix' | 'brew' | 'npm';

export type VersionComparison = 'same' | 'outdated' | 'unknown';

export const UPGRADE_COMMANDS: Record<InstallSource, string> = {
    nix: 'nix profile upgrade aicommit2',
    brew: 'brew upgrade aicommit2',
    npm: 'npm update -g aicommit2',
};

const NPM_REGISTRY_URL = 'https://registry.npmjs.org';
const LATEST_VERSION_PATH = '/aicommit2/latest';

/**
 * Classify where the running binary was installed from, by its resolved path.
 * Anything that is not a Nix store or a Homebrew cellar is treated as an npm install.
 */
export const detectInstallSource = (binPath: string): InstallSource => {
    const normalizedPath = binPath.replace(/\\/g, '/');
    if (normalizedPath.includes('/nix/store/')) {
        return 'nix';
    }
    const isHomebrew =
        normalizedPath.includes('/Cellar/') || normalizedPath.includes('/homebrew/') || normalizedPath.includes('/linuxbrew/');
    if (isHomebrew) {
        return 'brew';
    }
    return 'npm';
};

/**
 * Real path of the running script. Symlinks (npm global bin, Homebrew) are followed so the
 * install source can be read from the final location; an unresolvable path is used as-is.
 */
export const resolveInstalledBinPath = (scriptPath: string = process.argv[1]): string => {
    try {
        return fs.realpathSync(scriptPath);
    } catch {
        return scriptPath;
    }
};

const parseVersion = (version: string): number[] | null => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
    if (!match) {
        return null;
    }
    return match.slice(1).map(Number);
};

/**
 * `outdated` only when the registry version is strictly newer. A build ahead of the
 * registry (or one that is not a plain x.y.z, e.g. a development build) is never outdated.
 */
export const compareVersions = (current: string, latest: string): VersionComparison => {
    const currentParts = parseVersion(current);
    const latestParts = parseVersion(latest);
    if (!currentParts || !latestParts) {
        return 'unknown';
    }

    for (let i = 0; i < 3; i++) {
        if (latestParts[i] > currentParts[i]) {
            return 'outdated';
        }
        if (latestParts[i] < currentParts[i]) {
            return 'same';
        }
    }
    return 'same';
};

/**
 * Latest published version from the npm registry. Throws on network or parse failure;
 * the caller decides how to report that.
 */
export const fetchLatestVersion = async (timeoutMs = 3000): Promise<string> => {
    const builder = new HttpRequestBuilder({
        method: 'GET',
        baseURL: NPM_REGISTRY_URL,
        url: LATEST_VERSION_PATH,
        timeout: timeoutMs,
    });
    const response = await builder.execute<{ version?: string }>();
    const latest = response.data?.version;
    if (!latest) {
        throw new Error('npm registry response has no version field');
    }
    return latest;
};
