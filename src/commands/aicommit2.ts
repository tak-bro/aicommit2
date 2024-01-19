import { execa } from 'execa';
import { assertGitRepo, getDetectedMessage, getStagedDiff } from '../utils/git.js';
import { getConfig } from '../utils/config.js';
import { generateCommitMessage } from '../utils/openai.js';
import { KnownError } from '../utils/error.js';
import figlet from 'figlet';
import chalk from 'chalk';
import ora from 'ora';

import { BehaviorSubject, catchError, concatMap, EMPTY, from, map, mergeMap, of, tap } from 'rxjs';
import inquirer from 'inquirer';
import ReactiveListPrompt, { ChoiceItem, ReactiveListLoader } from 'inquirer-reactive-list-prompt';

export const createAsyncDelay = (duration: number) => {
    return new Promise<void>(resolve => setTimeout(() => resolve(), duration));
};

class AICommit2 {
    private title = 'aicommit2';

    constructor() {}

    displayTitle() {
        console.log(figlet.textSync(this.title, { font: 'Small' }));
    }

    async getStagedDiff(excludeFiles: string[]) {
        const detectingFilesSpinner = ora('Detecting staged files').start();
        const staged = await getStagedDiff(excludeFiles);

        detectingFilesSpinner.stop();
        detectingFilesSpinner.clear();
        if (!staged) {
            throw new KnownError(
                'No staged changes found. Stage your changes manually, or automatically stage all changes with the `--all` flag.'
            );
        }

        return staged;
    }

    displayStagedFiles(staged: { files: string[]; diff: string }) {
        console.log(chalk.bold.green('✔ ') + chalk.bold(`${getDetectedMessage(staged.files)}:`));
        console.log(`${staged.files.map(file => `     ${file}`).join('\n')}\n`);
    }
}

