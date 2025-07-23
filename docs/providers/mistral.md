# <a href="https://mistral.ai/" target="_blank">Mistral</a> & <a href="https://mistral.ai/news/codestral" target="_blank">Codestral</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set MISTRAL.key="your-api-key"
aicommit2 config set MISTRAL.model="mistral-small-latest"
```

### Advanced Setup

```sh
aicommit2 config set MISTRAL.key="your-api-key" \
    MISTRAL.model="mistral-small-latest" \
    MISTRAL.temperature=0.7 \
    MISTRAL.maxTokens=4000 \
    MISTRAL.locale="en" \
    MISTRAL.generate=3 \
    MISTRAL.topP=0.9
```

## Mistral Settings

| Setting | Description  | Default            |
| ------- | ------------ | ------------------ |
| `key`   | API key      | -                  |
| `model` | Model to use | `mistral-small-latest` |

## Mistral Configuration

#### MISTRAL.key

The Mistral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/).

#### MISTRAL.model

Default: `mistral-small-latest`

You can use any Mistral model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:
- `mistral-large-latest`, `pixtral-large-latest` (latest generation)
- `mistral-small-latest` (default), `ministral-8b-latest` (small models)
- `codestral-latest` (code-focused)
- `open-mistral-7b`, `open-mixtral-8x7b` (open models)

For the most up-to-date list of available models, please check [Mistral Console](https://console.mistral.ai/). 

## Codestral Settings

| Setting | Description  | Default            |
| ------- | ------------ | ------------------ |
| `key`   | API key      | -                  |
| `model` | Model to use | `codestral-latest` |

## Codestral Configuration

#### CODESTRAL.key

The Codestral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/codestral).

#### CODESTRAL.model

Default: `codestral-latest`

You can use any Codestral model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:
- `codestral-latest` (default)
- `codestral-2501`

For the most up-to-date list of available models, please check [Mistral Console](https://console.mistral.ai/codestral).

```sh
aicommit2 config set CODESTRAL.model="codestral-2501"
```
