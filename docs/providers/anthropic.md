# <a href="https://console.anthropic.com/" target="_blank">Anthropic</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set ANTHROPIC.key="your-api-key"
aicommit2 config set ANTHROPIC.model="claude-3-5-haiku-20241022"
```

### Advanced Setup

```sh
aicommit2 config set ANTHROPIC.key="your-api-key" \
    ANTHROPIC.model="claude-3-5-haiku-20241022" \
    ANTHROPIC.temperature=0.7 \
    ANTHROPIC.maxTokens=4000 \
    ANTHROPIC.locale="en" \
    ANTHROPIC.generate=3 \
    ANTHROPIC.topP=0.9
```

## Settings

| Setting | Description  | Default                     |
| ------- | ------------ | --------------------------- |
| `key`   | API key      | -                           |
| `model` | Model to use | `claude-3-5-haiku-20241022` |

## Configuration

#### ANTHROPIC.key

The Anthropic API key. To get started with Anthropic Claude, request access to their API at [anthropic.com/earlyaccess](https://www.anthropic.com/earlyaccess).

#### ANTHROPIC.model

Default: `claude-3-5-haiku-20241022`

You can use any Claude model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:
- `claude-opus-4-20250514`, `claude-sonnet-4-20250514` (Claude 4 series)
- `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022` (default) (Claude 3.5 series)
- `claude-3-opus-20240229`, `claude-3-sonnet-20240229` (Claude 3 series)
- `claude-2.1`, `claude-2.0` (Claude 2 legacy)

For the most up-to-date list of available models, please check [Anthropic Console](https://console.anthropic.com/). 

```sh
aicommit2 config set ANTHROPIC.model="claude-3-5-sonnet-20240620"
```
