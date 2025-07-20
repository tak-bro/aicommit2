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

## Example Configuration

### Basic Setup

```sh
aicommit2 github-login
aicommit2 config set GITHUB_MODELS.model="gpt-4o-mini"
```

### Advanced Setup

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

| Setting | Description | Default |
|---------|-------------|---------|
| `key` | GitHub token | - |
| `model` | Model to use | `gpt-4o-mini` |

## Configuration

#### GITHUB_MODELS.key

The GitHub Personal Access Token. Run `aicommit2 github-login` to authenticate automatically, or create a token manually at [github.com/settings/tokens](https://github.com/settings/tokens) with "Models" permission.

#### GITHUB_MODELS.model

Default: `gpt-4o-mini`

Supported:

- `gpt-4o-mini` (default)
- `gpt-4o`
- `gpt-3.5-turbo`
- `meta-llama-3.1-405b-instruct`
- `meta-llama-3.1-70b-instruct`
- `meta-llama-3.1-8b-instruct`
- `phi-3-medium-4k-instruct`
- `phi-3-mini-4k-instruct`
- `phi-3-small-8k-instruct`

```sh
aicommit2 config set GITHUB_MODELS.model="meta-llama-3.1-70b-instruct"
```
