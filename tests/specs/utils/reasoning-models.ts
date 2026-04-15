import { expect, testSuite } from 'manten';

import { isReasoningCapableModel } from '../../../src/utils/reasoning-models.js';

export default testSuite(({ describe }) => {
    describe('isReasoningCapableModel', ({ test }) => {
        test('should detect OpenAI reasoning models', () => {
            expect(isReasoningCapableModel('o1')).toBe(true);
            expect(isReasoningCapableModel('o3')).toBe(true);
            expect(isReasoningCapableModel('o3-mini')).toBe(true);
            expect(isReasoningCapableModel('o4-mini')).toBe(true);
            expect(isReasoningCapableModel('o1-pro')).toBe(true);
            expect(isReasoningCapableModel('o3-pro')).toBe(true);
        });

        test('should detect GPT-5 series', () => {
            expect(isReasoningCapableModel('gpt-5')).toBe(true);
            expect(isReasoningCapableModel('gpt-5-mini')).toBe(true);
            expect(isReasoningCapableModel('gpt-5-nano')).toBe(true);
            expect(isReasoningCapableModel('gpt-5-codex')).toBe(true);
        });

        test('should detect with version suffixes', () => {
            expect(isReasoningCapableModel('o3-mini-2025-01-31')).toBe(true);
            expect(isReasoningCapableModel('gpt-5.2')).toBe(true);
            expect(isReasoningCapableModel('gpt-5-preview')).toBe(true);
        });

        test('should detect with provider prefix', () => {
            expect(isReasoningCapableModel('openai/o3')).toBe(true);
            expect(isReasoningCapableModel('openai/gpt-5')).toBe(true);
            expect(isReasoningCapableModel('openai/gpt-4o')).toBe(false);
        });

        test('should detect DeepSeek reasoning models', () => {
            expect(isReasoningCapableModel('deepseek-reasoner')).toBe(true);
            expect(isReasoningCapableModel('deepseek-r1')).toBe(true);
            expect(isReasoningCapableModel('deepseek-r1-distill-qwen-7b')).toBe(true);
            expect(isReasoningCapableModel('deepseek-chat')).toBe(false);
        });

        test('should detect Gemini 2.5 thinking models', () => {
            expect(isReasoningCapableModel('gemini-2.5-pro')).toBe(true);
            expect(isReasoningCapableModel('gemini-2.5-flash-preview')).toBe(true);
            expect(isReasoningCapableModel('gemini-2.0-flash')).toBe(false);
            expect(isReasoningCapableModel('gemini-3-flash-preview')).toBe(false);
        });

        test('should detect QwQ and Qwen3 reasoning models', () => {
            expect(isReasoningCapableModel('qwq')).toBe(true);
            expect(isReasoningCapableModel('qwq-32b')).toBe(true);
            expect(isReasoningCapableModel('qwq-32b-preview')).toBe(true);
            expect(isReasoningCapableModel('qwen3')).toBe(true);
            expect(isReasoningCapableModel('qwen3-8b')).toBe(true);
        });

        test('should detect phi4-mini-reasoning and smallthinker', () => {
            expect(isReasoningCapableModel('phi4-mini-reasoning')).toBe(true);
            expect(isReasoningCapableModel('smallthinker')).toBe(true);
            expect(isReasoningCapableModel('smallthinker-3b')).toBe(true);
        });

        test('should handle Ollama tag format (model:tag)', () => {
            expect(isReasoningCapableModel('qwen3:4b')).toBe(true);
            expect(isReasoningCapableModel('qwen3:0.6b')).toBe(true);
            expect(isReasoningCapableModel('deepseek-r1:1.5b')).toBe(true);
            expect(isReasoningCapableModel('deepseek-r1:7b')).toBe(true);
            expect(isReasoningCapableModel('phi4-mini-reasoning:latest')).toBe(true);
            expect(isReasoningCapableModel('llama3.2:latest')).toBe(false);
        });

        test('should be case insensitive', () => {
            expect(isReasoningCapableModel('O3')).toBe(true);
            expect(isReasoningCapableModel('GPT-5')).toBe(true);
            expect(isReasoningCapableModel('DeepSeek-Reasoner')).toBe(true);
            expect(isReasoningCapableModel('Qwen3:4B')).toBe(true);
        });

        test('should not match standard models', () => {
            expect(isReasoningCapableModel('gpt-4o')).toBe(false);
            expect(isReasoningCapableModel('gpt-4o-mini')).toBe(false);
            expect(isReasoningCapableModel('gpt-4-turbo')).toBe(false);
            expect(isReasoningCapableModel('claude-sonnet-4-5')).toBe(false);
            expect(isReasoningCapableModel('gemini-pro')).toBe(false);
            expect(isReasoningCapableModel('llama-3.3-70b')).toBe(false);
            expect(isReasoningCapableModel('qwen2.5:7b')).toBe(false);
        });

        test('should not false-positive on similar names', () => {
            expect(isReasoningCapableModel('gpt-50')).toBe(false);
            expect(isReasoningCapableModel('o10')).toBe(false);
            expect(isReasoningCapableModel('o1x')).toBe(false);
            expect(isReasoningCapableModel('')).toBe(false);
        });
    });
});
