import { ReactiveListChoice } from 'inquirer-reactive-list-prompt';
import { expect, testSuite } from 'manten';
import { Observable, of } from 'rxjs';

import { AIResponse, AIService, AIServiceParams } from '../../../src/services/ai/ai.service.js';
import { getSubjectLengthMarker } from '../../../src/utils/utils.js';

const subjectOf = (length: number, char = 'a') => char.repeat(length);

class ChoiceAIService extends AIService {
    constructor(params: AIServiceParams) {
        super(params);
    }

    generateCommitMessage$(): Observable<ReactiveListChoice> {
        return of();
    }

    generateCodeReview$(): Observable<ReactiveListChoice> {
        return of();
    }

    toChoice(data: AIResponse): ReactiveListChoice {
        return this.formatAsChoice(data);
    }
}

const createService = (config: { maxLength?: number; includeBody?: boolean }) =>
    // Stub params: formatAsChoice reads only config.maxLength and config.includeBody
    new ChoiceAIService({
        config: { model: 'm', ...config },
        stagedDiff: { diff: '', files: [] },
        keyName: 'OPENAI',
    } as unknown as AIServiceParams);

export default testSuite(({ describe }) => {
    describe('getSubjectLengthMarker', ({ test }) => {
        // The default maxLength (50) is below what most real subjects use, so the marker
        // only fires past git's 72-char hard limit unless the user configured a larger one
        test('no marker between maxLength and 72', () => {
            expect(getSubjectLengthMarker(subjectOf(62), 50)).toBe('');
        });

        test('no marker at exactly 72', () => {
            expect(getSubjectLengthMarker(subjectOf(72), 50)).toBe('');
        });

        test('marks a subject past 72', () => {
            expect(getSubjectLengthMarker(subjectOf(80), 50)).toBe(' (80>72)');
        });

        test('a configured maxLength above 72 raises the threshold', () => {
            expect(getSubjectLengthMarker(subjectOf(90), 100)).toBe('');
            expect(getSubjectLengthMarker(subjectOf(101), 100)).toBe(' (101>100)');
        });

        test('falls back to 72 when maxLength is unset', () => {
            expect(getSubjectLengthMarker(subjectOf(73))).toBe(' (73>72)');
        });

        test('counts code points, so CJK and emoji count one each', () => {
            expect(getSubjectLengthMarker(subjectOf(72, '한'), 50)).toBe('');
            expect(getSubjectLengthMarker(subjectOf(73, '😀'), 50)).toBe(' (73>72)');
        });
    });

    describe('formatAsChoice length marker', ({ test }) => {
        const title = subjectOf(80);

        // `short` and `value` are what gets committed and printed by -d / --output json
        test('marks the picker row only', () => {
            const choice = createService({ maxLength: 50 }).toChoice({ title, value: title });
            expect(choice.name).toMatch('(80>72)');
            expect(choice.short).toBe(title);
            expect(choice.value).toBe(title);
        });

        test('with includeBody, the body neither counts nor carries the marker', () => {
            const value = `${subjectOf(10)}\n\n${subjectOf(200)}`;
            const choice = createService({ maxLength: 50, includeBody: true }).toChoice({ title: subjectOf(10), value });
            expect(choice.name).not.toMatch('>72)');
            expect(choice.value).toBe(value);
            expect(choice.description).toBe(value);
        });
    });
});
