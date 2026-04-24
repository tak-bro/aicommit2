# GitHub Copilot SDK (Preview)

## Important

_aicommit2_ `COPILOT_SDK` provider uses the official Copilot SDK flow, not the GitHub Models REST API endpoint.

- `COPILOT_SDK` relies on a local Copilot CLI session.
- Model access depends on your Copilot subscription, account policy, and client context.
- A model listed in Copilot docs may still be unavailable in a specific runtime session.

See: [Getting started with Copilot SDK](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)

## How it works in aicommit2

When `COPILOT_SDK` is selected, _aicommit2_:

1. Loads `@github/copilot-sdk` dynamically.
2. Creates a Copilot session for the configured model.
3. Sends prompt + git diff to generate a commit message.
4. Parses and validates the response against commit format rules.

If the primary model is unavailable, _aicommit2_ tries fallback models (`gpt-4.1`, `gpt-4o`, `gpt-5-mini`).

## Prerequisites

1. Node.js `22+` (required for `node:sqlite` runtime paths).
2. Copilot CLI installed and authenticated.
3. `@github/copilot-sdk` installed in your project/runtime.

> ⚠️ **Homebrew users:** `brew install aicommit2` does not include Copilot SDK due to its proprietary dependency. Install via `npm install -g aicommit2` to use this provider.

See: [Copilot CLI installation and setup](https://docs.github.com/en/copilot/managing-copilot/configure-personal-settings/installing-github-copilot-in-the-cli)

## Known Working Models

> ⚠️ Model availability may change as GitHub updates Copilot. This list was community-tested and may not reflect current availability.

### Free Tier

| Model | Notes |
|-------|-------|
| `claude-haiku-4.5` | Default for Free users |
| `gpt-5-mini` | Free |
| `gpt-4.1` | Free |

### Pro Tier

| Model | Notes |
|-------|-------|
| `claude-sonnet-4.6` | Default for Pro users |
| `claude-sonnet-4.5` | |
| `claude-opus-4.6` | |
| `claude-opus-4.5` | |
| `claude-sonnet-4` | |
| `gpt-5.4` | |
| `gpt-5.3-codex` | |
| `gpt-5.2-codex` | |
| `gpt-5.2` | |
| `gpt-5.1` | |
| `gpt-5.4-mini` | |

## Token permissions and auth variables

For Copilot CLI / Copilot SDK flow:

- Use a **Fine-Grained PAT** (`github_pat_...`) if you authenticate by token.
- Required token permission: **Copilot Requests**.
- Classic PAT (`ghp_...`) is not supported by Copilot CLI.

`aicommit2` `COPILOT_SDK` provider isolates auth for stability:

- `COPILOT_GITHUB_TOKEN` is used when present.
- If `COPILOT_GITHUB_TOKEN` is not set, provider uses logged-in user auth (`copilot` login flow).
- `GH_TOKEN` and `GITHUB_TOKEN` are ignored for `COPILOT_SDK` requests.

Important distinction:

- `COPILOT_SDK` provider uses Copilot authentication (`Copilot Requests` permission).
- `GITHUB_MODELS` provider uses GitHub Models API and requires `models: read`.

See: [Authenticate Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/authenticate-copilot-cli)

## Configuration

Set a single model:

```bash
aicommit2 config set COPILOT_SDK.model="gpt-4.1"
```

Set multiple models (first is primary):

```bash
aicommit2 config set COPILOT_SDK.model="gpt-4.1,gpt-4o,gpt-5-mini"
```

Notes:

- `COPILOT_SDK.key` is not required.
- `COPILOT_SDK` uses the local Copilot session instead of a direct API key.
- GitHub Models style IDs like `openai/gpt-4.1` are normalized to Copilot SDK model names automatically.

## Recommended `config.ini` (stable baseline)

```ini
logging=true
generate=1
locale=en
type=conventional
includeBody=false
maxTokens=256
temperature=0.2

[COPILOT_SDK]
model=gpt-4.1,claude-haiku-4.5,gpt-4o
systemPrompt=Generate short, clear conventional commit messages.
```

Recommended environment setup:

```bash
export COPILOT_GITHUB_TOKEN="github_pat_xxx"
```

Why this helps:

- first model is primary, the rest are fallback candidates;
- avoids classic `ghp_` token issues by using a dedicated Copilot token;
- keeps generation format strict and inexpensive by default.

## Verification

Check provider health:

```bash
aicommit2 doctor
```

Expected healthy signal for `COPILOT_SDK`:

- Copilot CLI detected
- Model configured (warns if model is not in known working list)
- Node runtime compatible

Then validate generation in a git repo:

```bash
git add .
aicommit2 --auto-select --dry-run
```

Always-on checklist:

1. `node -v` is `22+`.
2. `copilot --version` returns successfully.
3. `aicommit2 doctor` shows `COPILOT_SDK` as healthy.
4. `aicommit2 --auto-select --dry-run` returns one valid commit message.

## Troubleshooting

### `Copilot CLI not found`

Install Copilot CLI and ensure `copilot` is in `PATH`.

### `Node.js ... is too old for Copilot SDK`

Upgrade Node.js to `22+`.

### `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite`

Runtime is too old for current Copilot SDK/CLI integration. Use Node.js `22+`.

### `Model is unavailable in Copilot SDK for this account/plan/client`

Try another configured model and verify subscription/policy access.

### `Copilot authentication failed`

Re-authenticate Copilot CLI, then retry.

### `No authentication information found`

Provide Copilot authentication using one of the supported methods:

- run Copilot CLI login flow (`copilot`, then `/login`),
- authenticate via GitHub CLI (`gh auth login`),
- or set `COPILOT_GITHUB_TOKEN` with a Fine-Grained PAT.

### `Classic Personal Access Tokens (ghp_) are not supported by Copilot`

Do not use classic `ghp_` PAT in `GITHUB_TOKEN`. Use a Fine-Grained PAT or Copilot login flow instead.

## References

- [Copilot SDK getting started](https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)
- [Copilot CLI installation](https://docs.github.com/en/copilot/managing-copilot/configure-personal-settings/installing-github-copilot-in-the-cli)
- [Configure access to AI models](https://docs.github.com/en/copilot/how-tos/use-ai-models/configure-access-to-ai-models)
- [Supported AI models in GitHub Copilot](https://docs.github.com/en/copilot/reference/ai-models/supported-models)
- [GitHub Copilot plans](https://github.com/features/copilot/plans)
- [Copilot requests and billing](https://docs.github.com/en/copilot/concepts/billing/copilot-requests)
- [Copilot SDK repository](https://github.com/github/copilot-sdk)
