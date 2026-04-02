# <a href="https://github.com/marketplace/models" target="_blank">GitHub Models</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

**GitHub Models is separate from GitHub Copilot UI features.**

- **GitHub Copilot**: IDE/chat coding assistant experience
- **GitHub Models**: REST API access to hosted models via `https://models.github.ai`

_aicommit2_ integrates with the official **GitHub Models API**, not private Copilot endpoints.

## 🚀 Quick Setup

### Option 1: Automatic login (recommended)

```sh
aicommit2 github-login
```

This command:

1. Authenticates with GitHub CLI
2. Stores token in `GITHUB_MODELS.key`
3. Verifies GitHub Models access

### Option 2: Manual token setup

1. Create a GitHub Personal Access Token (PAT)
2. Grant permission: `models: read`
3. Configure token:

```sh
aicommit2 github-login --token github_pat_xxxxxxxxxxxxxxxxxxxx
# or
aicommit2 config set GITHUB_MODELS.key="github_pat_xxxxxxxxxxxxxxxxxxxx"
```

## PAT Generation (Important)

Create a token from GitHub settings:

- Fine-grained token (recommended): [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
- Classic token page: [github.com/settings/tokens](https://github.com/settings/tokens)

You can find additional information at the link: [GitHub personal access tokens documentation](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

Token must have `models: read` access, otherwise requests typically fail with `403`.

Supported token prefixes in _aicommit2_ include:

- `github_pat_...`
- `ghp_...`
- `gho_...`
- `ghu_...`
- `ghs_...`
- `ghr_...`

## Prerequisites (for `github-login`)

- [GitHub CLI](https://cli.github.com/) installed
- Browser access for web login

Install GitHub CLI:

```sh
# macOS
brew install gh

# Windows (winget)
winget install GitHub.cli

# Windows (choco)
choco install gh

# Linux (Debian/Ubuntu)
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update
sudo apt install gh
```

## Model ID Format (Required)

`GITHUB_MODELS.model` must use this format:

```text
publisher/model
```

Examples:

- `openai/gpt-4o-mini`
- `openai/gpt-5`
- `openai/gpt-5-chat`
- `meta/llama-3.3-70b-instruct`

Legacy short IDs like `gpt-4o-mini` are invalid for this provider flow in _aicommit2_.

## Copilot Plan Limits (Important)

Model access depends on your GitHub Copilot plan and request allowance.

As of April 2, 2026 (based on current GitHub docs):

- **Copilot Free**: up to `2,000` inline suggestion requests and up to `50` premium requests/month. Model choice is limited.
- **Paid plans / Copilot Student**: unlimited inline suggestions and unlimited chat interactions for included models (`GPT-5 mini`, `GPT-4.1`, `GPT-4o`), with additional premium request allowances for premium models.
- GitHub explicitly notes model availability can vary by plan and can change over time.
- Additional premium request purchases are **not** available on Copilot Free.

You can find additional information at the link: [Plans for GitHub Copilot](https://github.com/features/copilot/plans) and [Requests in GitHub Copilot](https://docs.github.com/en/copilot/concepts/billing/copilot-requests).

### Important for aicommit2 users

Even if a model appears available in Copilot UI, it may still be unavailable for your token on `models.github.ai`.

For API usage with _aicommit2_, you may see:

- `400 unavailable_model` (model not currently usable for your token in API context)
- `403` (permission/entitlement issue)
- `429` (rate limiting)

When in doubt, run a live check with your own token before setting a default model.

## Validated Snapshot (April 2, 2026)

The following results were validated with a real `GITHUB_TOKEN` on `2026-04-02` using:

- `X-GitHub-Api-Version: 2026-03-10`
- catalog probe + throttled dry-run commit generation

### Probe result (`catalog` text models)

- Total probed models: `41`
- `200 OK`: `29`
- `400`: `7` (`unavailable_model` / `unknown_model`)
- `403`: `5`

### Dry-run commit generation result (for `200 OK` models)

- Total dry-run models: `29`
- `OK (generated)`: `23`
- `FAIL (no_valid_commit_message)`: `6`

### Models that generated valid commit messages (`OK`)

- OpenAI: `openai/gpt-4.1`, `openai/gpt-4.1-mini`, `openai/gpt-4.1-nano`, `openai/gpt-4o`, `openai/gpt-4o-mini`
- Cohere: `cohere/cohere-command-a`, `cohere/cohere-command-r-08-2024`, `cohere/cohere-command-r-plus-08-2024`
- DeepSeek: `deepseek/deepseek-v3-0324`
- Meta: `meta/llama-3.2-11b-vision-instruct`, `meta/llama-3.2-90b-vision-instruct`, `meta/llama-3.3-70b-instruct`, `meta/llama-4-maverick-17b-128e-instruct-fp8`, `meta/llama-4-scout-17b-16e-instruct`, `meta/meta-llama-3.1-405b-instruct`, `meta/meta-llama-3.1-8b-instruct`
- Mistral AI: `mistral-ai/codestral-2501`, `mistral-ai/ministral-3b`, `mistral-ai/mistral-medium-2505`, `mistral-ai/mistral-small-2503`
- xAI: `xai/grok-3`
- Microsoft: `microsoft/phi-4`, `microsoft/phi-4-multimodal-instruct`

### Models that responded but failed commit JSON validation (`FAIL`)

- `deepseek/deepseek-r1`
- `deepseek/deepseek-r1-0528`
- `xai/grok-3-mini`
- `microsoft/phi-4-mini-instruct`
- `microsoft/phi-4-mini-reasoning`
- `microsoft/phi-4-reasoning`

### Important interpretation

- This snapshot is **token-specific** and **time-specific**.
- A model can appear in `catalog/models` and still fail at inference time for your token (`unavailable_model`, `403`, etc.).
- A model can return `200` but still fail _aicommit2_ commit parsing if it does not return valid commit JSON.
- This is currently the most reliable way to find working models for your account: **probe + throttled dry-run**.

### Reproduce safely (low rate-limit risk)

1. Fetch catalog with `X-GitHub-Api-Version: 2026-03-10`.
2. Probe only text-generation models with a delay between requests (for example, `sleep 2`).
3. Keep only models with `HTTP 200`.
4. Run commit `--dry-run` checks sequentially with throttling (for example, `sleep 12`) and retry on `429`.

Example catalog command:

```bash
curl -sSL \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://models.github.ai/catalog/models > catalog.json
```

## Usage Examples

### Basic usage

```sh
aicommit2 github-login
aicommit2 config set GITHUB_MODELS.model="openai/gpt-5"

git add .
aicommit2
```

### Advanced configuration

```sh
aicommit2 config set \
  GITHUB_MODELS.key="github_pat_xxxxxxxxxxxxxxxxxxxx" \
  GITHUB_MODELS.model="openai/gpt-5" \
  GITHUB_MODELS.temperature=0.7 \
  GITHUB_MODELS.maxTokens=1024 \
  GITHUB_MODELS.locale="en" \
  GITHUB_MODELS.generate=3 \
  GITHUB_MODELS.topP=0.95
```

## Settings

| Setting | Description | Default |
| ------- | ----------- | ------- |
| `key` | GitHub token | - |
| `model` | GitHub Models model ID (`publisher/model`) | `openai/gpt-4o-mini` |

## Discover Available Models

GitHub catalog changes over time. Use live discovery instead of static hardcoded lists.

```bash
# Install extension once
gh extension install https://github.com/github/gh-models

# Show available models
gh models list

# Optional: raw catalog endpoint
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  https://models.github.ai/catalog/models
```

You can find additional information at the link: [GitHub Models inference REST API](https://docs.github.com/en/rest/models/inference).

## API Version

_aicommit2_ uses GitHub API version header:

```text
X-GitHub-Api-Version: 2026-03-10
```

## Troubleshooting

### 401 Unauthorized

Token is invalid/expired:

```sh
aicommit2 github-login
```

### 403 Forbidden

Token lacks `models: read` permission.

### 404 Model not found

Model unavailable for your account or incorrect model ID. Check `gh models list`.

### 422 Validation error

Model ID format is invalid. Use `publisher/model` (example: `openai/gpt-4o-mini`).

## References

You can find additional information at the link:

- [GitHub Models quickstart](https://docs.github.com/en/enterprise-cloud@latest/github-models/quickstart)
- [GitHub Models inference REST API](https://docs.github.com/en/rest/models/inference)
- [Plans for GitHub Copilot](https://github.com/features/copilot/plans)
- [Requests in GitHub Copilot](https://docs.github.com/en/copilot/concepts/billing/copilot-requests)
- [GitHub REST breaking changes](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes?apiVersion=2026-03-10)
- [gh-models extension](https://github.com/github/gh-models)
