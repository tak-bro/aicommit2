# <a href="https://groq.com/" target="_blank">Groq</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set GROQ.key="your-api-key"
aicommit2 config set GROQ.model="gemma2-9b-it"
```

### Advanced Setup

```sh
aicommit2 config set GROQ.key="your-api-key" \
    GROQ.model="gemma2-9b-it" \
    GROQ.temperature=0.7 \
    GROQ.maxTokens=4000 \
    GROQ.locale="en" \
    GROQ.generate=3 \
    GROQ.topP=0.9
```

## Settings

| Setting | Description  | Default                   |
| ------- | ------------ | ------------------------- |
| `key`   | API key      | -                         |
| `model` | Model to use | `llama-3.3-70b-versatile` |

## Configuration

#### GROQ.key

The Groq API key. If you don't have one, please sign up and get the API key in [Groq Console](https://console.groq.com).

#### GROQ.model

Default: `llama-3.3-70b-versatile`

Supported:

- `allam-2-7b`,
- `compound-beta`,
- `compound-beta-mini`,
- `deepseek-r1-distill-llama-70b`,
- `distil-whisper-large-v3-en`,
- `gemma2-9b-it`,
- `llama-3.1-8b-instant`,
- `llama-3.3-70b-versatile`,
- `llama-guard-3-8b`,
- `llama3-70b-8192`,
- `llama3-8b-8192`,
- `meta-llama/llama-4-maverick-17b-128e-instruct`,
- `meta-llama/llama-4-scout-17b-16e-instruct`,
- `mistral-saba-24b`,
- `playai-tts`,
- `playai-tts-arabic`,
- `qwen-qwq-32b`,
- `whisper-large-v3`,
- `whisper-large-v3-turbo`,

```sh
aicommit2 config set GROQ.model="llama-3.3-70b-versatile"
```
