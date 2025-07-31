# <a href="https://github.com/marketplace/models" target="_blank">GitHub Models</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

**GitHub Models is separate from GitHub Copilot.** While both are GitHub services:

- **GitHub Copilot**: Code completion and generation tool integrated into IDEs
- **GitHub Models**: API access to various AI models for general-purpose use

Currently, GitHub does not officially support direct access to the GitHub Copilot API. Instead, this implementation uses GitHub Models (https://models.inference.ai.azure.com), which provides:

- Authentication using GitHub Personal Access Token
- Access to various AI models (GPT, Claude, Llama, etc.)
- Free tier available with no additional API costs
- Uses the same GitHub account (separate from Copilot subscription)

This approach allows AI-powered commit message generation within the GitHub ecosystem using a stable and officially supported solution.

## 🚀 Quick Setup

### Option 1: Automatic Login (Recommended)

Use the built-in GitHub login command for seamless authentication:

```sh
aicommit2 github-login
```

This command will:
1. Open your browser for GitHub authentication
2. Automatically configure your token
3. Verify GitHub Models access
4. Store the configuration for immediate use

### Option 2: Manual Token Setup

If you prefer manual setup or need to use a specific token:

1. Create a Personal Access Token at [github.com/settings/tokens](https://github.com/settings/tokens)
2. Select the "Models" permission scope
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

### Basic Usage

After authentication, you can immediately start using GitHub Models:

```sh
# Basic setup
aicommit2 github-login
aicommit2 config set GITHUB_MODELS.model="gpt-4o-mini"

# Use with your git repository
git add .
aicommit2
```

### Advanced Configuration

```sh
aicommit2 config set GITHUB_MODELS.key="ghp_xxxxxxxxxxxxxxxxxxxx" \
    GITHUB_MODELS.model="gpt-4o-mini" \
    GITHUB_MODELS.temperature=0.7 \
    GITHUB_MODELS.maxTokens=1024 \
    GITHUB_MODELS.locale="en" \
    GITHUB_MODELS.generate=3 \
    GITHUB_MODELS.topP=0.95
```

## Settings

| Setting | Description  | Default       |
| ------- | ------------ | ------------- |
| `key`   | GitHub token | -             |
| `model` | Model to use | `gpt-4o-mini` |

## Configuration Details

### Authentication Setup

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

Default: `gpt-4o-mini`

**Available Models:**

| Model | Provider | Context | Best For |
|-------|----------|---------|----------|
| `gpt-4o-mini` | OpenAI | 128K | General use (default) |
| `gpt-4o` | OpenAI | 128K | Complex reasoning |
| `gpt-3.5-turbo` | OpenAI | 16K | Fast responses |
| `meta-llama-3.1-405b-instruct` | Meta | 128K | Advanced reasoning |
| `meta-llama-3.1-70b-instruct` | Meta | 128K | Balanced performance |
| `meta-llama-3.1-8b-instruct` | Meta | 128K | Fast, efficient |
| `phi-3-medium-4k-instruct` | Microsoft | 4K | Code-focused |
| `phi-3-mini-4k-instruct` | Microsoft | 4K | Lightweight |
| `phi-3-small-8k-instruct` | Microsoft | 8K | Balanced |

```sh
aicommit2 config set GITHUB_MODELS.model="meta-llama-3.1-70b-instruct"
```
