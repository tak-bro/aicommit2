import fs from 'fs';

import { CommitType, ValidConfig, resolvePromptPath } from './config.js';
import { KnownError } from './error.js';

export interface PromptOptions {
    locale: string;
    maxLength: number;
    type: CommitType;
    generate: number;
    systemPrompt?: string;
    systemPromptPath?: string;
    codeReviewPromptPath?: string;
}

export const DEFAULT_PROMPT_OPTIONS: PromptOptions = {
    locale: 'en',
    maxLength: 50,
    type: 'conventional',
    generate: 1,
    systemPrompt: '',
    systemPromptPath: '',
    codeReviewPromptPath: '',
};

const commitTypeFormats: Record<CommitType, string> = {
    '': '<commit message>',
    conventional: `<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]`,
    gitmoji: `:<emoji>:(<optional scope>): <description>

[optional body]

[optional footer(s)]`,
    jujutsu: `<component>: <brief description>

[optional detailed explanation]`,
};

export const exampleCommitByType: Record<CommitType, string> = {
    '': '',
    conventional: `<type>(<optional scope>): <description>`,
    gitmoji: `:<emoji>: <description>`,
    jujutsu: `<component>: <description>`,
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
    jujutsu: `\n${Object.entries({
        cli: 'Command-line interface changes',
        ui: 'User interface and frontend changes',
        api: 'API and backend service changes',
        auth: 'Authentication and authorization changes',
        db: 'Database schema and migration changes',
        docs: 'Documentation updates',
        config: 'Configuration and settings changes',
        test: 'Testing and test infrastructure',
        build: 'Build system and compilation changes',
        deploy: 'Deployment and infrastructure changes',
        perf: 'Performance improvements and optimizations',
        security: 'Security fixes and enhancements',
        deps: 'Dependency updates and management',
        refactor: 'Code refactoring without functional changes',
        style: 'Code style and formatting changes',
        fix: 'Bug fixes and error corrections',
        feature: 'New features and functionality',
        cleanup: 'Code cleanup and maintenance',
        logging: 'Logging and monitoring changes',
        i18n: 'Internationalization and localization',
    })
        .map(([key, value]) => `  - ${key}: ${value}`)
        .join('\n')}`,
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

const defaultPrompt = (promptOptions: PromptOptions) => {
    const { type, maxLength, generate, locale } = promptOptions;

    const systemDescription =
        type === 'jujutsu'
            ? `You are an expert Jujutsu (jj) commit message writer specializing in analyzing code changes and creating precise, component-focused commit messages.`
            : `You are an expert Git commit message writer specializing in analyzing code changes and creating precise, meaningful commit messages.`;

    const taskDescription =
        type === 'jujutsu'
            ? `Your task is to generate exactly ${generate} Jujutsu style commit message${generate !== 1 ? 's' : ''} based on the provided diff.`
            : `Your task is to generate exactly ${generate} ${type} style commit message${generate !== 1 ? 's' : ''} based on the provided git diff.`;

    return [
        systemDescription,
        taskDescription,
        '',
        `## Requirements:`,
        `1. Language: Write all messages in ${locale}`,
        `2. Format: Strictly follow the ${type} commit format:`,
        `${commitTypeFormats[type]}`,
        `3. Allowed Types:${commitTypes[type]}`,
        '',
        `## Guidelines:`,
        `- Subject line: Max ${maxLength} characters, imperative mood, no period`,
        `- Analyze the diff to understand:`,
        `  * What files were changed`,
        `  * What functionality was added, modified, or removed`,
        `  * The scope and impact of changes`,
        type === 'jujutsu' ? `- For the component prefix, choose based on:${commitTypes[type]}` : `- For the commit type, choose based on:`,
        ...(type !== 'jujutsu'
            ? [
                  `  * feat: New functionality or feature`,
                  `  * fix: Bug fixes or error corrections`,
                  `  * refactor: Code restructuring without changing functionality`,
                  `  * docs: Documentation changes only`,
                  `  * style: Formatting, missing semi-colons, etc`,
                  `  * test: Adding or modifying tests`,
                  `  * chore: Maintenance tasks, dependency updates`,
                  `  * perf: Performance improvements`,
                  `  * build: Build system or external dependency changes`,
                  `  * ci: CI configuration changes`,
                  `- Scope: Extract from file paths or logical grouping (e.g., auth, api, ui)`,
              ]
            : [
                  `- Component: Identify the main system component affected (e.g., cli, ui, api, auth)`,
                  `- Description: Write a clear, concise description of what was changed`,
              ]),
        `- Body (when needed):`,
        `  * Explain the motivation for the change`,
        `  * Compare previous behavior with new behavior`,
        `  * Note any breaking changes or important details`,
        `- Footer: Include references to issues, breaking changes if applicable`,
        '',
        `## Analysis Approach:`,
        `1. Identify the primary purpose of the changes`,
        `2. Group related changes together`,
        `3. Determine the most appropriate type and scope`,
        `4. Write a clear, concise subject line`,
        `5. Add body details for complex changes`,
        '',
        `Remember: The commit message should help future developers understand WHY this change was made, not just WHAT was changed.`,
    ]
        .filter(Boolean)
        .join('\n');
};

const finalPrompt = (type: CommitType, generate: number) => {
    const example = (type: CommitType) => {
        if (type === 'conventional') {
            return `${Array(generate)
                .fill(null)
                .map(
                    (_, index) => `
  {
    "subject": "fix(auth): fix bug in user authentication process",
    "body": "- Update login function to handle edge cases\\n- Add additional error logging for debugging",
    "footer": ""
  }`
                )
                .join(',')}`;
        }
        if (type === 'jujutsu') {
            return `${Array(generate)
                .fill(null)
                .map(
                    (_, index) => `
  {
    "subject": "ui: implement responsive navigation component",
    "body": "Add mobile-friendly navigation that collapses on small screens.\\nUses CSS Grid for flexible layout and supports keyboard navigation.",
    "footer": ""
  }`
                )
                .join(',')}`;
        }
        return `${Array(generate)
            .fill(null)
            .map(
                (_, index) => `
  {
    "subject": ":sparkles: Add real-time chat feature",
    "body": "- Implement WebSocket connection\\n- Add message encryption\\n- Include typing indicators",
    "footer": ""
  }`
            )
            .join(',')}`;
    };

    return [
        `\nLastly, Provide your response as a JSON array containing exactly ${generate} object${generate !== 1 ? 's' : ''}, each with the following keys:`,
        `- "subject": The main commit message using the ${type} style. It should be a concise summary of the changes.`,
        `- "body": An optional detailed explanation of the changes. If not needed, use an empty string.`,
        `- "footer": An optional footer for metadata like BREAKING CHANGES. If not needed, use an empty string.`,
        `The array must always contain ${generate} element${generate !== 1 ? 's' : ''}, no more and no less.`,
        `Example response format: \n[${example(type)}\n]`,
        `Ensure you generate exactly ${generate} commit message${generate !== 1 ? 's' : ''}, even if it requires creating slightly varied versions for similar changes.`,
        `The response should be valid JSON that can be parsed without errors.`,
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
        const systemPromptTemplate = fs.readFileSync(resolvePromptPath(systemPromptPath), 'utf-8');
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

export const isValidJujutsuMessage = (message: string): boolean => {
    // Jujutsu format: component: description
    const jujutsuReg = /^[a-zA-Z0-9_-]+: .+$/;
    return jujutsuReg.test(message);
};

export const codeReviewPrompt = (promptOptions: PromptOptions) => {
    const { codeReviewPromptPath, locale } = promptOptions;
    const defaultPrompt = `I'll give you the output of the "git diff" command as an input. Please review the following code and provide your feedback in Markdown format. Focus on:

1. Language: ${locale}
2. Code quality and best practices
3. Potential bugs or errors
4. Performance improvements
5. Readability and maintainability

Please structure your response with appropriate Markdown headings, code blocks, and bullet points.`;

    if (!codeReviewPromptPath) {
        return defaultPrompt;
    }

    try {
        const codeReviewPromptTemplate = fs.readFileSync(resolvePromptPath(codeReviewPromptPath), 'utf-8');
        return `${parseTemplate(codeReviewPromptTemplate, promptOptions)}`;
    } catch (error) {
        return defaultPrompt;
    }
};

export const validateSystemPrompt = async (config: ValidConfig) => {
    if (config.systemPromptPath) {
        try {
            fs.readFileSync(resolvePromptPath(config.systemPromptPath), 'utf-8');
        } catch (error) {
            throw new KnownError(`Error reading system prompt file: ${config.systemPromptPath}, ${error}`);
        }
    }

    if (config.codeReview && config.codeReviewPromptPath) {
        try {
            fs.readFileSync(resolvePromptPath(config.codeReviewPromptPath), 'utf-8');
        } catch (error) {
            throw new KnownError(`Error reading code review prompt file: ${config.codeReviewPromptPath}, ${error}`);
        }
    }
};

export const generateUserPrompt = (diff: string, requestType: 'commit' | 'review' = 'commit'): string => {
    if (requestType === 'review') {
        return `Please analyze the following git diff and provide a comprehensive code review:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nFocus on code quality, potential issues, and improvement suggestions.`;
    }

    return `Please analyze the following git diff and generate commit message(s) based on the changes:\n\n\`\`\`diff\n${diff}\n\`\`\`\n\nFocus on understanding the purpose and impact of these changes to create meaningful commit message(s).`;
};
