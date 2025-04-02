# Deepseek

## 📌 Important Note

**Before configuring, please review:**
- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Settings

| Setting | Description      | Default            |
|---------|------------------|--------------------|
| `key`   | API key          | -                  |
| `model` | Model to use     | `deepseek-chat`    |

## Configuration

#### DEEPSEEK.key

The DeepSeek API key. If you don't have one, please sign up and subscribe in [DeepSeek Platform](https://platform.deepseek.com/).

#### DEEPSEEK.model

Default: `deepseek-chat`

Supported:
- `deepseek-chat`
- `deepseek-reasoner`

```sh
aicommit2 config set DEEPSEEK.model="deepseek-reasoner"
```
