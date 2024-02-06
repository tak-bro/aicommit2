import type { CommitType } from './config.js';

const commitTypeFormats: Record<CommitType, string> = {
    '': '<commit message>',
    conventional: '<type>(<optional scope>): <description>',
    gitmoji: ':<emoji>: <description>',
};
const specifyCommitFormat = (type: CommitType) =>
    `The output response must be in ${type} commit type:\n${commitTypeFormats[type]}`;

const commitTypes: Record<CommitType, string> = {
    '': '',
    gitmoji: '',
    /**
     * References:
     * Commitlint:
     * https://github.com/conventional-changelog/commitlint/blob/18fbed7ea86ac0ec9d5449b4979b762ec4305a92/%40commitlint/config-conventional/index.js#L40-L100
     *
     * Conventional Changelog:
     * https://github.com/conventional-changelog/conventional-changelog/blob/d0e5d5926c8addba74bc962553dd8bcfba90e228/packages/conventional-changelog-conventionalcommits/writer-opts.js#L182-L193
     */
    conventional: `Choose a type from the type-to-description JSON below that best describes the git diff:\n${JSON.stringify(
        {
            docs: 'Documentation only changes',
            style: 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
            refactor: 'A code change that neither fixes a bug nor adds a feature',
            perf: 'A code change that improves performance',
            test: 'Adding missing tests or correcting existing tests',
            build: 'Changes that affect the build system or external dependencies',
            ci: 'Changes to our CI configuration files and scripts',
            chore: "Other changes that don't modify src or test files",
            revert: 'Reverts a previous commit',
            feat: 'A new feature',
            fix: 'A bug fix',
        },
        null,
        2
    )}`,
};

export const generatePrompt = (locale: string, maxLength: number, type: CommitType) =>
    [
        'Generate a concise git commit message written in present tense for the following code diff with the given specifications below:',
        `Message language: ${locale}`,
        `Commit message must be a maximum of ${maxLength} characters.`,
        'Exclude anything unnecessary such as translation. Your entire response will be passed directly into git commit.',
        commitTypes[type],
        specifyCommitFormat(type),
    ]
        .filter(Boolean)
        .join('\n');

export const isValidConventionalMessage = (message: string): boolean => {
    const conventionalReg =
        /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test){1}(\([\s\w\.\-\p{Extended_Pictographic}]+\))?(!)?: ([\s\w \p{Extended_Pictographic}])+([\s\S]*)/;
    return conventionalReg.test(message);
};

export const isValidGitmojiMessage = (message: string): boolean => {
    const gitmojiCommitMessageRegex = /^\:\w+\: (.*)$/;
    return gitmojiCommitMessageRegex.test(message);
};
