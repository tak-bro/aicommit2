# <a href="https://gemini.google.com/" target="_blank">Gemini</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set GEMINI.key="your-api-key"
aicommit2 config set GEMINI.model="gemini-2.0-flash"
```

### Advanced Setup

```sh
aicommit2 config set GEMINI.key="your-api-key" \
    GEMINI.model="gemini-2.0-flash" \
    GEMINI.temperature=0.7 \
    GEMINI.maxTokens=4000 \
    GEMINI.locale="en" \
    GEMINI.generate=3 \
    GEMINI.topP=0.9
```

## Settings

| Setting | Description  | Default            |
| ------- | ------------ | ------------------ |
| `key`   | API key      | -                  |
| `model` | Model to use | `gemini-2.0-flash` |

## Configuration

#### GEMINI.key

The Gemini API key. If you don't have one, create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).

```sh
aicommit2 config set GEMINI.key="your api key"
```

#### GEMINI.model

Default: `gemini-2.0-flash`

Supported:

- `gemini-2.0-flash-exp` (Gemini 2.0 Flash Experimental)
- `gemini-2.0-flash-thinking-exp-1219` (Gemini 2.0 Flash Thinking Experimental)
- `gemini-exp-1206` (Gemini Experimental December 2024)
- `gemini-exp-1121` (Gemini Experimental November 2024)
- `gemini-2.0-flash` (Gemini 2.0 Flash - default)
- `gemini-1.5-pro` (Gemini 1.5 Pro)
- `gemini-1.5-flash` (Gemini 1.5 Flash)
- `gemini-1.5-flash-8b` (Gemini 1.5 Flash 8B)
- `gemini-1.0-pro` (Gemini 1.0 Pro)

```sh
aicommit2 config set GEMINI.model="gemini-2.0-flash"
```

#### Unsupported Options

Gemini does not support the following options in General Settings.

- timeout
