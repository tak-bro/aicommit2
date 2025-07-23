# <a href="https://openai.com/" target="_blank">OpenAI</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set OPENAI.key="your-api-key"
aicommit2 config set OPENAI.model="gpt-4o"
```

### Advanced Setup

```sh
aicommit2 config set OPENAI.key="your-api-key" \
    OPENAI.model="gpt-4o" \
    OPENAI.temperature=0.7 \
    OPENAI.maxTokens=4000 \
    OPENAI.locale="en" \
    OPENAI.generate=3 \
    OPENAI.topP=0.9
```

## Settings

| Setting | Description      | Default                |
| ------- | ---------------- | ---------------------- |
| `key`   | API key          | -                      |
| `model` | Model to use     | `gpt-4o-mini`          |
| `url`   | API endpoint URL | https://api.openai.com |
| `path`  | API path         | /v1/chat/completions   |
| `proxy` | Proxy settings   | -                      |

## Configuration

#### OPENAI.key

The OpenAI API key. You can retrieve it from [OpenAI API Keys page](https://platform.openai.com/account/api-keys).

```sh
aicommit2 config set OPENAI.key="your api key"
```

#### OPENAI.model

Default: `gpt-4o-mini`

You can use any OpenAI model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Popular models include:
- `gpt-4o`, `gpt-4o-mini` (default) (GPT-4o series)
- `gpt-4-turbo`, `gpt-4` (GPT-4 series)
- `gpt-3.5-turbo` (GPT-3.5 series)

For the most up-to-date list of available models, please check [OpenAI Documentation](https://platform.openai.com/docs/models/model-endpoint-compatibility).

```sh
aicommit2 config set OPENAI.model=gpt-4o
```

#### OPENAI.url

Default: `https://api.openai.com`

The OpenAI URL. Both https and http protocols supported. It allows to run local OpenAI-compatible server.

```sh
aicommit2 config set OPENAI.url="<your-host>"
```

#### OPENAI.path

Default: `/v1/chat/completions`

The OpenAI Path.

#### OPENAI.topP

Default: `0.9`

The `top_p` parameter selects tokens whose combined probability meets a threshold. Please see [detail](https://platform.openai.com/docs/api-reference/chat/create#chat-create-top_p).

```sh
aicommit2 config set OPENAI.topP=0.2
```

> NOTE: If `topP` is less than 0, it does not deliver the `top_p` parameter to the request.
