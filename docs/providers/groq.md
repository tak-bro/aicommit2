# [Groq](https://groq.com/)

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

| Setting            | Description            | Default                         |
|--------------------|------------------------|---------------------------------|
| `key`              | API key                | -                               |
| `model`            | Model to use           | `deepseek-r1-distill-llama-70b` |

## Configuration

#### GROQ.key

The Groq API key. If you don't have one, please sign up and get the API key in [Groq Console](https://console.groq.com).

#### GROQ.model

Default: `deepseek-r1-distill-llama-70b`

Supported:
- `qwen-2.5-32b`
- `qwen-2.5-coder-32b`
- `deepseek-r1-distill-qwen-32b`
- `deepseek-r1-distill-llama-70b`
- `distil-whisper-large-v3-en`
- `gemma2-9b-it`
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `llama-guard-3-8b`
- `llama3-70b-8192`
- `llama3-8b-8192`
- `mixtral-8x7b-32768`
- `whisper-large-v3`
- `whisper-large-v3-turbo`
- `llama-3.3-70b-specdec`
- `llama-3.2-1b-preview`
- `llama-3.2-3b-preview`
- `llama-3.2-11b-vision-preview`
- `llama-3.2-90b-vision-preview`


```sh
aicommit2 config set GROQ.model="deepseek-r1-distill-llama-70b"
```
