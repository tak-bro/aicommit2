# <a href="https://github.com/marketplace/models" target="_blank">GitHub Models</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

**GitHub Models is separate from GitHub Copilot.** While both are GitHub services:

- **GitHub Copilot**: Code completion and generation tool integrated into IDEs
- **GitHub Models**: API access to various AI models for general-purpose use

Currently, GitHub does not officially support direct access to the GitHub Copilot API. Instead, this implementation uses [GitHub Models](https://models.github.ai), which provides:

- Authentication using GitHub Personal Access Token (requires `models` scope)
- Access to various AI models (GPT, Llama, DeepSeek, Mistral, etc.)
- Free tier available with no additional API costs
- Uses the same GitHub account (separate from Copilot subscription)

> **Note:** GitHub Copilot Chat supports additional models (e.g., Claude, Gemini) that are **not available** through the GitHub Models API. These are two separate products with different model catalogs.

This approach allows AI-powered commit message generation within the GitHub ecosystem using a stable and officially supported solution.

## 🚀 Quick Setup

### Option 1: Automatic login (recommended)

Use the built-in GitHub login command for seamless authentication:

```sh
aicommit2 github-login
```

This command will:

1. Open your browser for GitHub authentication
2. Automatically configure your token
3. Verify GitHub Models access
4. Store the configuration for immediate use

### Option 2: Manual token setup

If you prefer manual setup or need to use a specific token:

1. Create a [Personal Access Token](https://github.com/settings/tokens)
2. Select the `models` permission scope
3. Use the token directly:

```sh
aicommit2 github-login --token ghp_xxxxxxxxxxxxxxxxxxxx
# or
aicommit2 config set GITHUB_MODELS.key="ghp_xxxxxxxxxxxxxxxxxxxx"
```

### Prerequisites

For automatic login, you'll need:

- [GitHub CLI](https://cli.github.com/) installed on your system
- A web browser for authentication

Install GitHub CLI:

```sh
# macOS
brew install gh

# Windows (using Chocolatey)
choco install gh

# Windows (using winget)
winget install GitHub.cli

# Linux
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

## Usage Examples

### Basic usage

After authentication, you can immediately start using GitHub Models:

```sh
# Basic setup
aicommit2 github-login
aicommit2 config set GITHUB_MODELS.model="openai/gpt-4o-mini"

# Use with your git repository
git add .
aicommit2
```

### Advanced configuration

```sh
aicommit2 config set \
    GITHUB_MODELS.key="ghp_xxxxxxxxxxxxxxxxxxxx" \
    GITHUB_MODELS.model="openai/gpt-5" \
    GITHUB_MODELS.temperature=0.7 \
    GITHUB_MODELS.maxTokens=1024 \
    GITHUB_MODELS.locale="en" \
    GITHUB_MODELS.generate=3 \
    GITHUB_MODELS.topP=0.95
```

## Settings

| Setting | Description  | Default              |
| ------- | ------------ | -------------------- |
| `key`   | GitHub token | -                    |
| `model` | Model to use | `openai/gpt-4o-mini` |

## Configuration Details

### Authentication setup

#### GITHUB_MODELS.key

Your GitHub Personal Access Token for accessing GitHub Models.

**Automatic Setup (Recommended):**

```sh
aicommit2 github-login
```

**Manual Setup:**

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens)
2. Create a new token with "Models" permission
3. Configure it:

```sh
aicommit2 config set GITHUB_MODELS.key="ghp_xxxxxxxxxxxxxxxxxxxx"
```

#### GITHUB_MODELS.model

Default: `openai/gpt-4o-mini`

> **Important:** The GitHub Models API now uses `publisher/model_name` format for model names (e.g., `openai/gpt-4o-mini` instead of `gpt-4o-mini`).

**Available Models (40+)**

GitHub Models provides access to leading AI models from multiple providers. Use `gh models list` to see the latest catalog.

##### OpenAI Models

| Model                | Description           |
| -------------------- | --------------------- |
| `openai/gpt-5`       | GPT-5                 |
| `openai/gpt-5-mini`  | GPT-5 Mini            |
| `openai/gpt-5-nano`  | GPT-5 Nano            |
| `openai/gpt-5-chat`  | GPT-5 Chat (Preview)  |
| `openai/gpt-4.1`     | GPT-4.1               |
| `openai/gpt-4.1-mini`| GPT-4.1 Mini          |
| `openai/gpt-4.1-nano`| GPT-4.1 Nano          |
| `openai/gpt-4o`      | GPT-4o                |
| `openai/gpt-4o-mini` | GPT-4o Mini           |
| `openai/o4-mini`     | o4 Mini               |
| `openai/o3`          | o3                    |
| `openai/o3-mini`     | o3 Mini               |
| `openai/o1`          | o1                    |
| `openai/o1-mini`     | o1 Mini               |
| `openai/o1-preview`  | o1 Preview            |

##### Meta Models (Llama)

| Model                                            | Description                          |
| ------------------------------------------------ | ------------------------------------ |
| `meta/llama-4-maverick-17b-128e-instruct-fp8`    | Llama 4 Maverick 17B 128E FP8       |
| `meta/llama-4-scout-17b-16e-instruct`            | Llama 4 Scout 17B 16E               |
| `meta/llama-3.3-70b-instruct`                    | Llama 3.3 70B                       |
| `meta/llama-3.2-90b-vision-instruct`             | Llama 3.2 90B Vision                |
| `meta/llama-3.2-11b-vision-instruct`             | Llama 3.2 11B Vision                |
| `meta/meta-llama-3.1-405b-instruct`              | Llama 3.1 405B                      |
| `meta/meta-llama-3.1-8b-instruct`                | Llama 3.1 8B                        |

##### Microsoft Models (Phi)

| Model                                | Description            |
| ------------------------------------ | ---------------------- |
| `microsoft/phi-4`                    | Phi-4                  |
| `microsoft/phi-4-reasoning`          | Phi-4 Reasoning        |
| `microsoft/phi-4-mini-reasoning`     | Phi-4 Mini Reasoning   |
| `microsoft/phi-4-mini-instruct`      | Phi-4 Mini Instruct    |
| `microsoft/phi-4-multimodal-instruct`| Phi-4 Multimodal       |
| `microsoft/mai-ds-r1`               | MAI-DS-R1              |

##### DeepSeek Models

| Model                       | Description       |
| --------------------------- | ----------------- |
| `deepseek/deepseek-r1`      | DeepSeek-R1       |
| `deepseek/deepseek-r1-0528` | DeepSeek-R1-0528  |
| `deepseek/deepseek-v3-0324` | DeepSeek-V3-0324  |

##### Mistral AI Models

| Model                            | Description              |
| -------------------------------- | ------------------------ |
| `mistral-ai/codestral-2501`      | Codestral 25.01          |
| `mistral-ai/mistral-medium-2505` | Mistral Medium 3 (25.05) |
| `mistral-ai/mistral-small-2503`  | Mistral Small 3.1        |
| `mistral-ai/ministral-3b`        | Ministral 3B             |

##### xAI Models

| Model             | Description |
| ----------------- | ----------- |
| `xai/grok-3`      | Grok 3      |
| `xai/grok-3-mini` | Grok 3 Mini |

##### Other Providers

- **Cohere**: `cohere/cohere-command-a`, `cohere/cohere-command-r-08-2024`, `cohere/cohere-command-r-plus-08-2024`
- **AI21 Labs**: `ai21-labs/ai21-jamba-1.5-large`

**Checking available models**

```bash
# Install GitHub Models CLI extension
gh extension install https://github.com/github/gh-models

# List all current models
gh models list
```
