# <a href="https://docs.perplexity.ai/" target="_blank">Perplexity</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set PERPLEXITY.key="your-api-key"
aicommit2 config set PERPLEXITY.model="sonar"
```

### Advanced Setup

```sh
aicommit2 config set PERPLEXITY.key="your-api-key" \
    PERPLEXITY.model="sonar-pro" \
    PERPLEXITY.temperature=0.7 \
    PERPLEXITY.maxTokens=4000 \
    PERPLEXITY.locale="en" \
    PERPLEXITY.generate=3 \
    PERPLEXITY.topP=0.9
```

## Settings

| Setting | Description  | Default |
| ------- | ------------ | ------- |
| `key`   | API key      | -       |
| `model` | Model to use | `sonar` |

## Configuration

#### PERPLEXITY.key

The Perplexity API key. If you don't have one, please sign up and get the API key in [Perplexity](https://docs.perplexity.ai/)

#### PERPLEXITY.model

Default: `sonar`

You can use any Perplexity model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:
- `sonar` (default), `sonar-pro` (main series)
- `llama-3.1-sonar-small-128k-online`, `llama-3.1-sonar-large-128k-online` (online models)
- `llama-3.1-sonar-huge-128k-online` (advanced models)

For the most up-to-date list of available models, please check [Perplexity Documentation](https://docs.perplexity.ai/).

```sh
aicommit2 config set PERPLEXITY.model="sonar"
```
