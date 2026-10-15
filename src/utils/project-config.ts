import fs from 'fs/promises';
import path from 'path';

import ini from 'ini';

import { KnownError } from './error.js';
import { fileExists } from './fs.js';
import { expandDottedKeys } from './ini-keys.js';

import type { RawConfig } from './config.js';

export const PROJECT_CONFIG_RELATIVE_PATH = path.join('.aicommit2', 'config.ini');

/**
 * Keys a repository may set. The file comes from whoever wrote the repository, so anything that
 * carries a secret, picks an endpoint, writes files or authenticates is left to the global config.
 * Top-level `model` is excluded too: it falls through to every provider and would opt them in.
 */
const PROJECT_SAFE_KEYS = new Set([
    'locale',
    'generate',
    'type',
    'maxLength',
    'includeBody',
    'systemPrompt',
    'systemPromptPath',
    'codeReviewPromptPath',
    'exclude',
    'excludeGenerated',
    'model',
    'temperature',
    'topP',
    'maxTokens',
    'timeout',
    'codeReview',
    'disabled',
    'stream',
    'disableLowerCase',
    'ticketExtraction',
    'learnConventions',
    'diffCompression',
    'maxHunkLines',
    'maxDiffLines',
    'diffContext',
    'providers',
]);

const PROMPT_PATH_KEYS = new Set(['systemPromptPath', 'codeReviewPromptPath']);

// Providers that turn on from a configured model alone (see getAvailableAIs)
const MODEL_OPT_IN_PROVIDERS = new Set(['OLLAMA', 'CLAUDE_CODE', 'GEMINI_CLI', 'COPILOT_SDK', 'BEDROCK']);

export interface ProjectConfig {
    path: string;
    config: RawConfig;
    /** Entries dropped from the project layer, as `KEY`, `SECTION.key` or `[SECTION]` */
    ignored: string[];
}

interface FilterContext {
    root: string;
    configDir: string;
    global: RawConfig;
    builtinServices: readonly string[];
    ignored: string[];
}

const isSection = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isFile = (filePath: string) =>
    fs.stat(filePath).then(
        stats => stats.isFile(),
        () => false
    );

const hasVcsMarker = async (dir: string) => (await fileExists(path.join(dir, '.git'))) || (await fileExists(path.join(dir, '.jj')));

/**
 * Nearest `.aicommit2/config.ini` between `startDir` and the repository root (first directory holding
 * `.git` or `.jj`). Outside a repository only `startDir` itself is checked.
 */
export const findProjectConfigPath = async (startDir: string = process.cwd()): Promise<{ configPath: string; root: string } | null> => {
    const start = path.resolve(startDir);
    const visited: string[] = [];
    let root: string | null = null;

    for (let dir = start; ; dir = path.dirname(dir)) {
        visited.push(dir);
        if (await hasVcsMarker(dir)) {
            root = dir;
            break;
        }
        if (path.dirname(dir) === dir) {
            break;
        }
    }

    for (const dir of root ? visited : [start]) {
        const configPath = path.join(dir, PROJECT_CONFIG_RELATIVE_PATH);
        if (await isFile(configPath)) {
            return { configPath, root: root ?? start };
        }
    }
    return null;
};

/**
 * Resolve a prompt path from the project file against its directory. Returns null unless the real
 * path (symlinks followed) is an existing file inside the repository, so a cloned repository cannot
 * pull `~/.ssh/id_rsa` or `/etc/hosts` into the prompt sent to a provider.
 */
const confinePromptPath = async (value: unknown, ctx: FilterContext): Promise<string | null> => {
    if (typeof value !== 'string' || !value || path.isAbsolute(value)) {
        return null;
    }
    try {
        const [realRoot, realPath] = await Promise.all([fs.realpath(ctx.root), fs.realpath(path.resolve(ctx.configDir, value))]);
        const relative = path.relative(realRoot, realPath);
        const isInside = relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
        return isInside ? path.resolve(ctx.configDir, value) : null;
    } catch {
        return null;
    }
};

const hasGlobalModel = (global: RawConfig, provider: string) => {
    const globalSection = global[provider];
    return !!global.model || (isSection(globalSection) && !!globalSection.model);
};

const filterEntries = async (entries: Record<string, unknown>, ctx: FilterContext, provider?: string): Promise<RawConfig> => {
    const result: RawConfig = {};

    for (const [key, value] of Object.entries(entries)) {
        const name = provider ? `${provider}.${key}` : key;
        const isTopLevelModel = !provider && key === 'model';
        const isReEnable = key === 'disabled' && String(value) !== 'true';
        const isModelOptIn = key === 'model' && !!provider && MODEL_OPT_IN_PROVIDERS.has(provider) && !hasGlobalModel(ctx.global, provider);

        if (!PROJECT_SAFE_KEYS.has(key) || isSection(value) || isTopLevelModel || isReEnable || isModelOptIn) {
            ctx.ignored.push(name);
            continue;
        }

        if (PROMPT_PATH_KEYS.has(key)) {
            const confined = await confinePromptPath(value, ctx);
            if (!confined) {
                ctx.ignored.push(name);
                continue;
            }
            result[key] = confined;
            continue;
        }

        result[key] = value as RawConfig[string];
    }

    return result;
};

const filterProjectConfig = async (raw: Record<string, unknown>, ctx: FilterContext): Promise<RawConfig> => {
    const generalEntries: Record<string, unknown> = {};
    const result: RawConfig = {};

    for (const [name, value] of Object.entries(raw)) {
        if (!isSection(value)) {
            generalEntries[name] = value;
            continue;
        }

        // A new custom section would be a new endpoint; built-in sections may be added
        const isKnownSection = ctx.builtinServices.includes(name) || isSection(ctx.global[name]);
        if (!isKnownSection) {
            ctx.ignored.push(`[${name}]`);
            continue;
        }
        result[name] = (await filterEntries(value, ctx, name)) as RawConfig[string];
    }

    return { ...(await filterEntries(generalEntries, ctx)), ...result };
};

/**
 * Read the repository's `.aicommit2/config.ini`, keeping only the entries a repository may set.
 * Unlike the global file, `${VAR}` is not expanded: a repository could otherwise write an API key
 * from the environment into a prompt and get it echoed into a commit message.
 */
export const readProjectConfig = async (
    global: RawConfig,
    builtinServices: readonly string[],
    startDir?: string
): Promise<ProjectConfig | null> => {
    const found = await findProjectConfigPath(startDir);
    if (!found) {
        return null;
    }

    let content: string;
    try {
        content = await fs.readFile(found.configPath, 'utf8');
    } catch (error) {
        throw new KnownError(`Failed to read project config file ${found.configPath}: ${(error as Error).message}`);
    }
    const ignored: string[] = [];
    const raw = expandDottedKeys(ini.parse(content), key => ignored.push(key)) as Record<string, unknown>;
    const ctx: FilterContext = { root: found.root, configDir: path.dirname(found.configPath), global, builtinServices, ignored };
    const config = await filterProjectConfig(raw, ctx);

    return { path: found.configPath, config, ignored: ctx.ignored };
};

/**
 * Overlay the project layer section by section: a project key replaces the global key of the same
 * section, untouched keys keep their global value.
 */
export const mergeProjectConfig = (global: RawConfig, project: RawConfig): RawConfig => {
    const merged: RawConfig = { ...global };
    for (const [name, value] of Object.entries(project)) {
        const globalValue = global[name];
        merged[name] = isSection(value) && isSection(globalValue) ? { ...globalValue, ...value } : value;
    }
    return merged;
};
