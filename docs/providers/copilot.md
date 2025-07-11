# GitHub Models (Copilot)

GitHub Models provides access to various AI models through GitHub's infrastructure, including GPT, Llama, and Phi models. This integration uses the official GitHub Models API.

## Setup

### Prerequisites
- GitHub account with GitHub Models access
- GitHub CLI (`gh`) installed (optional)
- GitHub token with Models permission

### Authentication

#### Option 1: Browser Authentication (Recommended)
```bash
aic2 copilot-login
```

This will:
1. Authenticate with GitHub via browser using GitHub CLI
2. Verify GitHub Models access
3. Store the token in your aicommit2 configuration

#### Option 2: Token Authentication
```bash
aic2 copilot-login --token ghp_xxxxxxxxxxxxxxxxxxxx
```

**Token Requirements:**
- Create a personal access token at https://github.com/settings/tokens
- No specific scopes required for basic access
- Go to Permissions > Account permissions > Models, and set to "Read-only"

### Configuration

```bash
# Set preferred model
aic2 config set COPILOT.model=gpt-4o

# Set temperature
aic2 config set COPILOT.temperature=0.7

# Set max tokens
aic2 config set COPILOT.maxTokens=1024
```

## Supported Models

GitHub Models supports the following models:

### GPT Models
- `gpt-4o-mini` (default)
- `gpt-4o`
- `gpt-3.5-turbo`

### Meta Llama Models
- `meta-llama-3.1-405b-instruct`
- `meta-llama-3.1-70b-instruct`
- `meta-llama-3.1-8b-instruct`

### Microsoft Phi Models
- `phi-3-medium-4k-instruct`
- `phi-3-mini-4k-instruct`
- `phi-3-small-8k-instruct`

## Usage

### Generate Commit Messages
```bash
aic2 --ai COPILOT
```

### Generate Code Review
```bash
aic2 --code-review --ai COPILOT
```

### Multiple Generations
```bash
aic2 --ai COPILOT --generate 3
```

### With Specific Model
```bash
aic2 config set COPILOT.model=meta-llama-3.1-70b-instruct
aic2 --ai COPILOT
```

## Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `COPILOT.key` | GitHub token | `""` |
| `COPILOT.model` | Model to use | `["gpt-4o-mini"]` |
| `COPILOT.temperature` | Randomness (0-1) | `0.7` |
| `COPILOT.maxTokens` | Maximum tokens | `1024` |
| `COPILOT.topP` | Top P sampling | `0.95` |
| `COPILOT.timeout` | Request timeout (ms) | `10000` |
| `COPILOT.generate` | Number of suggestions | `1` |
| `COPILOT.locale` | Language locale | `"en"` |
| `COPILOT.type` | Commit type | `"conventional"` |

## Example Configuration

```bash
# Setup with Llama model
aic2 config set COPILOT.model=meta-llama-3.1-70b-instruct
aic2 config set COPILOT.temperature=0.8
aic2 config set COPILOT.generate=2

# Generate commit messages
aic2 --ai COPILOT
```

## Rate Limits

GitHub Models has different rate limits based on your account:

- **With GitHub Copilot license**: Higher rate limits
- **Without GitHub Copilot license**: Lower rate limits for free usage

## Troubleshooting

### Authentication Issues
```bash
# Re-authenticate
aic2 copilot-login

# Check token
aic2 config get COPILOT.key
```

### Common Errors

**"GitHub authentication failed"**
- Run `aic2 copilot-login` to re-authenticate
- Verify your GitHub token is valid

**"GitHub Models access denied"**
- Ensure your token has "Models" permission
- Check https://github.com/settings/tokens

**"Model not found"**
- Verify the model name is correct
- Use `aic2 config get COPILOT.model` to check current model

**"Request timed out"**
- Increase timeout: `aic2 config set COPILOT.timeout=30000`
- Try a different model

### Token Permissions

To set up proper token permissions:
1. Go to https://github.com/settings/tokens
2. Create a new token (classic)
3. No repository permissions needed
4. Go to Account permissions > Models > Read-only

## API Details

- **Endpoint**: `https://models.inference.ai.azure.com`
- **API Format**: OpenAI-compatible
- **Authentication**: Bearer token (GitHub PAT)
- **Models**: Hosted on Microsoft Azure infrastructure

## Notes

- GitHub Models is free for basic usage
- Higher rate limits available with GitHub Copilot license
- All requests are processed through GitHub's infrastructure
- API format is compatible with OpenAI's chat completions API