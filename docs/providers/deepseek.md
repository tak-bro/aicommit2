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

You can use any DeepSeek model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:

- `deepseek-chat` (default) - Standard chat model for general purpose tasks
- `deepseek-reasoner` - Reasoning model with Chain of Thought (CoT) capabilities
- `deepseek-coder`, `deepseek-coder-v2` (recommended for coding tasks)
- `deepseek-v2`, `deepseek-v2.5` (advanced models)

For the most up-to-date list of available models, please check [DeepSeek Platform](https://platform.deepseek.com/).

```sh
aicommit2 config set DEEPSEEK.model="deepseek-chat"
# or use the reasoner model for enhanced reasoning
aicommit2 config set DEEPSEEK.model="deepseek-reasoner"
```

> **Note**: The `deepseek-reasoner` model generates detailed Chain of Thought (CoT) reasoning before providing the final answer. Both the reasoning process and final response are properly handled by aicommit2.
