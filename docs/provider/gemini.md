# Gemini

## 📌 Important Note

**Before configuring, please review:**
- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Settings

| Setting            | Description            | Default                |
|--------------------|------------------------|------------------------|
| `key`              | API key                | -                      |
| `model`            | Model to use           | `gemini-2.0-flash`     |

## Configuration

#### GEMINI.key

The Gemini API key. If you don't have one, create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).

```sh
aicommit2 config set GEMINI.key="your api key"
```

#### GEMINI.model

Default: `gemini-2.0-flash`

Supported:
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`
- `gemini-2.0-pro-exp-02-05`
- `gemini-2.0-flash-thinking-exp-01-21`
- `gemini-2.0-flash-exp`
- `gemini-1.5-flash`
- `gemini-1.5-flash-8b`
- `gemini-1.5-pro`

```sh
aicommit2 config set GEMINI.model="gemini-2.0-flash"
```

#### Unsupported Options

Gemini does not support the following options in General Settings.

- timeout
