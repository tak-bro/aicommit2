import { expect, testSuite } from 'manten';
import { Observable, Subject, of } from 'rxjs';

import { AIService } from '../../../src/services/ai/ai.service.js';

import type { ReactiveListChoice } from 'inquirer-reactive-list-prompt';

/**
 * Minimal concrete AIService that exposes the protected streaming factory so the
 * teardown contract can be exercised without a real provider SDK.
 */
class TestService extends AIService {
    generateCommitMessage$ = (): Observable<ReactiveListChoice> => of();
    generateCodeReview$ = (): Observable<ReactiveListChoice> => of();

    runStream = (producer: (subject: Subject<string>, signal: AbortSignal) => void): Observable<ReactiveListChoice> =>
        this.createStreamingCommitMessages$(producer, 'conventional', 1);
}

const makeService = (): TestService =>
    new TestService({
        config: {},
        stagedDiff: { files: [], diff: '' },
        keyName: 'OPENAI',
    } as never);

const tick = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

export default testSuite(({ describe }) => {
    describe('streaming abort', ({ test }) => {
        test('passes an AbortSignal to the producer', () => {
            const service = makeService();
            let received: AbortSignal | undefined;

            const sub = service
                .runStream((_subject, signal) => {
                    received = signal;
                })
                .subscribe();

            expect(received).toBeDefined();
            expect(received?.aborted).toBe(false);
            sub.unsubscribe();
        });

        test('aborts the signal when the subscriber unsubscribes early', () => {
            const service = makeService();
            let received: AbortSignal | undefined;

            // Producer never completes the subject — mimics a stream still in flight.
            const sub = service
                .runStream((_subject, signal) => {
                    received = signal;
                })
                .subscribe();

            expect(received?.aborted).toBe(false);
            sub.unsubscribe();
            expect(received?.aborted).toBe(true);
        });

        test('an abort-triggered subject.error does not escape as an unhandled rejection', async () => {
            const service = makeService();
            const rejections: unknown[] = [];
            const onRejection = (reason: unknown) => rejections.push(reason);
            process.on('unhandledRejection', onRejection);

            try {
                const sub = service
                    .runStream((subject, signal) => {
                        // A realistic producer rejects with AbortError on abort and routes
                        // it into the subject, which by then has no downstream subscriber.
                        const failOnAbort = new Promise<void>((_resolve, reject) => {
                            signal.addEventListener('abort', () => reject(new Error('AbortError')));
                        });
                        failOnAbort.catch(err => subject.error(err));
                    })
                    .subscribe();

                sub.unsubscribe();
                await tick();
                await tick();

                expect(rejections.length).toBe(0);
            } finally {
                process.removeListener('unhandledRejection', onRejection);
            }
        });
    });
});
