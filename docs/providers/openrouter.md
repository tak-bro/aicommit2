# <a href="https://openrouter.ai/" target="_blank">OpenRouter</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### `config.ini`

If you prefer a config file over `aicommit2 config set`, this is a good starting point:

```ini
logging=true
generate=1
locale=ru
type=conventional
maxTokens=4096
temperature=0.2

[OPENROUTER]
envKey=OPENROUTER_BASE_TOKEN
model=stepfun/step-3.5-flash:free
url=https://openrouter.ai
path=/api/v1/chat/completions
systemPromptPath=prompts/aicommit_prompt.txt
```

If `systemPromptPath` is relative, it is resolved from the config file directory.
For example, the snippet above expects a file like `prompts/aicommit_prompt.txt`
next to the config file.

### Basic Setup

```sh
aicommit2 config set OPENROUTER.key="your-api-key"
aicommit2 config set OPENROUTER.model="openrouter/auto"
```

### Specific Model

```sh
aicommit2 config set OPENROUTER.key="your-api-key" \
    OPENROUTER.model="anthropic/claude" \
    OPENROUTER.temperature=0.7 \
    OPENROUTER.maxTokens=4000 \
    OPENROUTER.locale="en" \
    OPENROUTER.generate=3 \
    OPENROUTER.topP=0.9
```

## Settings

| Setting | Description      | Default |
| ------- | ---------------- | ------- |
| `key`   | API key          | - |
| `model` | Model to use     | `openrouter/auto` |
| `url`   | API endpoint URL | `https://openrouter.ai` |
| `path`  | API path         | `/api/v1/chat/completions` |

## Notes

- The provider uses the OpenAI chat-completions contract behind the scenes.
- OpenRouter-specific routing headers are sent automatically.
- If you want provider fallback or advanced routing control, configure the model on the OpenRouter dashboard or use a model slug directly.

## Configuration

#### OPENROUTER.key

Your OpenRouter API key. You can retrieve it from the OpenRouter dashboard.

```sh
aicommit2 config set OPENROUTER.key="your api key"
```

#### OPENROUTER.model

Default: `openrouter/auto`

Use a model slug that OpenRouter exposes, such as:

- `openrouter/auto`
- `anthropic/claude`
- any other model slug listed in the OpenRouter catalog

```sh
aicommit2 config set OPENROUTER.model="anthropic/claude"
```

#### OPENROUTER.url

Default: `https://openrouter.ai`

The service base URL.

```sh
aicommit2 config set OPENROUTER.url="https://openrouter.ai"
```

#### OPENROUTER.path

Default: `/api/v1/chat/completions`

The chat completions path used by the OpenAI SDK.
