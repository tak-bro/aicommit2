# <a href="https://www.deepseek.com/" target="_blank">Deepseek</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set DEEPSEEK.key="your-api-key"
aicommit2 config set DEEPSEEK.model="deepseek-chat"
```

### Advanced Setup

```sh
aicommit2 config set DEEPSEEK.key="your-api-key" \
    DEEPSEEK.model="deepseek-chat" \
    DEEPSEEK.temperature=0.7 \
    DEEPSEEK.maxTokens=4000 \
    DEEPSEEK.locale="en" \
    DEEPSEEK.generate=3 \
    DEEPSEEK.topP=0.9
```

## Settings

| Setting | Description  | Default         |
| ------- | ------------ | --------------- |
| `key`   | API key      | -               |
| `model` | Model to use | `deepseek-chat` |

## Configuration

#### DEEPSEEK.key

The DeepSeek API key. If you don't have one, please sign up and subscribe in [DeepSeek Platform](https://platform.deepseek.com/).

#### DEEPSEEK.model

Default: `deepseek-chat`

Supported:

- `deepseek-chat` (DeepSeek Chat - default)
- `deepseek-reasoner`

```sh
aicommit2 config set DEEPSEEK.model="deepseek-chat"
```
