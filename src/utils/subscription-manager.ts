import { Observable, Subject, Subscription } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

/**
 * Centralized subscription manager
 * Prevents memory leaks and ensures safe subscription cleanup.
 */
export class SubscriptionManager {
    private destroyed$ = new Subject<void>();
    private subscriptions = new Subscription();
    private isDestroyed = false;
    private readonly name: string;

    constructor(name = 'SubscriptionManager') {
        this.name = name;
    }

    /**
     * Safely subscribes to Observable and automatically cleans up.
     */
    add<T>(
        observable: Observable<T>,
        observer?: {
            next?: (value: T) => void;
            error?: (error: Error) => void;
            complete?: () => void;
        }
    ): Subscription {
        if (this.isDestroyed) {
            console.warn(`${this.name}: Cannot add subscription - manager is destroyed`);
            const emptySubscription = new Subscription();
            emptySubscription.unsubscribe();
            return emptySubscription;
        }

        const subscription = observable
            .pipe(
                takeUntil(this.destroyed$),
                finalize(() => {
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`${this.name}: Observable finalized`);
                    }
                })
            )
            .subscribe({
                next: observer?.next,
                error: error => {
                    console.error(`${this.name}: Observable error:`, error);
                    observer?.error?.(error);
                },
                complete: observer?.complete,
            });

        this.subscriptions.add(subscription);
        return subscription;
    }

    /**
     * Returns Observable with takeUntil pattern applied.
     */
    pipe<T>(observable: Observable<T>): Observable<T> {
        if (this.isDestroyed) {
            console.warn(`${this.name}: Cannot pipe - manager is destroyed`);
            return observable;
        }

        return observable.pipe(
            takeUntil(this.destroyed$),
            finalize(() => {
                if (process.env.NODE_ENV === 'development') {
                    console.log(`${this.name}: Piped observable finalized`);
                }
            })
        );
    }

    /**
     * Manually adds a subscription.
     */
    addSubscription(subscription: Subscription): void {
        if (this.isDestroyed) {
            console.warn(`${this.name}: Cannot add subscription - manager is destroyed`);
            subscription.unsubscribe();
            return;
        }

        this.subscriptions.add(subscription);
    }

    /**
     * Returns destruction signal (for use with takeUntil).
     */
    get destroySignal$(): Observable<void> {
        return this.destroyed$.asObservable();
    }

    /**
     * Checks if the manager has been destroyed.
     */
    get isActive(): boolean {
        return !this.isDestroyed;
    }

    /**
     * Unsubscribes all subscriptions and destroys the manager.
     */
    destroy(): void {
        if (this.isDestroyed) {
            return;
        }

        this.isDestroyed = true;

        this.subscriptions.unsubscribe();

        this.destroyed$.next();
        this.destroyed$.complete();

        if (process.env.NODE_ENV === 'development') {
            console.log(`${this.name}: Destroyed successfully`);
        }
    }
}

/**
 * Default subscription manager instance
 */
export const defaultSubscriptionManager = new SubscriptionManager('Global');

/**
 * Cleanup default manager on process exit
 */
const cleanup = () => {
    defaultSubscriptionManager.destroy();
};

process.on('exit', cleanup);
process.on('SIGINT', () => {
    cleanup();
    // Registering a listener disables Node's default SIGINT exit, so exit here (128 + SIGINT).
    // cli.ts loads this module at startup through watch-git.ts, so every command gets this handler.
    // Other modules' cleanup runs through their 'exit' listeners or by prepending their own handler.
    process.exit(130);
});
process.on('SIGTERM', () => {
    cleanup();
    // Same reason as SIGINT: a listener disables Node's default exit (128 + SIGTERM)
    process.exit(143);
});
process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    cleanup();
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    cleanup();
    process.exit(1);
});
