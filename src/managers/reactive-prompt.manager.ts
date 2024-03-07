import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListChoice, ReactiveListLoader } from 'inquirer-reactive-list-prompt';
import { BehaviorSubject, ReplaySubject } from 'rxjs';

const defaultLoader = {
    isLoading: false,
    startOption: {
        text: 'AI is analyzing your changes',
    },
};

export class ReactivePromptManager {
    private choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
    private loader$: BehaviorSubject<ReactiveListLoader> = new BehaviorSubject<ReactiveListLoader>(defaultLoader);
    private destroyed$: ReplaySubject<boolean> = new ReplaySubject(1);

    constructor() {}

    initPrompt() {
        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        return inquirer.prompt({
            type: 'reactiveListPrompt',
            name: 'aicommit2Prompt',
            message: 'Pick a commit message to use: ',
            emptyMessage: '⚠ No commit messages were generated',
            choices$: this.choices$,
            loader$: this.loader$,
        });
    }

    startLoader() {
        this.loader$.next({ isLoading: true });
    }

    refreshChoices(choice: ReactiveListChoice) {
        const { name, value, isError } = choice;
        if (!choice || !value) {
            return;
        }
        const currentChoices = this.choices$.getValue();
        this.choices$.next([
            ...currentChoices,
            {
                name,
                value,
                disabled: isError,
                isError,
            },
        ]);
    }

    checkErrorOnChoices() {
        const isAllError = this.choices$
            .getValue()
            .map(choice => choice as ReactiveListChoice)
            .every(value => value?.isError || value?.disabled);
        if (isAllError) {
            this.alertNoGeneratedMessage();
            return;
        }
        this.stopLoaderOnSuccess();
    }

    completeSubject() {
        this.choices$.complete();
        this.loader$.complete();
        this.destroyed$.next(true);
        this.destroyed$.complete();
    }

    private alertNoGeneratedMessage() {
        this.loader$.next({
            isLoading: false,
            message: 'No commit messages were generated',
            stopOption: {
                doneFrame: '⚠', // '✖'
                color: 'yellow', // 'red'
            },
        });
    }

    private stopLoaderOnSuccess() {
        this.loader$.next({ isLoading: false, message: 'Changes analyzed' });
    }
}
