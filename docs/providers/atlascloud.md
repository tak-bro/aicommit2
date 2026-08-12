# Atlas Cloud

Atlas Cloud is available as a built-in OpenAI-compatible provider. The preset uses the Chat Completions endpoint at `https://api.atlascloud.ai/v1` and defaults to `qwen/qwen3.8-max`.

## Configuration

Set the API key through the environment:

```sh
export ATLASCLOUD_API_KEY="your-api-key"
aicommit2 config set ATLASCLOUD.model="qwen/qwen3.8-max"
```

Or store the provider settings in the aicommit2 config:

```sh
aicommit2 config set ATLASCLOUD.key="your-api-key" \
    ATLASCLOUD.model="qwen/qwen3.8-max"
```

The interactive setup wizard also includes the provider:

```sh
aicommit2 setup
```

## Settings

| Setting | Description                     | Default                     |
| ------- | ------------------------------- | --------------------------- |
| `key`   | API key                         | `ATLASCLOUD_API_KEY`        |
| `model` | Model identifier                | `qwen/qwen3.8-max`          |
| `url`   | API host                        | `https://api.atlascloud.ai` |
| `path`  | OpenAI-compatible API base path | `/v1`                       |

`url` and `path` remain configurable for compatible gateways or deployment-specific routing.
