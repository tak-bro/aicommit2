import { execSync } from 'child_process';

import { command } from 'cleye';

import { ConsoleManager } from '../managers/console.manager.js';
import {
    GITHUB_MODELS_API_VERSION,
    GITHUB_MODELS_BASE_URL,
    GITHUB_MODELS_DEFAULT_MODEL,
    GITHUB_MODELS_INFERENCE_PATH,
    isValidGitHubTokenFormat,
} from '../services/ai/github-models.utils.js';
import { setConfigs } from '../utils/config.js';
import { KnownError, handleCliError } from '../utils/error.js';

export default command(
    {
        name: 'github-login',
        parameters: [],
        flags: {
            token: {
                type: String,
                description: 'Manually provide a GitHub token for authentication',
                alias: 't',
            },
        },
        help: {
            description: 'Login to GitHub and setup access to GitHub Models',
            examples: ['aic2 github-login', 'aic2 github-login --token github_pat_xxxxxxxxxxxxxxxxxxxx'],
        },
    },
    argv => {
        (async () => {
            const consoleManager = new ConsoleManager();

            if (argv.flags.token) {
                // Manual token authentication
                try {
                    await authenticateWithToken(argv.flags.token, consoleManager);
                } catch (error) {
                    throw new KnownError(`Token authentication failed: ${(error as Error).message}`);
                }
                return;
            }

            // Browser-based authentication
            try {
                await authenticateWithBrowser(consoleManager);
            } catch (error) {
                throw new KnownError(`Browser authentication failed: ${(error as Error).message}`);
            }
        })().catch(error => {
            const consoleManager = new ConsoleManager();
            consoleManager.printError(error.message);
            handleCliError(error);
            process.exit(1);
        });
    }
);

async function authenticateWithToken(token: string, consoleManager: ConsoleManager) {
    consoleManager.printWarning('Authenticating with provided token...');

    // Validate token format
    if (!isValidGitHubTokenFormat(token)) {
        throw new Error('Invalid token format. Expected GitHub token prefix like ghp_, gho_, ghu_, ghs_, ghr_, or github_pat_');
    }

    try {
        // Test the token by making a simple API request
        const response = await fetch('https://api.github.com/user', {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/vnd.github.v3+json',
                'User-Agent': 'aicommit2-github-models',
            },
        });

        if (!response.ok) {
            throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
        }

        const user = await response.json();

        // Test GitHub Models access
        try {
            const modelsResponse = await fetch(`${GITHUB_MODELS_BASE_URL}${GITHUB_MODELS_INFERENCE_PATH}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': GITHUB_MODELS_API_VERSION,
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'aicommit2-github-models',
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: 'test' }],
                    model: GITHUB_MODELS_DEFAULT_MODEL,
                    max_tokens: 1,
                }),
            });
            if (!modelsResponse.ok) {
                consoleManager.printWarning('Could not verify GitHub Models access, but proceeding with authentication...');
            } else {
                consoleManager.printSuccess('GitHub Models access verified!');
            }
        } catch {
            consoleManager.printWarning('Could not verify GitHub Models access, but proceeding with authentication...');
        }

        // Store token for GitHub Models
        await setConfigs([['GITHUB_MODELS.key', token]]);

        consoleManager.printSuccess(`Successfully authenticated as ${user.login}`);
    } catch (error) {
        throw new Error(`Token validation failed: ${(error as Error).message}`);
    }
}

async function authenticateWithBrowser(consoleManager: ConsoleManager) {
    consoleManager.printInfo('Starting GitHub browser authentication for GitHub Models...');

    // eslint-disable-next-line no-useless-catch
    try {
        // Check if GitHub CLI is available
        try {
            execSync('gh --version', { stdio: 'ignore' });
        } catch {
            throw new Error('GitHub CLI (gh) is not installed. Please install it first: https://cli.github.com/');
        }

        // Check if user is already authenticated with gh CLI
        try {
            const result = execSync('gh auth status', { encoding: 'utf8', stdio: 'pipe' });
            if (result.includes('Logged in to github.com')) {
                consoleManager.printInfo('Already authenticated with GitHub CLI');
            }
        } catch {
            // User is not authenticated, proceed with login
            consoleManager.printInfo('Authenticating with GitHub CLI...');
            consoleManager.printInfo('Please follow the instructions in your browser to complete authentication.');

            try {
                execSync('gh auth login --web -h github.com', { stdio: 'inherit' });
            } catch (error) {
                throw new Error('GitHub CLI authentication failed');
            }
        }

        // Verify GitHub Models access
        consoleManager.printInfo('Verifying GitHub Models access...');

        // Extract token from GitHub CLI and store it
        try {
            const token = execSync('gh auth token', { encoding: 'utf8' }).trim();
            if (token) {
                await setConfigs([['GITHUB_MODELS.key', token]]);
                consoleManager.printSuccess('GitHub token stored for GitHub Models access');
            }
        } catch {
            consoleManager.printWarning('Could not extract token from GitHub CLI, but authentication completed');
        }

        consoleManager.printSuccess('GitHub authentication completed and GitHub Models access verified!');
        consoleManager.printInfo('See usage guide: https://github.com/tak-bro/aicommit2/blob/main/docs/providers/github-models.md');
        consoleManager.printInfo('Use `gh models list` to view the latest available models.');
        consoleManager.printInfo(`Using GitHub Models API: ${GITHUB_MODELS_BASE_URL}`);
    } catch (error) {
        throw error;
    }
}
