# <a href="https://cohere.com/" target="_blank">Cohere</a>

## 📌 Important Note

**Before configuring, please review:**
- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup
```sh
aicommit2 config set COHERE.key="your-api-key"
aicommit2 config set COHERE.model="command"
```

### Advanced Setup
```sh
aicommit2 config set COHERE.key="your-api-key" \
  COHERE.model="command-nightly" \
  COHERE.temperature=0.7 \
  COHERE.maxTokens=4000 \
  COHERE.locale="en" \
  COHERE.generate=3 \
  COHERE.topP=0.9
```

## Settings

| Setting            | Description  | Default     |
|--------------------|--------------|-------------|
| `key`              | API key      | -           |
| `model`            | Model to use | `command`   |

## Configuration 

#### COHERE.key

The Cohere API key. If you don't have one, please sign up and get the API key in [Cohere Dashboard](https://dashboard.cohere.com/).

#### COHERE.model

Default: `command`

Supported models:
- `command-r7b-12-2024`
- `command-r-plus-08-2024`
- `command-r-plus-04-2024`
- `command-r-plus`
- `command-r-08-2024`
- `command-r-03-2024`
- `command-r`
- `command`
- `command-nightly`
- `command-light`
- `command-light-nightly`
- `c4ai-aya-expanse-8b`
- `c4ai-aya-expanse-32b`

```sh
aicommit2 config set COHERE.model="command-nightly"
```
