import { RawConfig, ValidConfig, applyDisableLowerCaseToConfig, applyIncludeBodyToConfig } from './config.js';

/**
 * Flags shared by the root command, `rewrite`, and the two git hook entry points.
 *
 * Both commands used to hand-copy this table, and twice a flag landed in only one of them
 * (#262 `--auto-select`, #271 `--include-body`) — cleye ignores an unknown flag on a
 * subcommand silently, so the omission never surfaced as an error. Spread this into each
 * command's `flags` and add message-shaping flags here, not in the commands.
 */
export const sharedMessageFlags = {
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
    type: {
        type: String,
        description: 'Type of commit message to generate (default: conventional)',
        alias: 't',
    },
    prompt: {
        type: String,
        description: 'Custom prompt to let users fine-tune provided prompt',
        alias: 'p',
    },
    'include-body': {
        type: Boolean,
        description: 'Force include commit body in all generated messages',
        alias: 'i',
        default: false,
    },
    'auto-select': {
        type: Boolean,
        description: 'Automatically select the first successfully generated message (skips the picker and the final confirmation)',
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
};

export interface MessageFlagValues {
    locale?: string;
    generate?: number;
    type?: string;
    prompt?: string;
    includeBody?: boolean;
    disableLowerCase?: boolean;
    verbose?: boolean;
}

/**
 * Turn the shared flags into the CLI layer of the config hierarchy (CLI → env → file → defaults).
 */
export const buildMessageConfigOverrides = (flags: MessageFlagValues): RawConfig => ({
    locale: flags.locale?.toString() as string,
    generate: flags.generate?.toString() as string,
    type: flags.type?.toString() as string,
    systemPrompt: flags.prompt?.toString() as string,
    ...(flags.includeBody === true && { includeBody: 'true' }),
    ...(flags.disableLowerCase === true && { disableLowerCase: 'true' }),
    ...(flags.verbose === true && { logLevel: 'verbose' }),
});

/**
 * Force the boolean message flags onto every provider section after parsing.
 *
 * `getConfig` only falls back to the general key when a provider does not set its own, so a
 * `[PROVIDER] includeBody=false` would otherwise win over `-i` — the flag is documented as
 * "force include", hence the second pass. `includeBody` is also forced when the general config
 * key is true; `disableLowerCase` is forced by the flag only. That asymmetry predates this
 * module and is kept as is.
 */
export const forceMessageFlagsOnProviders = (config: ValidConfig, flags: MessageFlagValues): void => {
    if (flags.includeBody === true || config.includeBody === true) {
        applyIncludeBodyToConfig(config);
    }
    if (flags.disableLowerCase === true) {
        applyDisableLowerCaseToConfig(config);
    }
};

/**
 * `msg=$(aicommit2 --dry-run)`: stdout is captured, so nobody can drive the picker and anything
 * but the message would pollute the result. Such a run picks the first message itself.
 */
export const isPipedDryRun = (dryRun: boolean, isJsonMode = false): boolean => dryRun && !isJsonMode && !process.stdout.isTTY;

/**
 * Sends human-facing `console.log` output (title, staged files, warnings) to stderr so only the
 * message written via `process.stdout.write` reaches stdout.
 */
export const routeConsoleToStderr = () => {
    console.log = console.error;
};
