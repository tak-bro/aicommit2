import { expect, testSuite } from 'manten';

import { IncrementalJsonParser } from '../../../src/utils/stream-json-parser.js';

export default testSuite(({ describe }) => {
    describe('IncrementalJsonParser', ({ test }) => {
        test('should parse a complete JSON array in one chunk', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('[{"subject": "feat: add auth"}, {"subject": "fix: login bug"}]');
            expect(results.length).toBe(2);
            expect(results[0].subject).toBe('feat: add auth');
            expect(results[1].subject).toBe('fix: login bug');
        });

        test('should parse incrementally across multiple chunks', () => {
            const parser = new IncrementalJsonParser();

            // First chunk: opening bracket + partial first object
            let results = parser.feed('[{"subject": "feat: ');
            expect(results.length).toBe(0);

            // Second chunk: completes first object
            results = parser.feed('add auth"}, ');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('feat: add auth');

            // Third chunk: second object
            results = parser.feed('{"subject": "fix: login"}]');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('fix: login');
        });

        test('should handle body and footer fields', () => {
            const parser = new IncrementalJsonParser();
            const json = '[{"subject": "feat: add auth", "body": "Add JWT tokens", "footer": "BREAKING CHANGE: removed session"}]';
            const results = parser.feed(json);

            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('feat: add auth');
            expect(results[0].body).toBe('Add JWT tokens');
            expect(results[0].footer).toBe('BREAKING CHANGE: removed session');
        });

        test('should skip objects without subject field', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('[{"body": "no subject here"}, {"subject": "valid"}]');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('valid');
        });

        test('should handle leading text (markdown fences)', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('```json\n[{"subject": "feat: auth"}]\n```');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('feat: auth');
        });

        test('should handle escaped quotes in strings', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('[{"subject": "fix: handle \\"edge\\" case"}]');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('fix: handle "edge" case');
        });

        test('should handle nested braces in string values', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('[{"subject": "fix: handle {braces} in message"}]');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('fix: handle {braces} in message');
        });

        test('should flush remaining content', () => {
            const parser = new IncrementalJsonParser();

            // Feed incomplete array (no closing bracket)
            parser.feed('[{"subject": "feat: first"}, {"subject": "feat: second"}');

            // Flush should pick up both
            const results = parser.flush();
            // Both objects are already complete, so feed already got them
            // flush just re-runs feed('')
            expect(results.length).toBe(0); // Already emitted in feed

            // Verify total via getBuffer
            expect(parser.getBuffer()).toContain('feat: first');
        });

        test('should handle token-by-token streaming', () => {
            const parser = new IncrementalJsonParser();
            const allResults: string[] = [];

            // Simulate token-by-token streaming
            const tokens = ['[', '{', '"sub', 'ject"', ': ', '"feat', ': add', ' auth', '"', '}', ']'];

            for (const token of tokens) {
                const results = parser.feed(token);
                for (const r of results) {
                    allResults.push(r.subject);
                }
            }

            expect(allResults.length).toBe(1);
            expect(allResults[0]).toBe('feat: add auth');
        });

        test('should handle empty input', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('');
            expect(results.length).toBe(0);
        });

        test('should handle input with no JSON array', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('This is not JSON at all');
            expect(results.length).toBe(0);
        });

        test('should handle malformed JSON objects gracefully', () => {
            const parser = new IncrementalJsonParser();
            // First object is malformed, second is valid
            const results = parser.feed('[{invalid json}, {"subject": "valid commit"}]');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('valid commit');
        });

        test('should set body/footer to undefined when not strings', () => {
            const parser = new IncrementalJsonParser();
            const results = parser.feed('[{"subject": "feat: test", "body": 123, "footer": true}]');
            expect(results.length).toBe(1);
            expect(results[0].subject).toBe('feat: test');
            expect(results[0].body).toBe(undefined);
            expect(results[0].footer).toBe(undefined);
        });

        test('should emit objects as soon as they complete (not wait for array end)', () => {
            const parser = new IncrementalJsonParser();
            const emissionOrder: number[] = [];

            // First complete object
            let results = parser.feed('[{"subject": "first"}');
            if (results.length > 0) {
                emissionOrder.push(1);
            }
            expect(results.length).toBe(1);

            // More text, then second object
            results = parser.feed(', {"subject": "second"}');
            if (results.length > 0) {
                emissionOrder.push(2);
            }
            expect(results.length).toBe(1);

            // Objects emitted incrementally, not batched
            expect(emissionOrder).toEqual([1, 2]);
        });
    });
});