export default async (
    generate: number | undefined,
    excludeFiles: string[],
    stageAll: boolean,
    commitType: string | undefined,
    rawArgv: string[]
) =>
    (async () => {
        const aiCommit2 = new AICommit2();
        aiCommit2.displayTitle();

        await assertGitRepo();
        if (stageAll) {
            await execa('git', ['add', '--update']); // NOTE: should be equivalent behavior to `git commit --all`
        }

        const staged = await aiCommit2.getStagedDiff(excludeFiles);
        aiCommit2.displayStagedFiles(staged);

        const { env } = process;
        const config = await getConfig({
            OPENAI_KEY: env.OPENAI_KEY || env.OPENAI_API_KEY,
            BARD_KEY: env.BARD_KEY || env.BARD_API_KEY,
            proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
            generate: generate?.toString(),
            type: commitType?.toString(),
        });

        const availableAIs = Object.entries(config)
            .filter(([key]) => ['OPENAI_KEY', 'BARD_KEY'].includes(key))
            .filter(([_, value]) => !!value)
            .map(([key, _]) => key.split('_')[0]);

        const hasNoAvailableAIs = availableAIs.length === 0;
        if (hasNoAvailableAIs) {
            throw new KnownError('Please set at least one API key via `aicommit2 config set OPENAI_KEY=<your token>`');
        }

        // init inquirer list
        const choices: ChoiceItem[] = [];
        const choices$: BehaviorSubject<ChoiceItem[]> = new BehaviorSubject<ChoiceItem[]>([]);
        const loader$: BehaviorSubject<ReactiveListLoader> = new BehaviorSubject<ReactiveListLoader>({
            isLoading: false,
            startOption: {
                text: 'AI is analyzing your changes',
            },
        });

        inquirer.registerPrompt('reactiveListPrompt', ReactiveListPrompt);
        const reactiveListPrompt = inquirer.prompt({
            type: 'reactiveListPrompt',
            name: 'aicommit2Prompt',
            message: 'Pick a commit message to use: ',
            emptyMessage: '⚠ No commit messages were generated',
            choices$,
            loader$,
        });

        loader$.next({ isLoading: true });

        const allRequests$ = from([...availableAIs, 'TEST']).pipe(
            mergeMap(ai => {
                switch (ai) {
                    case 'OPENAI':
                        return from(
                            generateCommitMessage(
                                config.OPENAI_KEY,
                                config.model,
                                config.locale,
                                staged.diff,
                                config.generate,
                                config['max-length'],
                                config.type,
                                config.timeout,
                                config.proxy
                            )
                        ).pipe(
                            concatMap(arr => from(arr)), // flat array
                            map(generatedMessage => {
                                const chatGPTColors = { primary: '#74AA9C' };
                                const chatGPT = chalk.bgHex(chatGPTColors.primary).white.bold('[ChatGPT]');
                                return {
                                    name: `${chatGPT} ${generatedMessage}`,
                                    value: generatedMessage,
                                    isError: false,
                                };
                            }),
                            catchError(error => {
                                const errorChatGPT = chalk.red.bold('[ChatGPT]');
                                let simpleMessage = 'An error occurred';
                                if (error.response && error.response.data && error.response.data.error) {
                                    simpleMessage = error.response.data.error.split('\n')[0];
                                } else if (error.message) {
                                    simpleMessage = error.message.split('\n')[0];
                                }
                                return of({
                                    name: `${errorChatGPT} ${simpleMessage}`,
                                    value: simpleMessage,
                                    isError: true,
                                });
                            })
                        );
                    case 'BARD':
                        const googleColors = {
                            red: '#DB4437',
                            yellow: '#F4B400',
                            blue: '#4285F4',
                            green: '#0F9D58',
                        };
                        const message = `ci: update git actions config`;
                        const bard = chalk.bgHex(googleColors.blue).white.bold('[Bard AI]');
                        return of({
                            name: bard + ` ${message}`,
                            value: message,
                            isError: false,
                        });
                    default:
                        const prefixError = chalk.red.bold('[ERROR]');
                        return of({
                            name: prefixError + ' An error occurred',
                            value: 'An error occurred',
                            isError: true,
                        });
                }
            })
        );

        // request all
        allRequests$
            .pipe(
                tap(response => {
                    const { name, value, isError } = response;
                    choices.push({
                        name,
                        value,
                        disabled: isError,
                        isError,
                    });
                }),
                catchError(err => EMPTY)
            )
            .subscribe(
                ({ value, isError }) => {
                    if (choices.length > 0) {
                        choices$.next(choices);
                    }
                },
                () => {},
                () => {
                    const isAllError = choices.every(value => value?.isError || value?.disabled);
                    if (isAllError) {
                        loader$.next({
                            isLoading: false,
                            message: 'No commit messages were generated',
                            stopOption: {
                                doneFrame: '⚠', // '✖'
                                color: 'yellow', // 'red'
                            },
                        });
                        choices$.complete();
                        loader$.complete();
                        return;
                    }
                    loader$.next({ isLoading: false, message: 'Changes analyzed' });
                }
            );

        const answer = await reactiveListPrompt;
        choices$.complete();
        loader$.complete();

        const message = answer.aicommit2Prompt?.value;
        if (!message) {
            throw new KnownError('An error occurred! No selected message');
        }
        const commitSpinner = ora('Committing with the generated message').start();
        // await execa('git', ['commit', '-m', message, ...rawArgv]);
        commitSpinner.stop();
        commitSpinner.clear();
        console.log(chalk.bold.green('✔ ') + chalk.bold(`Successfully committed!`));

        // reactiveListPrompt.then(async answer => {
        //     choices$.complete();
        //     loader$.complete();
        //     // answer:  {
        //     //    aicommit2Prompt: {
        //     //        isValid: true,
        //     //            value: 'refactor: modify chatGPT message generation'
        //     //    }
        //     //}
        //     const message = answer.aicommit2Prompt.value;
        //     await execa('git', ['commit', '-m', message, ...rawArgv]);
        //     console.log(chalk.bold.green('✔ ') + `Successfully committed!`);
        // });

        // let messages: string[];
        // try {
        //     messages = await generateCommitMessage(
        //         config.OPENAI_KEY,
        //         config.model,
        //         config.locale,
        //         staged.diff,
        //         config.generate,
        //         config['max-length'],
        //         config.type,
        //         config.timeout,
        //         config.proxy
        //     );
        // } finally {
        //     s.stop('Changes analyzed');
        // }
        //
        // if (messages.length === 0) {
        //     throw new KnownError('No commit messages were generated. Try again.');
        // }
        //
        // let message: string;
        // if (messages.length === 1) {
        //     [message] = messages;
        //     const confirmed = await confirm({
        //         message: `Use this commit message?\n\n   ${message}\n`,
        //     });
        //
        //     if (!confirmed || isCancel(confirmed)) {
        //         outro('Commit cancelled');
        //         return;
        //     }
        // } else {
        //     const selected = await select({
        //         message: `Pick a commit message to use: ${dim('(Ctrl+c to exit)')}`,
        //         options: messages.map(value => ({ label: value, value })),
        //     });
        //
        //     if (isCancel(selected)) {
        //         outro('Commit cancelled');
        //         return;
        //     }
        //
        //     message = selected;
        // }
        // await execa('git', ['commit', '-m', message, ...rawArgv]);

        // outro(`${green('✔')} Successfully committed!`);
    })().catch(error => {
        console.log(chalk.red(`\n✖ ${error.message}`));
        // handleCliError(error);
        process.exit(1);
    });
