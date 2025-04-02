# Mistral & Codestral

## 📌 Important Note

**Before configuring, please review:**
- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup
```sh
aicommit2 config set MISTRAL.key="your-api-key"
aicommit2 config set MISTRAL.model="codestral-latest"
```

### Advanced Setup
```sh
aicommit2 config set MISTRAL.key="your-api-key" \
  MISTRAL.model="codestral-latest" \
  MISTRAL.temperature=0.7 \
  MISTRAL.maxTokens=4000 \
  MISTRAL.locale="en" \
  MISTRAL.generate=3 \
  MISTRAL.topP=0.9
```

## Mistral Settings

| Setting  | Description      | Default            |
|----------|------------------|--------------------|
| `key`    | API key          | -                  |
| `model`  | Model to use     | `pixtral-12b-2409` |

## Mistral Configuration

#### MISTRAL.key

The Mistral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/).

#### MISTRAL.model

Default: `pixtral-12b-2409`

Supported:
- `codestral-latest`
- `mistral-large-latest`
- `pixtral-large-latest`
- `ministral-8b-latest`
- `mistral-small-latest`
- `mistral-embed`
- `mistral-moderation-latest`

## Codestral Settings

| Setting | Description      | Default            |
|---------|------------------|--------------------|
| `key`   | API key          | -                  |
| `model` | Model to use     | `codestral-latest` |

## Codestral Configuration

#### CODESTRAL.key

The Codestral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/codestral).

#### CODESTRAL.model

Default: `codestral-latest`

Supported:
- `codestral-latest`
- `codestral-2501`

```sh
aicommit2 config set CODESTRAL.model="codestral-2501"
```
