# OpenAI

## Settings

| Setting | Description        | Default                |
|---------|--------------------|------------------------|
| `key`   | API key            | -                      |
| `model` | Model to use       | `gpt-4o-mini`          |
| `url`   | API endpoint URL   | https://api.openai.com |
| `path`  | API path           | /v1/chat/completions   |
| `proxy` | Proxy settings     | -                      |

## Configuration

#### OPENAI.key

The OpenAI API key. You can retrieve it from [OpenAI API Keys page](https://platform.openai.com/account/api-keys).

```sh
aicommit2 config set OPENAI.key="your api key"
```

#### OPENAI.model

Default: `gpt-4o-mini`

The Chat Completions (`/v1/chat/completions`) model to use. Consult the list of models available in the [OpenAI Documentation](https://platform.openai.com/docs/models/model-endpoint-compatibility).

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
