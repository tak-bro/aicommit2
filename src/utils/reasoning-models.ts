/**
 * Provider-agnostic reasoning model detection.
 *
 * Reasoning models perform internal chain-of-thought and benefit from
 * goal-oriented prompts rather than rule-heavy instructions.
 *
 * This is a hardcoded list of known reasoning models.
 * New models require manual additions here.
 *
 * Covered:
 * - OpenAI: o1, o3, o4-mini, gpt-5 series
 * - DeepSeek: deepseek-v4-flash, deepseek-v4-pro, deepseek-reasoner, deepseek-r1
 * - Google: gemini-2.5-* (thinking models)
 * - Alibaba: qwq, qwen3 (thinking mode)
 * - Microsoft: phi4-mini-reasoning
 * - SmallThinker (fine-tuned Qwen2.5)
 */

// Prefix-matched: matches "prefix", "prefix-*", "prefix.*"
const REASONING_PREFIXES: readonly string[] = [
    // OpenAI
    'o1',
    'o3',
    'o4-mini',
    'gpt-5',
    // DeepSeek
    'deepseek-v4-flash',
    'deepseek-v4-pro',
    'deepseek-reasoner',
    'deepseek-r1',
    // Alibaba
    'qwq',
    'qwen3',
    // Microsoft
    'phi4-mini-reasoning',
    // Community
    'smallthinker',
];

// Substring-matched: matches if model name contains the string
const REASONING_SUBSTRINGS: readonly string[] = ['gemini-2.5'];

/**
 * Checks if the given model is a reasoning-capable model across all providers.
 *
 * @param model - The model identifier (may include provider prefix like "openai/o3")
 * @returns true if the model uses internal reasoning/thinking
 *
 * @example
 * isReasoningCapableModel('o3-mini') // true
 * isReasoningCapableModel('deepseek-r1:7b') // true
 * isReasoningCapableModel('qwen3:4b') // true
 * isReasoningCapableModel('gpt-4o') // false
 */
export const isReasoningCapableModel = (model: string): boolean => {
    const normalized = model.toLowerCase();
    // Strip provider prefix (e.g., "openai/o3" → "o3")
    const bare = normalized.includes('/') ? normalized.split('/').pop() || normalized : normalized;
    // Strip Ollama tag suffix (e.g., "qwen3:4b" → "qwen3")
    const withoutTag = bare.includes(':') ? bare.split(':')[0] : bare;

    if (REASONING_SUBSTRINGS.some(substr => withoutTag.includes(substr))) {
        return true;
    }

    return REASONING_PREFIXES.some(
        prefix => withoutTag === prefix || withoutTag.startsWith(`${prefix}-`) || withoutTag.startsWith(`${prefix}.`)
    );
};
