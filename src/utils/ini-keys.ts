// Writing these segments through a plain object reaches Object.prototype, not a nested section
const UNSAFE_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Turn `OPENAI.key=...` written at the top level of an INI file into an `[OPENAI]` section entry.
 * Keys with a `__proto__`/`constructor`/`prototype` segment are dropped and passed to `onUnsafeKey`
 * as their full dotted path, so a config file cannot pollute Object.prototype.
 */
export const expandDottedKeys = (value: unknown, onUnsafeKey?: (key: string) => void, prefix = ''): unknown => {
    if (Array.isArray(value) || value === null || typeof value !== 'object') {
        return value;
    }

    const result: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const parts = key.split('.');
        if (parts.some(part => UNSAFE_SEGMENTS.has(part))) {
            onUnsafeKey?.(fullKey);
            continue;
        }

        const normalizedValue = expandDottedKeys(nestedValue, onUnsafeKey, fullKey);
        let current: Record<string, unknown> = result;

        for (const part of parts.slice(0, -1)) {
            const existing = current[part];
            if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
                current[part] = {};
            }
            current = current[part] as Record<string, unknown>;
        }

        current[parts[parts.length - 1]] = normalizedValue;
    }

    return result;
};
