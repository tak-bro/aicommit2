# <a href="https://cohere.com/" target="_blank">Cohere</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set COHERE.key="your-api-key"
aicommit2 config set COHERE.model="command-a-03-2025"
```

### Advanced Setup

```sh
aicommit2 config set COHERE.key="your-api-key" \
    COHERE.model="command-a-03-2025" \
    COHERE.temperature=0.7 \
    COHERE.maxTokens=4000 \
    COHERE.locale="en" \
    COHERE.generate=3 \
    COHERE.topP=0.9
```

## Settings

| Setting | Description  | Default             |
| ------- | ------------ |---------------------|
| `key`   | API key      | -                   |
| `model` | Model to use | `command-a-03-2025` |

## Configuration

#### COHERE.key

The Cohere API key. If you don't have one, please sign up and get the API key in [Cohere Dashboard](https://dashboard.cohere.com/).

#### COHERE.model

Default: `command-a-03-2025`

You can use any Cohere model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available. 

For the most up-to-date list of available models, please check [Cohere Dashboard](https://dashboard.cohere.com/).

```sh
aicommit2 config set COHERE.model="command-r-08-2024"
```
