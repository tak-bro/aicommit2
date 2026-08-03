import { ConfigParser, SERVICE_NAME_PATTERN, getConfigParsers, getConfigPath, readConfigFile } from './config.js';
import { fileExists } from './fs.js';

export interface ConfigIssue {
    level: 'error' | 'warning';
    // `locale`, `OPENAI.model` or `[openai]` — where in the file the issue is
    location: string;
    message: string;
    hint?: string;
}

export interface ConfigValidation {
    configPath: string;
    exists: boolean;
    issues: ConfigIssue[];
}

const isSection = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const editDistance = (a: string, b: string): number => {
    let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i++) {
        const current = [i];
        for (let j = 1; j <= b.length; j++) {
            const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
            current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
        }
        previous = current;
    }
    return previous[b.length];
};

/**
 * Closest accepted key for a key nothing accepts — case differences first, then typos.
 */
const suggestKey = (key: string, knownKeys: string[]): string | undefined => {
    const lowered = key.toLowerCase();
    const caseMatch = knownKeys.find(known => known.toLowerCase() === lowered);
    if (caseMatch) {
        return caseMatch;
    }
    const [closest] = knownKeys
        .map(known => ({ known, distance: editDistance(lowered, known.toLowerCase()) }))
        .filter(({ distance }) => distance <= 2)
        .sort((first, second) => first.distance - second.distance);
    return closest?.known;
};

const unknownKeyIssue = (location: string, key: string, knownKeys: string[]): ConfigIssue => {
    const suggestion = suggestKey(key, knownKeys);
    return {
        level: 'warning',
        location,
        message: 'Unknown option, silently ignored.',
        hint: suggestion && `Did you mean \`${suggestion}\`?`,
    };
};

const invalidSectionIssue = (name: string): ConfigIssue => {
    const upperCased = name.toUpperCase();
    return {
        level: 'error',
        location: `[${name}]`,
        message: 'Invalid section name, so the whole section is ignored. Names must be uppercase letters, numbers and underscores.',
        hint: SERVICE_NAME_PATTERN.test(upperCased) ? `Did you mean [${upperCased}]?` : undefined,
    };
};

/**
 * Run one parser over one raw value, turning a rejection into an issue instead of aborting.
 * `getConfig` throws on the first bad value; validation reports every one of them.
 */
const validateValue = (parse: ConfigParser, location: string, value: unknown): ConfigIssue | null => {
    try {
        parse(value);
        return null;
    } catch (error) {
        return { level: 'error', location, message: (error as Error).message };
    }
};

/**
 * Everything wrong with one `key=value`: either no parser accepts the key, or the parser
 * that does rejects the value. Same rule for a top-level option and a key inside a section.
 */
const checkEntry = (
    parsers: Record<string, ConfigParser>,
    knownKeys: string[],
    location: string,
    key: string,
    value: unknown
): ConfigIssue[] => {
    const parse = parsers[key];
    if (!parse) {
        return [unknownKeyIssue(location, key, knownKeys)];
    }
    const issue = validateValue(parse, location, value);
    return issue ? [issue] : [];
};

/**
 * Check the config file against the parsers the rest of the CLI runs on, reporting the
 * three things a normal run stays silent about: sections dropped for an invalid name,
 * keys no parser accepts, and values a parser rejects.
 */
export const validateConfigFile = async (): Promise<ConfigValidation> => {
    const configPath = await getConfigPath();
    const exists = await fileExists(configPath);
    if (!exists) {
        return { configPath, exists, issues: [] };
    }

    // Throws a KnownError naming the file when it cannot be read or parsed
    const config = await readConfigFile();
    const generalParsers = getConfigParsers();
    const generalKeys = Object.keys(generalParsers);
    const issues: ConfigIssue[] = [];

    for (const [name, value] of Object.entries(config)) {
        if (!isSection(value)) {
            issues.push(...checkEntry(generalParsers, generalKeys, name, name, value));
            continue;
        }

        if (!SERVICE_NAME_PATTERN.test(name)) {
            issues.push(invalidSectionIssue(name));
            continue;
        }

        const sectionParsers = getConfigParsers(name);
        const sectionKeys = Object.keys(sectionParsers);
        for (const [key, rawValue] of Object.entries(value)) {
            issues.push(...checkEntry(sectionParsers, sectionKeys, `${name}.${key}`, key, rawValue));
        }
    }

    return { configPath, exists, issues };
};
