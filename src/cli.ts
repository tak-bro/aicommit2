import { cli } from 'cleye';
import { description, version } from '../package.json';
import aicommit2 from './commands/aicommit2.js';
import prepareCommitMessageHook from './commands/prepare-commit-msg-hook.js';
import configCommand from './commands/config.js';
import hookCommand, { isCalledFromGitHook } from './commands/hook.js';

const rawArgv = process.argv.slice(2);

cli(
    {
        name: 'aicommit2',
        version,
        /**
         * Since this is a wrapper around `git commit`,
         * flags should not overlap with it
         * https://git-scm.com/docs/git-commit
         */
        flags: {
            generate: {
                type: Number,
                description: 'Number of messages to generate (Warning: generating multiple costs more) (default: 1)',
                alias: 'g',
            },
            exclude: {
                type: [String],
                description: 'Files to exclude from AI analysis',
                alias: 'x',
            },
            all: {
                type: Boolean,
                description: 'Automatically stage changes in tracked files for the commit',
                alias: 'a',
                default: false,
            },
            type: {
                type: String,
                description: 'Type of commit message to generate',
                alias: 't',
                default: 'conventional',
            },
            confirm: {
                type: String,
                description: 'Check again when committing after message generation (default: true)',
                alias: 'c',
                default: 'true',
            },
        },

        commands: [configCommand, hookCommand],

        help: {
            description,
        },

        ignoreArgv: type => type === 'unknown-flag' || type === 'argument',
    },
    argv => {
        if (isCalledFromGitHook) {
            prepareCommitMessageHook();
            return;
        }
        aicommit2(
            argv.flags.generate,
            argv.flags.exclude,
            argv.flags.all,
            argv.flags.type,
            argv.flags.confirm,
            rawArgv
        );
    },
    rawArgv
);
