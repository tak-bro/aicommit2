import type { CommitType } from './config.js';

const MAX_COMMIT_LENGTH = 80;

const commitTypeFormats: Record<CommitType, string> = {
    '': '<commit message>',
    conventional: `<type>(<optional scope>): <description>
[optional body]
[optional footer(s)]`,
    gitmoji: `:<emoji>: <description>
[optional body]
[optional footer(s)`,
};

const exampleCommitByType: Record<CommitType, string> = {
    '': '',
    conventional: `Example commit message => feat: add new disabled boolean variable to button`,
    gitmoji: `Example commit message => :sparkles: Add a generic preset using configuration`,
};

const specifyCommitFormat = (type: CommitType = 'conventional') => {
    if (type === '') {
        return '';
    }
    return `The commit message must be in format:\n${commitTypeFormats[type]}`;
};

const commitTypes: Record<CommitType, string> = {
    '': '',
    gitmoji: `\n${JSON.stringify(
        {
            ':tada:': 'Initial commit',
            ':sparkles:': 'Introduce new features',
            ':bug:': 'Fix a bug',
            ':memo:': 'Writing docs',
            ':fire:': 'Remove code or files',
            ':art:': 'Improve structure/format of the code commit',
            ':zap:': 'Improve performance',
            ':lock:': 'Fix security issues',
            ':ambulance:': 'Critical hotfix',
            ':rocket:': 'Deploy stuff',
            ':lipstick:': 'Add or update UI and style files',
            ':construction:': 'Work in progress',
            ':green_heart:': 'Fix CI build issues',
        },
        null,
        2
    )}`,
    /**
     * References:
     * Commitlint:
     * https://github.com/conventional-changelog/commitlint/blob/18fbed7ea86ac0ec9d5449b4979b762ec4305a92/%40commitlint/config-conventional/index.js#L40-L100
     *
     * Conventional Changelog:
     * https://github.com/conventional-changelog/conventional-changelog/blob/d0e5d5926c8addba74bc962553dd8bcfba90e228/packages/conventional-changelog-conventionalcommits/writer-opts.js#L182-L193
     */
    conventional: `\n${JSON.stringify(
        {
            docs: 'Documentation only changes',
            style: 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
            refactor: 'A code change that neither fixes a bug nor adds a feature',
            perf: 'A code change that improves performance',
            test: 'Adding missing tests or correcting existing tests',
            build: 'Changes that affect the build system or external dependencies',
            ci: 'Changes to CI configuration files, scripts',
            chore: "Other changes that don't modify src or test files",
            revert: 'Reverts a previous commit',
            feat: 'A new feature',
            fix: 'A bug fix',
        },
        null,
        2
    )}`,
};

export const generateDefaultPrompt = (locale: string, maxLength: number, type: CommitType, additionalPrompts: string = '') =>
    [
        `You are an expert programmer trained to write professional git commit messages following the ${type} Commits specification. Generate concise and meaningful git commit messages based on the following guidelines:`,
        `1. Message language: ${locale}`,
        `2. Format: ${commitTypeFormats[type]}`,
        `3. Subject line (first line):
     - Maximum ${maxLength} characters
     - Written in imperative mood, present tense
     - First letter capitalized
     - No period at the end`,
        `4. Body (if needed):
     - Separated from subject by a blank line
     - Explain what and why, not how
     - Wrap at 72 characters
     - Use bullet points for multiple changes`,
        `5. Type: Choose the most appropriate type from the following list: ${commitTypes[type]}`,
        `6. Scope: Optional, can be anything specifying the place of the commit change`,
        `7. Description: A short summary of the code changes`,
        `8. Body: Optional, providing additional contextual information about the code changes`,
        `9. Footer: Optional, for indicating breaking changes or referencing issues`,
        `${additionalPrompts}`,
        `Avoid unnecessary explanations or translations. Your response will be used directly in git commit messages, so ensure it follows the specified format precisely.`,
    ]
        .filter(Boolean)
        .join('\n');

export const extraPrompt = (generate: number) => `Provide ${generate} commit messages in the following JSON array format:
 [
  {
    "message": "<type>[optional scope]: <description>",
    "body": "Detailed explanation if necessary"
  },
  {
    "message": "Another commit message",
    "body": "Another detailed explanation if necessary"
  }
]

Note: Your task is to create well-formatted, conventional commit messages for each requested commit.`;

export const isValidConventionalMessage = (message: string): boolean => {
    // TODO: check loosely for issue that message is not coming out
    // const conventionalReg =
    //     /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test){1}(\([\w\-]+\))?(!)?: .{1,80}(\n|\r\n){2}(.*(\n|\r\n)*)*$/;
    const conventionalReg = /(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\(.*\))?: .*$/;
    return conventionalReg.test(message);
};

export const isValidGitmojiMessage = (message: string): boolean => {
    const gitmojiCommitMessageRegex = /:\w*:/;
    return gitmojiCommitMessageRegex.test(message);
};
