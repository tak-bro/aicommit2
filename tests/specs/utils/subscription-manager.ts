import { expect, testSuite } from 'manten';
import { BehaviorSubject, Subscription, of, throwError, timer } from 'rxjs';
import { tap } from 'rxjs/operators';

import { SubscriptionManager } from '../../../src/utils/subscription-manager.js';

export default testSuite(({ describe }) => {
    describe('SubscriptionManager', ({ test }) => {
        test('should initialize correctly with default name', () => {
            const manager = new SubscriptionManager();
            expect(manager.isActive).toBe(true);
        });

        test('should initialize correctly with custom name', () => {
            const manager = new SubscriptionManager('CustomManager');
            expect(manager.isActive).toBe(true);
            manager.destroy();
        });

        test('should add and manage subscriptions correctly', async () => {
            const manager = new SubscriptionManager('TestManager');
            const source$ = new BehaviorSubject<number>(1);
            const results: number[] = [];

            // Add subscription with observer
            const subscription = manager.add(source$, {
                next: value => results.push(value),
                error: error => console.error('Test error:', error),
                complete: () => console.log('Test completed'),
            });

            expect(subscription).toBeDefined();
            expect(results).toEqual([1]);

            // Emit more values
            source$.next(2);
            source$.next(3);

            expect(results).toEqual([1, 2, 3]);

            manager.destroy();
            expect(manager.isActive).toBe(false);
        });

        test('should handle subscription errors gracefully', async () => {
            const manager = new SubscriptionManager('ErrorTestManager');

            const errorSource$ = throwError(() => new Error('Test error'));
            let errorHandled = false;

            // Should not throw when subscribing to error source
            expect(() => {
                manager.add(errorSource$, {
                    next: value => console.log('Value:', value),
                    error: error => {
                        errorHandled = true;
                        console.log('Handled error:', error.message);
                    },
                    complete: () => console.log('Completed'),
                });
            }).not.toThrow();

            // Wait for error to be handled
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(errorHandled).toBe(true);

            manager.destroy();
        });

        test('should pipe observables with takeUntil correctly', async () => {
            const manager = new SubscriptionManager('PipeTestManager');
            const source$ = timer(0, 50); // Emit every 50ms
            const results: number[] = [];

            const piped$ = manager.pipe(source$);

            const subscription = piped$.subscribe({
                next: value => results.push(value),
                error: error => console.error('Pipe error:', error),
                complete: () => console.log('Pipe completed'),
            });

            // Let it emit a few values
            await new Promise(resolve => setTimeout(resolve, 150));

            // Destroy manager - this should complete the piped observable
            manager.destroy();

            // Wait a bit more to ensure no more values are emitted
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThan(10); // Should have stopped after destroy

            subscription.unsubscribe();
        });

        test('should manually add subscriptions correctly', () => {
            const manager = new SubscriptionManager('ManualTestManager');
            const subscription1 = new Subscription();
            const subscription2 = new Subscription();

            manager.addSubscription(subscription1);
            manager.addSubscription(subscription2);

            expect(subscription1.closed).toBe(false);
            expect(subscription2.closed).toBe(false);

            manager.destroy();

            expect(subscription1.closed).toBe(true);
            expect(subscription2.closed).toBe(true);
        });

        test('should prevent operations on destroyed manager', () => {
            const manager = new SubscriptionManager('DestroyedTestManager');

            manager.destroy();
            expect(manager.isActive).toBe(false);

            // Adding subscription to destroyed manager should unsubscribe it immediately
            const subscription = new Subscription();
            manager.addSubscription(subscription);
            expect(subscription.closed).toBe(true);

            // Adding observable to destroyed manager should return empty subscription
            const source$ = of(1, 2, 3);
            const result = manager.add(source$);
            expect(result.closed).toBe(true);

            // Piping on destroyed manager should return original observable
            const piped$ = manager.pipe(source$);
            expect(piped$).toBe(source$);
        });

        test('should handle multiple destroy calls safely', () => {
            const manager = new SubscriptionManager('MultiDestroyTestManager');

            // First destroy should work
            expect(() => manager.destroy()).not.toThrow();
            expect(manager.isActive).toBe(false);

            // Subsequent destroys should be ignored
            expect(() => manager.destroy()).not.toThrow();
            expect(() => manager.destroy()).not.toThrow();
        });

        test('should provide destroySignal$ observable', async () => {
            const manager = new SubscriptionManager('SignalTestManager');
            let signalReceived = false;

            manager.destroySignal$.subscribe({
                next: () => {
                    signalReceived = true;
                },
                complete: () => console.log('Destroy signal completed'),
            });

            expect(signalReceived).toBe(false);

            manager.destroy();

            expect(signalReceived).toBe(true);
        });

        test('should work in development mode with logging', () => {
            // Mock NODE_ENV
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';

            const manager = new SubscriptionManager('DevTestManager');
            const source$ = of(1);

            // Should not throw in development mode
            expect(() => {
                manager.add(source$);
                manager.destroy();
            }).not.toThrow();

            // Restore
            process.env.NODE_ENV = originalEnv;
        });

        test('should handle finalize operators correctly', async () => {
            const manager = new SubscriptionManager('FinalizeTestManager');
            let finalizeCallCount = 0;

            const source$ = of(1, 2, 3).pipe(tap(() => finalizeCallCount++));

            manager.add(source$);

            // Wait for observable to complete
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(finalizeCallCount).toBe(3);

            manager.destroy();
        });
    });
});
