import { expect, testSuite } from 'manten';
import { Subscription } from 'rxjs';

import { ReactivePromptManager, commitMsgLoader } from '../../../src/managers/reactive-prompt.manager.js';

export default testSuite(({ describe }) => {
    describe('ReactivePromptManager', ({ test }) => {
        test('should initialize correctly', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);
            expect(manager).toBeDefined();
            expect(manager.inquirerInstance).toBe(null);
        });

        test('should handle destroyed state correctly', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);

            // Should accept choices before destroy
            const mockChoice = {
                name: 'Test Choice',
                value: 'test-value',
                isError: false,
                disabled: false,
            };

            // This should work normally
            manager.refreshChoices(mockChoice);

            // Destroy the manager
            manager.destroy();

            // Should ignore choices after destroy
            manager.refreshChoices(mockChoice);

            // Should not be able to add subscriptions after destroy
            const mockSubscription = new Subscription();
            manager.addSubscription(mockSubscription);

            // Mock subscription should be unsubscribed
            expect(mockSubscription.closed).toBe(true);
        });

        test('should manage subscriptions correctly', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);

            const subscription1 = new Subscription();
            const subscription2 = new Subscription();

            // Add subscriptions
            manager.addSubscription(subscription1);
            manager.addSubscription(subscription2);

            // Both should still be open
            expect(subscription1.closed).toBe(false);
            expect(subscription2.closed).toBe(false);

            // Destroy manager
            manager.destroy();

            // Both subscriptions should be closed
            expect(subscription1.closed).toBe(true);
            expect(subscription2.closed).toBe(true);
        });

        test('should handle multiple destroy calls safely', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);

            // First destroy should work
            expect(() => manager.destroy()).not.toThrow();

            // Second destroy should be ignored
            expect(() => manager.destroy()).not.toThrow();

            // Third destroy should also be ignored
            expect(() => manager.destroy()).not.toThrow();
        });

        test('should handle subject completion errors gracefully', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);

            // Manually complete the subjects to cause potential errors
            (manager as any).choices$.complete();
            (manager as any).loader$.complete();
            (manager as any).destroyed$.complete();

            // This should not throw even with completed subjects
            expect(() => manager.destroy()).not.toThrow();
        });

        test('should prevent operations on destroyed manager', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);

            manager.destroy();

            // These operations should be safe to call but have no effect
            expect(() => manager.startLoader()).not.toThrow();
            expect(() => manager.clearLoader()).not.toThrow();
            expect(() => manager.cancel()).not.toThrow();
            expect(() => manager.closeInquirerInstance()).not.toThrow();

            const mockChoice = {
                name: 'Test Choice',
                value: 'test-value',
                isError: false,
                disabled: false,
            };

            // refreshChoices should return early for destroyed manager
            expect(() => manager.refreshChoices(mockChoice)).not.toThrow();
        });

        test('should handle empty or invalid choices gracefully', () => {
            const manager = new ReactivePromptManager(commitMsgLoader);

            // Test with null choice
            expect(() => manager.refreshChoices(null as any)).not.toThrow();

            // Test with undefined choice
            expect(() => manager.refreshChoices(undefined as any)).not.toThrow();

            // Test with choice without value
            const choiceWithoutValue = {
                name: 'Test Choice',
                value: '',
                isError: false,
                disabled: false,
            };
            expect(() => manager.refreshChoices(choiceWithoutValue)).not.toThrow();

            manager.destroy();
        });
    });
});
