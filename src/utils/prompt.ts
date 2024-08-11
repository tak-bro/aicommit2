import fs from 'fs';
import path from 'path';

import type { CommitType } from './config.js';

export interface PromptOptions {
    locale: string;
    maxLength: number;
    type: CommitType;
    generate: number;
    systemPromptPath?: string;
    systemPrompt?: string;
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
    locale: 'en',
    maxLength: 50,
    type: 'conventional',
    generate: 1,
    systemPrompt: '',
    systemPromptPath: '',
};

const MAX_COMMIT_LENGTH = 80;

const commitTypeFormats: Record<CommitType, string> = {
    '': '<commit message>',
    conventional: `<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]`,
    gitmoji: `:<emoji>:(<optional scope>): <description>

[optional body]

[optional footer(s)]`,
};

export const exampleCommitByType: Record<CommitType, string> = {
    '': '',
    conventional: `<type>(<optional scope>): <description>`,
    gitmoji: `:<emoji>: <description>`,
};

const specifyCommitFormat = (type: CommitType = 'conventional') => {
    if (type === '') {
        return '';
    }
    return `The commit message must be in format:\n${commitTypeFormats[type]}`;
};

/*
get from gitmoji.dev
[...document.getElementsByClassName("styles_gitmojiInfo__KXa8A")].map(data => {
    const key = data.querySelector("button").innerText;
    return { [`${key}`]: `${data.lastElementChild.textContent}` };
})
*/
const commitTypes: Record<CommitType, string> = {
    '': '',
    gitmoji: `\n${Object.entries({
        ':sparkles:': 'Introduce new features.',
        ':bug:': 'Fix a bug.',
        ':memo:': 'Add or update documentation.',
        ':art:': 'Improve structure / format of the code.',
        ':zap:': 'Improve performance.',
        ':fire:': 'Remove code or files.',
        ':ambulance:': 'Critical hotfix.',
        ':white_check_mark:': 'Add, update, or pass tests.',
        ':lock:': 'Fix security or privacy issues.',
        ':rocket:': 'Deploy stuff.',
        ':lipstick:': 'Add or update the UI and style files.',
        ':tada:': 'Begin a project.',
        ':recycle:': 'Refactor code.',
        ':wrench:': 'Add or update configuration files.',
        ':bulb:': 'Add or update comments in source code.',
        ':twisted_rightwards_arrows:': 'Merge branches.',
        // TODO:
        // ':closed_lock_with_key:': 'Add or update secrets.',
        // ':bookmark:': 'Release / Version tags.',
        // ':rotating_light:': 'Fix compiler / linter warnings.',
        // ':construction:': 'Work in progress.',
        // ':green_heart:': 'Fix CI Build.',
        // ':arrow_down:': 'Downgrade dependencies.',
        // ':arrow_up:': 'Upgrade dependencies.',
        // ':pushpin:': 'Pin dependencies to specific versions.',
        // ':construction_worker:': 'Add or update CI build system.',
        // ':chart_with_upwards_trend:': 'Add or update analytics or track code.',
        // ':heavy_plus_sign:': 'Add a dependency.',
        // ':heavy_minus_sign:': 'Remove a dependency.',
        // ':hammer:': 'Add or update development scripts.',
        // ':globe_with_meridians:': 'Internationalization and localization.',
        // ':pencil2:': 'Fix typos.',
        // ':poop:': 'Write bad code that needs to be improved.',
        // ':rewind:': 'Revert changes.',
        // ':package:': 'Add or update compiled files or packages.',
        // ':alien:': 'Update code due to external API changes.',
        // ':truck:': 'Move or rename resources (e.g.: files, paths, routes).',
        // ':page_facing_up:': 'Add or update license.',
        // ':boom:': 'Introduce breaking changes.',
        // ':bento:': 'Add or update assets.',
        // ':wheelchair:': 'Improve accessibility.',
        // ':beers:': 'Write code drunkenly.',
        // ':speech_balloon:': 'Add or update text and literals.',
        // ':card_file_box:': 'Perform database related changes.',
        // ':loud_sound:': 'Add or update logs.',
        // ':mute:': 'Remove logs.',
        // ':busts_in_silhouette:': 'Add or update contributor(s).',
        // ':children_crossing:': 'Improve user experience / usability.',
        // ':building_construction:': 'Make architectural changes.',
        // ':iphone:': 'Work on responsive design.',
        // ':clown_face:': 'Mock things.',
        // ':egg:': 'Add or update an easter egg.',
        // ':see_no_evil:': 'Add or update a .gitignore file.',
        // ':camera_flash:': 'Add or update snapshots.',
        // ':alembic:': 'Perform experiments.',
        // ':mag:': 'Improve SEO.',
        // ':label:': 'Add or update types.',
        // ':seedling:': 'Add or update seed files.',
        // ':triangular_flag_on_post:': 'Add, update, or remove feature flags.',
        // ':goal_net:': 'Catch errors.',
        // ':dizzy:': 'Add or update animations and transitions.',
        // ':wastebasket:': 'Deprecate code that needs to be cleaned up.',
        // ':passport_control:': 'Work on code related to authorization, roles and permissions.',
        // ':adhesive_bandage:': 'Simple fix for a non-critical issue.',
        // ':monocle_face:': 'Data exploration/inspection.',
        // ':coffin:': 'Remove dead code.',
        // ':test_tube:': 'Add a failing test.',
        // ':necktie:': 'Add or update business logic.',
        // ':stethoscope:': 'Add or update healthcheck.',
        // ':bricks:': 'Infrastructure related changes.',
        // ':technologist:': 'Improve developer experience.',
        // ':money_with_wings:': 'Add sponsorships or money related infrastructure.',
        // ':thread:': 'Add or update code related to multithreading or concurrency.',
        // ':safety_vest:': 'Add or update code related to validation.',
    })
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join('\n')}`,
    /**
     * References:
     * Commitlint:
     * https://github.com/conventional-changelog/commitlint/blob/18fbed7ea86ac0ec9d5449b4979b762ec4305a92/%40commitlint/config-conventional/index.js#L40-L100
     *
     * Conventional Changelog:
     * https://github.com/conventional-changelog/conventional-changelog/blob/d0e5d5926c8addba74bc962553dd8bcfba90e228/packages/conventional-changelog-conventionalcommits/writer-opts.js#L182-L193
     */
    conventional: `\n${Object.entries({
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
    })
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join('\n')}`,
};

