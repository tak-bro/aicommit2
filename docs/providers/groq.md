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

You can use any Groq model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:

- `llama-3.3-70b-versatile` (default) (Llama 3.3 series)
- `meta-llama/llama-4-maverick-17b-128e-instruct`, `meta-llama/llama-4-scout-17b-16e-instruct` (Llama 4 series)
- `deepseek-r1-distill-llama-70b`, `qwen-qwq-32b` (reasoning models)
- `mixtral-8x7b-32768`, `gemma2-9b-it` (other popular models)

For the most up-to-date list of available models, please check [Groq Console](https://console.groq.com).

```sh
aicommit2 config set GROQ.model="llama-3.3-70b-versatile"
```
