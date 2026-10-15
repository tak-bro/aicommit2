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
responseFormat.type=json_object
provider.allow_fallbacks=true
provider.require_parameters=false
```

If `systemPromptPath` is relative, it is resolved from the config file directory.
For example, the snippet above expects a file like `prompts/aicommit_prompt.txt`
next to the config file.

### Basic Setup

```sh
aicommit2 config set OPENROUTER.key="your-api-key"
aicommit2 config set OPENROUTER.model="openrouter/auto"
aicommit2 config set OPENROUTER.responseFormat='{"type":"json_object"}'
aicommit2 config set OPENROUTER.provider='{"allow_fallbacks":true,"require_parameters":false}'
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
| `model` | Model slug, or `free` to race JSON-capable free models | `openrouter/auto` |
| `url`   | API endpoint URL | `https://openrouter.ai` |
| `path`  | API path         | `/api/v1/chat/completions` |
| `responseFormat` | OpenRouter `response_format` payload object | - |
| `provider` | OpenRouter routing controls payload object | - |
| `reasoning` | OpenRouter reasoning payload object | - |

## Notes

- The provider uses the OpenAI chat-completions contract behind the scenes.
- OpenRouter-specific routing headers are sent automatically.
- If you want more routing control, set `OPENROUTER.provider` directly in config.
- If you want structured output, set `OPENROUTER.responseFormat` to a JSON object.
- If you want reasoning-specific controls, set `OPENROUTER.reasoning` to a JSON object.
- `aicommit2 doctor` also checks OpenRouter catalog reachability and can suggest which `OPENROUTER.responseFormat` or `OPENROUTER.reasoning` options to revisit when the chosen model does not advertise those capabilities.

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

Or set the keyword `free` to race free models instead of calling one (see below).

```sh
aicommit2 config set OPENROUTER.model="anthropic/claude"
```

##### `model=free` (race free models, opt-in)

With `free` (case-insensitive), aicommit2:

1. Fetches the OpenRouter catalog.
2. Keeps only `:free` models that advertise `response_format` support. Guardrail/classifier models (for example `nvidia/nemotron-3.5-content-safety:free`) never return commit JSON, so they are skipped.
3. Sends the same request to 5 randomly chosen candidates in parallel.
4. Returns the first response that parses into valid JSON and shows the winning model name in the UI.

```ini
[OPENROUTER]
key=your-api-key
model=free
```

```sh
# First valid answer is auto-selected and printed, nothing is committed
aicommit2 -acds
```

Notes:

- Your staged diff is sent to every raced model (up to 5 upstream providers per commit), which is why `free` is opt-in.
- Each raced request counts against your OpenRouter free-tier daily quota; losing requests are aborted once a winner arrives, but may already have been counted.
- With [`codeReview`](../settings.md#codereview) enabled, the review request races the same way and the first non-empty review wins.
- The winning model is shown in the UI and recorded in stats; `aicommit2 doctor` reports how many candidates the catalog offers.
- Free models are rate-limited by OpenRouter; when a model answers `429` or returns non-JSON text, the race simply moves on to the others.
- Streaming is disabled in `free` mode because the winner is resolved from complete responses.
- If every candidate fails, the error lists the failure reason per model.
- If a specific model does not support `response_format`, JSON output cannot be enforced by the API and the raw model response is included in the error message to make the cause obvious.

#### OPENROUTER.url

Default: `https://openrouter.ai`

The service base URL.

```sh
aicommit2 config set OPENROUTER.url="https://openrouter.ai"
```

#### OPENROUTER.path

Default: `/api/v1/chat/completions`

The chat completions path used by the OpenAI SDK.