const parseTemplate = (template: string, options: PromptOptions): string => {
    return template.replace(/{(\w+)}/g, (_, key) => {
        return (
            options[key as keyof PromptOptions]?.toString() || (DEFAULT_PROMPT_OPTIONS[key as keyof PromptOptions]?.toString() as string)
        );
    });
};

type CommitStyle = 'conventional' | 'gitmoji';

const finalPrompt2 = (generate: number, style: CommitStyle): string => {
    const conventionalTypes = ['feat', 'fix', 'docs', 'style', 'refactor', 'perf', 'test', 'build', 'ci', 'chore', 'revert'];

    const gitmojiList = [
        '🎨',
        '⚡️',
        '🔥',
        '🐛',
        '🚑️',
        '✨',
        '📝',
        '🚀',
        '💄',
        '🎉',
        '✅',
        '🔒️',
        '🔐',
        '🔖',
        '🚨',
        '🚧',
        '💚',
        '⬇️',
        '⬆️',
        '📌',
        '👷',
        '📈',
        '♻️',
        '➕',
        '➖',
        '🔧',
        '🔨',
        '🌐',
        '✏️',
        '💩',
        '⏪️',
        '🔀',
        '📦️',
        '👽️',
        '🚚',
        '📄',
        '💥',
        '🍱',
        '♿️',
        '💡',
        '🍻',
        '💬',
        '🗃️',
        '🔊',
        '🔇',
        '👥',
        '🚸',
        '🏗️',
        '📱',
        '🤡',
        '🥚',
        '🙈',
        '📸',
        '⚗️',
        '🔍️',
        '🏷️',
        '🌱',
        '🚩',
        '🥅',
        '💫',
        '🗑️',
        '🛂',
        '🩹',
        '🧐',
        '⚰️',
    ];

    const styleSpecificInstructions =
        style === 'conventional'
            ? `For Conventional Commits style:
       1. The "subject" should start with a type (e.g., feat, fix, docs) followed by an optional scope in parentheses.
       2. Use the format: <type>[(optional scope)]: <description>
       3. Common types include: ${conventionalTypes.join(', ')}
       Example: "feat(auth): implement two-factor authentication"`
            : `For Gitmoji style:
       1. The "subject" should start with an appropriate emoji followed by a short description.
       2. Use the format: <emoji> <description>
       3. Choose from common gitmojis such as: ${gitmojiList.slice(0, 10).join(' ')} (and many others)
       Example: "✨ Add user profile customization feature"`;

    return [
        `You are a helpful assistant specializing in writing clear and informative Git commit messages using the ${style} style. Based on the given code changes or context, generate ${generate} appropriate Git commit message${generate !== 1 ? 's' : ''}.`,
        `For each commit message, provide a JSON object with the following structure:`,
        `{
      "subject": "A concise summary of the changes (50-72 characters)",
      "body": "A more detailed explanation of the changes (optional)",
      "footer": "Any references to issue trackers or metadata (optional)"
    }`,
        `Guidelines for creating commit messages:`,
        styleSpecificInstructions,
        `4. The "body" should:
       - Explain the what and why of the changes, not the how
       - Be wrapped at 72 characters
       - Use bullet points for multiple points (each starting with a hyphen)
       - Be omitted (empty string) if the subject is self-explanatory`,
        `5. The "footer" should:
       - Include any other metadata relevant to the project
       - Be omitted (empty string) if not needed`,
        `Provide your response as a JSON array containing exactly ${generate} commit message object${generate !== 1 ? 's' : ''}. Example:`,
        `[
      ${Array(generate)
          .fill(null)
          .map(
              () => `{
        "subject": "${style === 'conventional' ? 'feat(user): add profile picture upload' : '🖼️ Add profile picture upload feature'}",
        "body": "- Implement server-side handling of file uploads\\n- Add client-side image preview and cropping\\n- Ensure MIME type validation for security",
        "footer": "Closes #234"
      }`
          )
          .join(',\n      ')}
    ]`,
        `Ensure you generate exactly ${generate} commit message${generate !== 1 ? 's' : ''}, even if it requires creating slightly varied versions for similar changes.`,
        `The response should be valid JSON that can be parsed without errors.`,
    ]
        .filter(Boolean)
        .join('\n');
};

