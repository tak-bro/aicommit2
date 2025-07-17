# <a href="https://cohere.com/" target="_blank">Cohere</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set COHERE.key="your-api-key"
aicommit2 config set COHERE.model="command-r"
```

### Advanced Setup

```sh
aicommit2 config set COHERE.key="your-api-key" \
    COHERE.model="command-r" \
    COHERE.temperature=0.7 \
    COHERE.maxTokens=4000 \
    COHERE.locale="en" \
    COHERE.generate=3 \
    COHERE.topP=0.9
```

## Settings

| Setting | Description  | Default   |
| ------- | ------------ | --------- |
| `key`   | API key      | -         |
| `model` | Model to use | `command-r` |

## Configuration

#### COHERE.key

The Cohere API key. If you don't have one, please sign up and get the API key in [Cohere Dashboard](https://dashboard.cohere.com/).

#### COHERE.model

Default: `command-r`

Supported models:

- `command-r7b-12-2024` (Command R 7B December 2024)
- `command-r-plus-08-2024` (Command R+ August 2024)
- `command-r-plus-04-2024` (Command R+ April 2024)
- `command-r-plus` (Command R+)
- `command-r-08-2024` (Command R August 2024)
- `command-r-03-2024` (Command R March 2024)
- `command-r` (Command R - default)
- `command` (Command)
- `command-nightly` (Command Nightly)
- `command-light` (Command Light)
- `command-light-nightly` (Command Light Nightly)
- `c4ai-aya-expanse-8b` (C4AI Aya Expanse 8B)
- `c4ai-aya-expanse-32b` (C4AI Aya Expanse 32B)

```sh
aicommit2 config set COHERE.model="command-r"
```
