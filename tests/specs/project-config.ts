import fs from 'fs/promises';
import path from 'path';

import { expect, testSuite } from 'manten';

import { getAvailableAIs } from '../../src/commands/get-available-ais.js';
import {
    BUILTIN_SERVICES,
    ValidConfig,
    getConfig,
    invalidateConfigCache,
    parseProviderList,
    printConfigPath,
    setConfigs,
} from '../../src/utils/config.js';
import { readProjectConfig } from '../../src/utils/project-config.js';
import { createFixture } from '../utils.js';

interface Layers {
    global: string[];
    project: string[];
    extraFiles?: Record<string, string>;
}

/**
 * Lay out `<fixture>/global.ini` and `<fixture>/repo/{.git,.aicommit2/config.ini}`, then run `fn`
 * from `<fixture>/repo/sub` with the global file selected through AICOMMIT_CONFIG_PATH.
 */
const withLayers = async (layers: Layers, fn: (paths: { root: string; repo: string }) => Promise<void>) => {
    const { fixture } = await createFixture();
    const repo = path.join(fixture.path, 'repo');
    const globalPath = path.join(fixture.path, 'global.ini');
    await fs.mkdir(path.join(repo, '.git'), { recursive: true });
    await fs.mkdir(path.join(repo, '.aicommit2'), { recursive: true });
    await fs.mkdir(path.join(repo, 'sub'), { recursive: true });
    await fs.writeFile(globalPath, `${layers.global.join('\n')}\n`);
    await fs.writeFile(path.join(repo, '.aicommit2', 'config.ini'), `${layers.project.join('\n')}\n`);
    for (const [file, content] of Object.entries(layers.extraFiles ?? {})) {
        await fs.mkdir(path.dirname(path.join(fixture.path, file)), { recursive: true });
        await fs.writeFile(path.join(fixture.path, file), content);
    }

    const originalCwd = process.cwd();
    const originalConfigPath = process.env.AICOMMIT_CONFIG_PATH;
    const originalOpenAiKey = process.env.OPENAI_API_KEY;
    process.env.AICOMMIT_CONFIG_PATH = globalPath;
    delete process.env.OPENAI_API_KEY;
    process.chdir(path.join(repo, 'sub'));
    invalidateConfigCache();

    try {
        await fn({ root: fixture.path, repo });
    } finally {
        process.chdir(originalCwd);
        if (originalConfigPath === undefined) {
            delete process.env.AICOMMIT_CONFIG_PATH;
        } else {
            process.env.AICOMMIT_CONFIG_PATH = originalConfigPath;
        }
        if (originalOpenAiKey !== undefined) {
            process.env.OPENAI_API_KEY = originalOpenAiKey;
        }
        invalidateConfigCache();
        await fixture.rm();
    }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- provider sections are untyped records in ValidConfig
const section = (config: ValidConfig, name: string) => config[name as keyof ValidConfig] as any;

export default testSuite(({ describe }) => {
    describe('project config', async ({ test }) => {
        await test('merges allowed project keys over global', async () => {
            await withLayers(
                {
                    global: ['locale=en', 'type=conventional', '[OPENAI]', 'key=sk-global', 'model=gpt-4o-mini', 'temperature=0.7'],
                    project: ['locale=ko', '[OPENAI]', 'model=gpt-4.1'],
                },
                async () => {
                    const config = await getConfig({});
                    expect(config.locale).toBe('ko');
                    expect(config.type).toBe('conventional');
                    expect(section(config, 'OPENAI').model).toEqual(['gpt-4.1']);
                    expect(section(config, 'OPENAI').key).toBe('sk-global');
                    expect(section(config, 'OPENAI').temperature).toBe(0.7);

                    // CLI still wins over the project layer
                    const withCli = await getConfig({ locale: 'ja' });
                    expect(withCli.locale).toBe('ja');
                }
            );
        });

        await test('drops secret, endpoint and unknown-section entries', async () => {
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global', '[OLLAMA]', 'model=llama3'],
                    project: [
                        'logFilePath=/tmp/evil.log',
                        'OPENAI.url=https://attacker.example',
                        '[OPENAI]',
                        'key=sk-project',
                        'envKey=HOME',
                        'url=https://attacker.example',
                        'path=/steal',
                        '[OLLAMA]',
                        'host=https://attacker.example',
                        '[EVIL]',
                        'compatible=true',
                        'url=https://attacker.example',
                        'key=x',
                    ],
                },
                async () => {
                    const config = await getConfig({});
                    expect(section(config, 'OPENAI').key).toBe('sk-global');
                    expect(section(config, 'OPENAI').url).not.toBe('https://attacker.example');
                    expect(section(config, 'OPENAI').path).not.toBe('/steal');
                    expect(section(config, 'OLLAMA').host).not.toBe('https://attacker.example');
                    expect(section(config, 'EVIL')).toBeUndefined();

                    const project = await readProjectConfig({}, BUILTIN_SERVICES, parseProviderList);
                    expect(project?.ignored).toEqual(
                        expect.arrayContaining([
                            'logFilePath',
                            'OPENAI.url',
                            'OPENAI.key',
                            'OPENAI.envKey',
                            'OPENAI.path',
                            'OLLAMA.host',
                            '[EVIL]',
                        ])
                    );
                }
            );
        });

        await test('rejects prototype-polluting and case-variant keys', async () => {
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global'],
                    project: [
                        '__proto__.url=https://attacker.example',
                        'constructor.prototype.host=https://attacker.example',
                        '[OPENAI]',
                        'URL=https://attacker.example',
                        '__proto__.path=/steal',
                    ],
                },
                async () => {
                    const config = await getConfig({});
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- probing the shared prototype on purpose
                    expect(({} as any).url).toBeUndefined();
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- probing the shared prototype on purpose
                    expect(({} as any).path).toBeUndefined();
                    expect(section(config, 'OPENAI').url).not.toBe('https://attacker.example');
                    expect(section(config, 'OPENAI').path).not.toBe('/steal');

                    const project = await readProjectConfig({}, BUILTIN_SERVICES, parseProviderList);
                    expect(project?.ignored).toEqual(
                        expect.arrayContaining(['__proto__.url', 'constructor.prototype.host', 'OPENAI.URL', 'OPENAI.__proto__.path'])
                    );
                }
            );
        });

        await test('rejects prompt paths that escape through a symlink', async () => {
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global'],
                    project: ['systemPromptPath=prompts/link.txt'],
                    extraFiles: { 'outside.txt': 'secret' },
                },
                async ({ root, repo }) => {
                    await fs.mkdir(path.join(repo, '.aicommit2', 'prompts'), { recursive: true });
                    await fs.symlink(path.join(root, 'outside.txt'), path.join(repo, '.aicommit2', 'prompts', 'link.txt'));
                    invalidateConfigCache();
                    const config = await getConfig({});
                    expect(config.systemPromptPath).toBe('');
                }
            );
        });

        await test('names the project file when a project value is invalid', async () => {
            await withLayers({ global: ['[OPENAI]', 'key=sk-global'], project: ['generate=abc'] }, async () => {
                await expect(getConfig({})).rejects.toThrow(/\.aicommit2[\\/]config\.ini/);
            });
        });

        await test('confines prompt paths to the repository', async () => {
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global'],
                    project: [
                        'systemPromptPath=prompts/commit.txt',
                        'codeReviewPromptPath=../../outside.txt',
                        '[OPENAI]',
                        'systemPromptPath=/etc/hosts',
                    ],
                    extraFiles: { 'repo/.aicommit2/prompts/commit.txt': 'prompt', 'outside.txt': 'secret' },
                },
                async ({ repo }) => {
                    const config = await getConfig({});
                    expect(config.systemPromptPath).toBe(path.join(repo, '.aicommit2', 'prompts', 'commit.txt'));
                    expect(config.codeReviewPromptPath).toBe('');
                    expect(section(config, 'OPENAI').systemPromptPath).not.toBe('/etc/hosts');

                    const project = await readProjectConfig({}, BUILTIN_SERVICES, parseProviderList);
                    expect(project?.ignored).toEqual(expect.arrayContaining(['codeReviewPromptPath', 'OPENAI.systemPromptPath']));
                }
            );
        });

        await test('does not expand env vars or re-enable a disabled provider', async () => {
            process.env.AICOMMIT_TEST_SECRET = 'sk-secret';
            try {
                await withLayers(
                    {
                        global: ['[OPENAI]', 'key=sk-global', 'disabled=true'],
                        project: ['systemPrompt=echo ${AICOMMIT_TEST_SECRET}', '[OPENAI]', 'disabled=false'],
                    },
                    async () => {
                        const config = await getConfig({});
                        expect(config.systemPrompt).toBe('echo ${AICOMMIT_TEST_SECRET}');
                        expect(getAvailableAIs(config, 'commit')).toEqual([]);
                    }
                );
            } finally {
                delete process.env.AICOMMIT_TEST_SECRET;
            }
        });

        await test('config set writes only the global file', async () => {
            await withLayers({ global: ['[OPENAI]', 'key=sk-global'], project: ['locale=ko'] }, async ({ root }) => {
                await setConfigs([['generate', '2']]);
                const globalContent = await fs.readFile(path.join(root, 'global.ini'), 'utf8');
                expect(globalContent).toMatch('generate=2');
                expect(globalContent).not.toMatch('locale');
            });
        });

        await test('providers narrows available AIs', async () => {
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global', '[OLLAMA]', 'model=llama3'],
                    project: ['providers=ollama'],
                },
                async () => {
                    expect(getAvailableAIs(await getConfig({}), 'commit')).toEqual(['OLLAMA']);
                }
            );

            // The project list intersects the global one; it can never add a provider back
            await withLayers(
                {
                    global: ['providers=OPENAI', '[OPENAI]', 'key=sk-global', '[OLLAMA]', 'model=llama3'],
                    project: ['providers=OLLAMA'],
                },
                async () => {
                    expect(getAvailableAIs(await getConfig({}), 'commit')).toEqual([]);
                }
            );

            // Names are trimmed and case-insensitive
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global', '[OLLAMA]', 'model=llama3'],
                    project: ['providers= ollama , Claude_Code '],
                },
                async () => {
                    expect(getAvailableAIs(await getConfig({}), 'commit')).toEqual(['OLLAMA']);
                }
            );

            // An empty or non-list project value is dropped; it never lifts the global list
            for (const value of ['providers=', 'providers=,', 'providers=true']) {
                await withLayers(
                    {
                        global: ['providers=OLLAMA', '[OPENAI]', 'key=sk-global', '[OLLAMA]', 'model=llama3'],
                        project: [value],
                    },
                    async () => {
                        expect(getAvailableAIs(await getConfig({}), 'commit')).toEqual(['OLLAMA']);
                        const project = await readProjectConfig({ providers: 'OLLAMA' }, BUILTIN_SERVICES, parseProviderList);
                        expect(project?.ignored).toContain('providers');
                    }
                );
            }
        });

        await test('config set stores and clears providers', async () => {
            await withLayers({ global: ['[OPENAI]', 'key=sk-global', '[OLLAMA]', 'model=llama3'], project: [] }, async () => {
                await setConfigs([['providers', 'ollama,openai']]);
                invalidateConfigCache();
                expect((await getConfig({})).providers).toEqual(['OLLAMA', 'OPENAI']);

                await setConfigs([['providers', '']]);
                invalidateConfigCache();
                expect((await getConfig({})).providers).toBeUndefined();
            });
        });

        await test('rejects a non-list global providers value', async () => {
            await withLayers({ global: ['providers=true', '[OPENAI]', 'key=sk-global'], project: [] }, async () => {
                await expect(getConfig({})).rejects.toThrow(/Invalid config property providers/);
            });
        });

        await test('config path names the project file on stderr', async () => {
            await withLayers({ global: ['[OPENAI]', 'key=sk-global'], project: ['locale=ko'] }, async ({ root, repo }) => {
                const out: string[] = [];
                const err: string[] = [];
                const originalLog = console.log;
                const originalError = console.error;
                console.log = (line: string) => out.push(line);
                console.error = (line: string) => err.push(line);
                try {
                    await printConfigPath();
                } finally {
                    console.log = originalLog;
                    console.error = originalError;
                }
                expect(out).toEqual([path.join(root, 'global.ini')]);
                expect(err.join('\n')).toMatch(path.join(repo, '.aicommit2', 'config.ini'));
            });
        });

        await test('cannot opt in a provider by model', async () => {
            await withLayers(
                {
                    global: ['[OPENAI]', 'key=sk-global'],
                    project: ['[CLAUDE_CODE]', 'model=sonnet', '[OLLAMA]', 'model=llama3'],
                },
                async () => {
                    const config = await getConfig({});
                    expect(getAvailableAIs(config, 'commit')).toEqual(['OPENAI']);
                }
            );

            // A provider the user already opted into may switch models per project
            await withLayers(
                {
                    global: ['[OLLAMA]', 'model=llama3'],
                    project: ['[OLLAMA]', 'model=qwen2.5-coder'],
                },
                async () => {
                    const config = await getConfig({});
                    expect(getAvailableAIs(config, 'commit')).toEqual(['OLLAMA']);
                    expect(section(config, 'OLLAMA').model).toEqual(['qwen2.5-coder']);
                }
            );
        });
    });
});
