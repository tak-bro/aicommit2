/**
 * Claude 4.x model prefixes that don't support temperature + top_p combination.
 * These models reject API requests when both parameters are specified simultaneously.
 *
 * Naming patterns:
 * - claude-haiku-4-5-20251001 (haiku variant)
 * - claude-sonnet-4-5-20250929 (sonnet variant)
 * - claude-opus-4-5-20251101 (opus variant)
 */
const CLAUDE_FOUR_MODEL_PREFIXES = ['claude-4', 'claude-haiku-4', 'claude-sonnet-4', 'claude-opus-4'] as const;

/**
 * Checks if the model is a Claude 4.x series model.
 * Claude 4.x models don't support specifying both temperature and top_p simultaneously.
 *
 * @param model - The model identifier (e.g., "claude-haiku-4-5-20251001")
 * @returns true if the model is a Claude 4.x model, false otherwise
 *
 * @example
 * isClaudeFourModel('claude-haiku-4-5-20251001') // true
 * isClaudeFourModel('claude-sonnet-4-5-20250929') // true
 * isClaudeFourModel('claude-opus-4-5-20251101') // true
 * isClaudeFourModel('claude-3-5-haiku-20241022') // false
 * isClaudeFourModel('claude-3-sonnet-20240229') // false
 */
export const isClaudeFourModel = (model: string): boolean => {
    const normalizedModel = model.toLowerCase();
    return CLAUDE_FOUR_MODEL_PREFIXES.some(
        prefix => normalizedModel === prefix || normalizedModel.startsWith(`${prefix}-`) || normalizedModel.startsWith(`${prefix}.`)
    );
};