const defaultPrompt = (promptOptions: PromptOptions) => {
    const { type, maxLength, generate, locale } = promptOptions;

    return [
        `You are a helpful assistant specializing in writing clear and informative Git commit messages.`,
        `Based on the given code changes or context, generate ${generate} appropriate Git commit message${generate !== 1 ? 's' : ''}.`,
        `For each commit message, provide a JSON object with the following structure:`,
        `{`,
        `  "subject": "A concise summary of the changes (${maxLength} characters or less)"`,
        `  "body": "A more detailed explanation of the changes (Optional)"`,
        `  "footer": "Any references to issue trackers or metadata (Optional)"`,
        `}`,
        `Generate exactly ${generate} ${type} commit message${generate !== 1 ? 's' : ''} based on the following guidelines.`,
        `1. Language: ${locale}`,
        `2. Format: follow the ${type} Commits format:`,
        `${commitTypeFormats[type]}`,
        `3. Types: use one of the following types:${commitTypes[type]}`,
        `4. Scope: Optional, can be anything specifying the place of the commit change (e.g., component name, file name, module name)`,
        `5. Description: `,
        `  - Wrap lines at ${maxLength} characters`,
        `  - Don't capitalize the first letter`,
        `  - No period (.) at the end`,
        `6. Body: Optional`,
        `  - Wrap lines at 72 characters`,
        `7. Footer: Optional`,
        `  - Mention any breaking changes, starting with "BREAKING CHANGE:"`,
        `8. General Rules:`,
        `  - Use imperative, present tense: "change" not "changed" nor "changes"`,
        `  - Be concise but descriptive`,
        `  - Focus on the "why" behind the change, not just the "what"`,
        `  - Separate subject from body with a blank line`,
        `  - Use the body to explain what and why vs. how`,
    ]
        .filter(Boolean)
        .join('\n');
};

const finalPrompt = (type: CommitType, generate: number) => {
    return [
        `Provide your response as a JSON array containing exactly ${generate} object${generate !== 1 ? 's' : ''}, each with the following keys:`,
        `- "subject": The main commit message. It should be a concise summary of the changes.`,
        `- "body": An optional detailed explanation of the changes. If not needed, use an empty string.`,
        `- "footer": An optional footer for metadata like BREAKING CHANGES. If not needed, use an empty string.`,
        `The array must always contain ${generate} element${generate !== 1 ? 's' : ''}, no more and no less.`,
        `Example response format:
    [
      ${Array(generate)
          .fill(null)
          .map(
              (_, index) => `{
        "subject": "fix: fix bug in user authentication process",
        "body": "- Updated login function to handle edge cases\\n- Added additional error logging for debugging",
        "footer": ""
      }`
          )
          .join(',\n      ')}
    ]`,
    ]
        .filter(Boolean)
        .join('\n');
};

export const generatePrompt = (promptOptions: PromptOptions) => {
    const { systemPrompt, systemPromptPath, type, generate } = promptOptions;
    if (systemPrompt) {
        return `${systemPrompt}\n${finalPrompt(type, generate)}`;
    }

    if (!systemPromptPath) {
        return `${defaultPrompt(promptOptions)}\n${finalPrompt(type, generate)}`;
    }

    try {
        const systemPromptTemplate = fs.readFileSync(path.resolve(systemPromptPath), 'utf-8');
        return `${parseTemplate(systemPromptTemplate, promptOptions)}\n${finalPrompt(type, generate)}`;
    } catch (error) {
        return `${defaultPrompt(promptOptions)}\n${finalPrompt(type, generate)}`;
    }
};

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
