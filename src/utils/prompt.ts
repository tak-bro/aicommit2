import type { CommitType } from './config.js';

const MAX_COMMIT_LENGTH = 80;

const commitTypeFormats: Record<CommitType, string> = {
    '': '<commit message>',
    conventional: `<type>(<optional scope>): <description>`,
    gitmoji: `:<emoji>: <description>`,
};

const exampleCommitByType: Record<CommitType, string> = {
    '': '',
    conventional: `Example commit message: 'feat: add new disabled boolean variable to button'`,
    gitmoji: `Example commit message: ':sparkles: Add a generic preset using configuration'`,
};

const specifyCommitFormat = (type: CommitType = 'conventional') => {
    if (type === '') {
        return '';
    }
    return `The commit message must be in format:\n${commitTypeFormats[type]}\n${exampleCommitByType[type]}`;
};

const commitTypes: Record<CommitType, string> = {
    '': '',
    gitmoji: `Choose a emoji from the emoji-to-description JSON below that best describes the git diff:\n${JSON.stringify(
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
    conventional: `Choose a type from the type-to-description JSON below that best describes the git diff.\n${JSON.stringify(
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
        'You are the expert programmer, trained to write commit messages. You are going to provide a professional git commit message.',
        'Generate a concise git commit message written in present tense with the given specifications below:',
        `Message language: ${locale}`,
        `Commit message must be a maximum of ${Math.min(Math.max(maxLength, 0), MAX_COMMIT_LENGTH)} characters.`,
        `${additionalPrompts}`,
        'Exclude anything unnecessary such as explanation or translation. Your entire response will be passed directly into git commit.',
        commitTypes[type],
        specifyCommitFormat(type),
    ]
        .filter(Boolean)
        .join('\n');

export const extraPrompt = (generate: number) => `THE RESULT MUST BE ${generate} COMMIT MESSAGES AND MUST BE IN NUMBERED LIST FORMAT.`;

export const isValidConventionalMessage = (message: string): boolean => {
    const conventionalReg =
        /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test){1}(\([\w\-]+\))?(!)?: .{1,80}(\n|\r\n){2}(.*(\n|\r\n)*)*$/;
    return conventionalReg.test(message);
};

export const isValidGitmojiMessage = (message: string): boolean => {
    const gitmojiCommitMessageRegex = /:\w*:/;
    return gitmojiCommitMessageRegex.test(message);
};
