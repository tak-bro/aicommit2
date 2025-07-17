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

- `llama-3.3-70b-versatile` (Llama 3.3 70B Versatile - default)
- `meta-llama/llama-4-maverick-17b-128e-instruct` (Llama 4 Maverick 17B)
- `meta-llama/llama-4-scout-17b-16e-instruct` (Llama 4 Scout 17B)
- `deepseek-r1-distill-llama-70b` (DeepSeek R1 Distill Llama 70B)
- `qwen-qwq-32b` (Qwen QwQ 32B)
- `mistral-saba-24b` (Mistral Saba 24B)
- `llama3-70b-8192` (Llama 3 70B)
- `llama-3.1-8b-instant` (Llama 3.1 8B Instant)
- `llama3-8b-8192` (Llama 3 8B)
- `gemma2-9b-it` (Gemma 2 9B IT)
- `llama-guard-3-8b` (Llama Guard 3 8B)
- `allam-2-7b` (Allam 2 7B)
- `compound-beta` (Compound Beta)
- `compound-beta-mini` (Compound Beta Mini)
- `whisper-large-v3` (Whisper Large V3)
- `whisper-large-v3-turbo` (Whisper Large V3 Turbo)
- `distil-whisper-large-v3-en` (Distil Whisper Large V3 EN)
- `playai-tts` (PlayAI TTS)
- `playai-tts-arabic` (PlayAI TTS Arabic)

```sh
aicommit2 config set GROQ.model="llama-3.3-70b-versatile"
```
