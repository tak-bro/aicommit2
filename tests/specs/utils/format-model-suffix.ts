import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { expect, testSuite } from 'manten';
import { Observable, of } from 'rxjs';

import { AIService, AIServiceParams } from '../../../src/services/ai/ai.service.js';
import { ModelNameDisplay } from '../../../src/utils/config.js';

// Minimal concrete subclass to expose protected formatModelSuffix
class TestAIService extends AIService {
    constructor(params: AIServiceParams) {
        super(params);
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return of();
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return of();
    }

    // Expose protected method for testing
    getModelSuffix(): string {
        return this.formatModelSuffix();
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal stub for testing
const createParams = (model: string, modelNameDisplay?: ModelNameDisplay): AIServiceParams =>
    ({
        config: { model },
        stagedDiff: { diff: '', files: [] },
        keyName: 'OPENAI',
        modelNameDisplay,
    }) as any;

export default testSuite(({ describe }) => {
    describe('formatModelSuffix', ({ test }) => {
        test('should return empty string when display is none', () => {
            const service = new TestAIService(createParams('gpt-4o-mini', 'none'));
            expect(service.getModelSuffix()).toBe('');
        });

        test('should return empty string when model is empty', () => {
            const service = new TestAIService(createParams('', 'short'));
            expect(service.getModelSuffix()).toBe('');
        });

        test('should return full model path when display is full', () => {
            const service = new TestAIService(createParams('meta-llama/llama-3.3-70b-versatile', 'full'));
            expect(service.getModelSuffix()).toBe('/meta-llama/llama-3.3-70b-versatile');
        });

        test('should return short model name (last segment) by default', () => {
            const service = new TestAIService(createParams('meta-llama/llama-3.3-70b-versatile'));
            expect(service.getModelSuffix()).toBe('/llama-3.3-70b-versa…');
        });

        test('should return short name without truncation for short models', () => {
            const service = new TestAIService(createParams('gpt-4o-mini', 'short'));
            expect(service.getModelSuffix()).toBe('/gpt-4o-mini');
        });

        test('should truncate to 20 chars with ellipsis when short name exceeds limit', () => {
            const service = new TestAIService(createParams('anthropic/claude-sonnet-4-20250514', 'short'));
            const suffix = service.getModelSuffix();
            // 'claude-sonnet-4-20250514' is 24 chars, truncated to 19 + '…'
            expect(suffix).toBe('/claude-sonnet-4-202…');
            // Total suffix length: / + 19 chars + … = 21
            expect(suffix.length).toBe(21);
        });

        test('should handle model without slashes in short mode', () => {
            const service = new TestAIService(createParams('deepseek-chat', 'short'));
            expect(service.getModelSuffix()).toBe('/deepseek-chat');
        });

        test('should handle model with multiple slashes in short mode', () => {
            const service = new TestAIService(createParams('org/team/model-name', 'short'));
            expect(service.getModelSuffix()).toBe('/model-name');
        });

        test('should default to short when modelNameDisplay is undefined', () => {
            const service = new TestAIService(createParams('gpt-4o-mini'));
            expect(service.getModelSuffix()).toBe('/gpt-4o-mini');
        });

        test('should handle exactly 20 char model name without truncation', () => {
            // 'twelve-chars-model20' is exactly 20 chars
            const service = new TestAIService(createParams('twelve-chars-model20', 'short'));
            expect(service.getModelSuffix()).toBe('/twelve-chars-model20');
        });

        test('should handle 21 char model name with truncation', () => {
            // 'twenty-one-chars-mod!' is 21 chars
            const service = new TestAIService(createParams('twenty-one-chars-mod!', 'short'));
            expect(service.getModelSuffix()).toBe('/twenty-one-chars-mo…');
        });
    });
});
