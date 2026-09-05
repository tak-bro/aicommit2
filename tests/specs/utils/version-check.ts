import { expect, testSuite } from 'manten';

import { UPGRADE_COMMANDS, compareVersions, detectInstallSource } from '../../../src/utils/version-check.js';

export default testSuite(({ describe }) => {
    describe('compareVersions', ({ test }) => {
        test('reports same for equal versions', () => {
            expect(compareVersions('2.11.1', '2.11.1')).toBe('same');
        });

        test('reports outdated when the registry is ahead', () => {
            expect(compareVersions('2.11.1', '2.12.0')).toBe('outdated');
            expect(compareVersions('2.11.1', '3.0.0')).toBe('outdated');
            expect(compareVersions('2.11.1', '2.11.2')).toBe('outdated');
        });

        test('reports same when the installed build is ahead of the registry', () => {
            expect(compareVersions('2.12.0', '2.11.1')).toBe('same');
        });

        test('reports unknown for a development build', () => {
            expect(compareVersions('0.0.0-semantic-release', '2.11.1')).toBe('unknown');
        });

        test('reports unknown when the registry answer is not a version', () => {
            expect(compareVersions('2.11.1', 'latest')).toBe('unknown');
        });
    });

    describe('detectInstallSource', ({ test }) => {
        test('detects a Nix store path', () => {
            expect(detectInstallSource('/nix/store/abc123-aicommit2-2.11.1/lib/node_modules/aicommit2/dist/cli.mjs')).toBe('nix');
        });

        test('detects a Homebrew Cellar path', () => {
            expect(detectInstallSource('/opt/homebrew/Cellar/aicommit2/2.11.1/libexec/lib/node_modules/aicommit2/dist/cli.mjs')).toBe(
                'brew'
            );
        });

        test('detects a Linuxbrew path', () => {
            expect(detectInstallSource('/home/linuxbrew/.linuxbrew/Cellar/aicommit2/2.11.1/libexec/dist/cli.mjs')).toBe('brew');
        });

        test('falls back to npm for a global node_modules path', () => {
            expect(detectInstallSource('/usr/local/lib/node_modules/aicommit2/dist/cli.mjs')).toBe('npm');
        });

        test('has an upgrade command for every source', () => {
            expect(UPGRADE_COMMANDS.nix).toMatch('nix');
            expect(UPGRADE_COMMANDS.brew).toBe('brew upgrade aicommit2');
            expect(UPGRADE_COMMANDS.npm).toBe('npm update -g aicommit2');
        });
    });
});
