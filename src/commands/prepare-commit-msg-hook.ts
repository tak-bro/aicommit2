import fs from 'fs/promises';

import { filter, lastValueFrom, map, toArray } from 'rxjs';

import { AIRequestManager } from '../managers/ai-request.manager.js';
import { ConsoleManager } from '../managers/console.manager.js';
import { ApiKeyName, ApiKeyNames } from '../services/ai/ai.service.js';
import { getConfig } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';
import { getStagedDiff } from '../utils/git.js';

const [messageFilePath, commitSource] = process.argv.slice(2);

export default () =>
    (async () => {
        if (!messageFilePath) {
            throw new KnownError(
                'Commit message file path is missing. This file should be called from the "prepare-commit-msg" git hook'
            );
        }

        // If a commit message is passed in, ignore
        if (commitSource) {
            return;
        }

        // All staged files can be ignored by our filter
        const staged = await getStagedDiff();
        if (!staged) {
            return;
        }

        const consoleManager = new ConsoleManager();
        consoleManager.printTitle();

        const { env } = process;
        const config = await getConfig({
            proxy: env.https_proxy || env.HTTPS_PROXY || env.http_proxy || env.HTTP_PROXY,
        });

        const availableAPIKeyNames: ApiKeyName[] = Object.entries(config)
            .filter(([key]) => ApiKeyNames.includes(key as ApiKeyName))
            .filter(([_, value]) => !!value)
            .map(([key]) => key as ApiKeyName);

        const hasNoAvailableAIs = availableAPIKeyNames.length === 0;
        if (hasNoAvailableAIs) {
            throw new KnownError('Please set at least one API key via `aicommit2 config set OPENAI_KEY=<your token>`');
        }

        const aiRequestManager = new AIRequestManager(config, staged);
        const spinner = consoleManager.displaySpinner('The AI is analyzing your changes');
        let messages: string[];
        try {
            messages = await lastValueFrom(
                aiRequestManager.createAIRequests$(availableAPIKeyNames).pipe(
                    filter(data => !data.isError),
                    map(data => data.value),
                    toArray()
                )
            );
        } finally {
            spinner.stop();
            spinner.clear();
            consoleManager.printAnalyzed();
        }

        /**
         * When `--no-edit` is passed in, the base commit message is empty,
         * and even when you use pass in comments via #, they are ignored.
         *
         * Note: `--no-edit` cannot be detected in argvs so this is the only way to check
         */
        const baseMessage = await fs.readFile(messageFilePath, 'utf8');
        const supportsComments = baseMessage !== '';
        const hasMultipleMessages = messages.length > 1;

        let instructions = '';

        if (supportsComments) {
            instructions = `# 🤖 AI generated commit${hasMultipleMessages ? 's' : ''}\n`;
        }

        if (hasMultipleMessages) {
            if (supportsComments) {
                instructions += '# Select one of the following messages by uncommenting:\n';
            }
            instructions += `\n${messages.map(message => `# ${message}`).join('\n')}`;
        } else {
            if (supportsComments) {
                instructions += '# Edit the message below and commit:\n';
            }
            instructions += `\n${messages[0]}\n`;
        }

        await fs.appendFile(messageFilePath, instructions);
        consoleManager.printSavedCommitMessage();
    })().catch(error => {
        const commandLineManager = new ConsoleManager();
        commandLineManager.printErrorMessage(error.message);
        handleCliError(error);
        process.exit(1);
    });
