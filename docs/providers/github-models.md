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

## 🚀 Quick setup

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

## Usage examples

### Basic usage

After authentication, you can immediately start using GitHub Models:

```sh
# Basic setup
aicommit2 github-login
aicommit2 config set GITHUB_MODELS.model="gpt-4o-mini"

# Use with your git repository
git add .
aicommit2
```

### Advanced configuration

```sh
aicommit2 config set \
    GITHUB_MODELS.key="ghp_xxxxxxxxxxxxxxxxxxxx" \
    GITHUB_MODELS.model="gpt-5" \
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

## Configuration details

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

Default: `gpt-4o-mini`

**Available Models (40+):**

GitHub Models provides access to leading AI models from multiple providers. Use `gh models list` to see the latest catalog.

##### OpenAI Models

| Model            | Context | Best For                          | Status                   |
| ---------------- | ------- | --------------------------------- | ------------------------ |
| `gpt-5`          | 200K    | Complex reasoning, multi-step     | GA                       |
| `gpt-5-mini`     | 200K    | Fast, lightweight responses       | GA                       |
| `gpt-5-nano`     | 200K    | Speed-optimized tasks             | GA                       |
| `gpt-5-codex`    | 200K    | Code generation and refactoring   | Preview                  |
| `gpt-4.1`        | 128K    | Advanced reasoning                | GA                       |
| `gpt-4.1-mini`   | 128K    | Cost-efficient                    | GA                       |
| `gpt-4.1-nano`   | 128K    | Fast responses                    | GA                       |
| `gpt-4o`         | 128K    | Multimodal, general use           | GA                       |
| `gpt-4o-mini`    | 128K    | General use (default)             | GA                       |
| `o3`             | 128K    | Advanced reasoning                | ⚠️ Closing 2025-10-23    |
| `o4-mini`        | 128K    | Fast reasoning                    | ⚠️ Closing 2025-10-23    |

##### Anthropic Models

| Model                  | Context | Best For                     | Status                   |
| ---------------------- | ------- | ---------------------------- | ------------------------ |
| `claude-opus-4.1`      | 200K    | Sophisticated reasoning      | GA                       |
| `claude-sonnet-4.5`    | 200K    | Complex problem-solving      | GA                       |
| `claude-sonnet-4`      | 200K    | Balanced performance         | GA                       |
| `claude-opus-4`        | 200K    | High capability              | ⚠️ Closing 2025-10-23    |
| `claude-sonnet-3.7`    | 200K    | Fast responses               | ⚠️ Closing 2025-10-23    |

##### Meta Models (Llama)

| Model                            | Context | Best For                  | Status |
| -------------------------------- | ------- | ------------------------- | ------ |
| `llama-3.2-11b`                  | 128K    | Efficient reasoning       | GA     |
| `llama-3.2-90b`                  | 128K    | Advanced capability       | GA     |
| `llama-4-scout-17b-16e-instruct` | 128K    | Multi-document analysis   | GA     |
| `meta-llama-3.1-405b-instruct`   | 128K    | Advanced reasoning        | GA     |
| `meta-llama-3.1-70b-instruct`    | 128K    | Balanced performance      | GA     |
| `meta-llama-3.1-8b-instruct`     | 128K    | Fast, efficient           | GA     |

##### Microsoft Models (Phi)

| Model                        | Context | Best For           | Status |
| ---------------------------- | ------- | ------------------ | ------ |
| `phi-3.5-moe-instruct`       | 128K    | Code-focused       | GA     |
| `phi-3.5-mini-instruct`      | 128K    | Lightweight tasks  | GA     |
| `phi-3.5-vision-instruct`    | 128K    | Visual reasoning   | GA     |
| `phi-3-medium-4k-instruct`   | 4K      | Code-focused       | GA     |
| `phi-3-mini-4k-instruct`     | 4K      | Lightweight        | GA     |
| `phi-3-small-8k-instruct`    | 8K      | Balanced           | GA     |

##### Google Models

| Model              | Context | Best For                  | Status |
| ------------------ | ------- | ------------------------- | ------ |
| `gemini-2.5-pro`   | 1M      | Large codebase analysis   | GA     |

##### Other Providers

- **DeepSeek**: `deepseek-v3-0324`, `deepseek-coder`
- **Mistral AI**: `mistral-large-2`
- **Cohere**: `cohere-command-r`, `cohere-command-r-plus`
- **AI21 Labs**: `ai21-jamba-1.5-large`, `ai21-jamba-1.5-mini`
- **xAI**: `grok-code-fast-1` (Preview)

**Checking Available Models:**

```bash
# Install GitHub Models CLI extension
gh extension install https://github.com/github/gh-models

# List all current models
gh models list
```

### Deprecated models

⚠️ **Sunset schedule**:

- `o3`, `o4-mini` - Closing 2025-10-23
- `claude-opus-4`, `claude-sonnet-3.7` - Closing 2025-10-23
