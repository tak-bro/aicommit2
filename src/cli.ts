import { cli } from 'cleye';

import pkg from '../package.json';
import aicommit2 from './commands/aicommit2.js';
import configCommand from './commands/config.js';
import githubLoginCommand from './commands/github-login.js';
import hookCommand, { isCalledFromGitHook } from './commands/hook.js';
import logCommand from './commands/log.js';
import preCommitHook from './commands/pre-commit-hook.js';
import prepareCommitMessageHook from './commands/prepare-commit-msg-hook.js';
import watchGit from './commands/watch-git.js';
import { RawConfig, getConfig } from './utils/config.js';
import { initializeLogger, logger } from './utils/logger.js';

const rawArgv = process.argv.slice(2);
const { version, description } = pkg;

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
            locale: {
                type: String,
                description: 'Locale to use for the generated commit messages (default: en)',
                alias: 'l',
            },
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
                description: 'Type of commit message to generate (default: conventional)',
                alias: 't',
            },
            confirm: {
                type: Boolean,
                description: 'Skip confirmation when committing after message generation (default: false)',
                alias: 'y',
                default: false,
            },
            clipboard: {
                type: Boolean,
                description: 'Copy the selected message to the clipboard',
                alias: 'c',
                default: false,
            },
            prompt: {
                type: String,
                description: 'Custom prompt to let users fine-tune provided prompt',
                alias: 'p',
            },
            'watch-commit': {
                type: Boolean,
                default: false,
            },
            'hook-mode': {
                type: Boolean,
                description: 'Run in git hook mode, allowing chaining with other hooks',
                default: false,
            },
            'pre-commit': {
                type: Boolean,
                description: 'Run in pre-commit Framework, allowing chaining with other hooks',
                default: false,
            },
            'include-body': {
                type: Boolean,
                description: 'Force include commit body in all generated messages',
                alias: 'i',
                default: false,
            },
            'auto-select': {
                type: Boolean,
                description: 'Automatically select the message when only one is generated',
                alias: 's',
                default: false,
            },
            edit: {
                type: Boolean,
                description: 'Open the AI-generated commit message in your default editor',
                alias: 'e',
                default: false,
            },
            'disable-lowercase': {
                type: Boolean,
                description: 'Disable automatic lowercase conversion of commit messages',
                default: false,
            },
            verbose: {
                type: Boolean,
                description: 'Enable verbose logging for this run',
                alias: 'v',
                default: false,
            },
            git: {
                type: Boolean,
                description: 'Force use Git (overrides auto-detection)',
                default: false,
            },
            yadm: {
                type: Boolean,
                description: 'Force use YADM (overrides auto-detection)',
                default: false,
            },
            jj: {
                type: Boolean,
                description: 'Force use Jujutsu (overrides auto-detection)',
                default: false,
            },
            'jj-auto-new': {
                type: Boolean,
                description: 'Run jj new after jj describe (default: false, only describe)',
                default: false,
            },
            'dry-run': {
                type: Boolean,
                description: 'Generate commit message without committing (output only)',
                alias: 'd',
                default: false,
            },
        },

        commands: [configCommand, githubLoginCommand, hookCommand, logCommand],

        help: {
            description,
        },

        ignoreArgv: type => type === 'unknown-flag' || type === 'argument',
    },
    async argv => {
        const cliOverrides: RawConfig = {};
        if (argv.flags.verbose) {
            cliOverrides.logLevel = 'verbose';
        }

        const config = await getConfig(cliOverrides, rawArgv);
        await initializeLogger(config);
        logger.info(`aicommit2 version: ${version}`);
        if (argv.flags['pre-commit']) {
            preCommitHook(argv.flags.verbose);
            return;
        }

        if (argv.flags['hook-mode'] || isCalledFromGitHook) {
            prepareCommitMessageHook(
                argv.flags.locale,
                argv.flags.generate,
                argv.flags.exclude,
                argv.flags.type,
                argv.flags.prompt,
                argv.flags['include-body'],
                argv.flags.verbose
            );
            return;
        }

        if (argv.flags['watch-commit']) {
            watchGit(argv.flags.locale, argv.flags.generate, argv.flags.exclude, argv.flags.prompt, argv.flags.verbose, rawArgv);
            return;
        }

        aicommit2(
            argv.flags.locale,
            argv.flags.generate,
            argv.flags.exclude,
            argv.flags.all,
            argv.flags.type,
            argv.flags.confirm,
            argv.flags.clipboard,
            argv.flags.prompt,
            argv.flags['include-body'],
            argv.flags['auto-select'],
            argv.flags.edit,
            argv.flags['disable-lowercase'],
            argv.flags.verbose,
            argv.flags['dry-run'],
            argv.flags['jj-auto-new'],
            rawArgv
        );
    },
    rawArgv
);
