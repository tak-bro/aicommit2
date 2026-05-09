# <a href="https://www.deepseek.com/" target="_blank">Deepseek</a>

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup

```sh
aicommit2 config set DEEPSEEK.key="your-api-key"
aicommit2 config set DEEPSEEK.model="deepseek-v4-flash"
```

### Advanced Setup

```sh
aicommit2 config set DEEPSEEK.key="your-api-key" \
    DEEPSEEK.model="deepseek-v4-flash" \
    DEEPSEEK.temperature=0.7 \
    DEEPSEEK.maxTokens=4000 \
    DEEPSEEK.locale="en" \
    DEEPSEEK.generate=3 \
    DEEPSEEK.topP=0.9
```

## Settings

| Setting           | Description                                                                 | Default                 |
| ----------------- | --------------------------------------------------------------------------- | ----------------------- |
| `key`             | API key                                                                     | -                       |
| `model`           | Model to use                                                                | `deepseek-v4-flash`     |
| `thinking`        | Enable [thinking mode](https://api-docs.deepseek.com/guides/thinking_mode)  | Auto (see below)        |
| `reasoningEffort` | `high` or `max` (only when thinking is enabled)                             | `high`                  |

aicommit2 does not maintain a strict allowlist of model names; unsupported names surface as API errors from DeepSeek.

## Thinking mode

Use `DEEPSEEK.thinking` / `DEEPSEEK.reasoningEffort` in config; aicommit2 sends [`thinking`](https://api-docs.deepseek.com/guides/thinking_mode) and `reasoning_effort` in the JSON body (OpenAI-compatible), matching what the Python SDK achieves with `extra_body` + `reasoning_effort`.

When thinking is **on**, the API **ignores** `temperature`, `top_p`, `presence_penalty`, and `frequency_penalty`. aicommit2 omits `temperature` and `topP` from the request in that case so configuration matches API behavior.

### Defaults

| Model / alias                  | Default `thinking`      |
| ------------------------------ | ----------------------- |
| `deepseek-v4-flash`            | enabled                 |
| `deepseek-v4-pro`              | enabled                 |
| `deepseek-reasoner`            | enabled (legacy alias)  |
| `deepseek-r1`, `deepseek-r1-*` | enabled                 |
| `deepseek-chat`                | disabled (legacy alias) |
| Other names                    | disabled                |

Override with explicit config:

```sh
aicommit2 config set DEEPSEEK.thinking=false
aicommit2 config set DEEPSEEK.reasoningEffort=max
```

## Configuration

### DEEPSEEK.key

The DeepSeek API key. If you don't have one, please sign up and subscribe in [DeepSeek Platform](https://platform.deepseek.com/).

### DEEPSEEK.model

Default: `deepseek-v4-flash`

You can use any DeepSeek model name. The system no longer validates specific model names, allowing you to use new models as soon as they become available.

Current API models and roles (see [Models & Pricing](https://api-docs.deepseek.com/quick_start/pricing)):

- **`deepseek-v4-flash`** — Default recommendation; 1M context, up to 384K output tokens; cost-effective.
- **`deepseek-v4-pro`** — Higher capability; pricing and discounts are documented on the pricing page.
- **`deepseek-chat`** — **Legacy alias** for `deepseek-v4-flash` in **non-thinking** mode; DeepSeek has indicated these names may be deprecated later.
- **`deepseek-reasoner`** — **Legacy alias** for `deepseek-v4-flash` in **thinking** mode; same deprecation note.

> [!TIP] 
> We gently recommend using the newer model names (like `deepseek-v4-flash`) instead of the legacy `chat` and `reasoner` names. As noted in the [official pricing documentation](https://api-docs.deepseek.com/quick_start/pricing):
>
> *The model names `deepseek-chat` and `deepseek-reasoner` will be deprecated in the future. For compatibility, they correspond to the non-thinking mode and thinking mode of `deepseek-v4-flash`, respectively.*

```sh
aicommit2 config set DEEPSEEK.model="deepseek-v4-flash"
# or high-capacity model
aicommit2 config set DEEPSEEK.model="deepseek-v4-pro"
# legacy aliases (still accepted by the API for now)
aicommit2 config set DEEPSEEK.model="deepseek-chat"
aicommit2 config set DEEPSEEK.model="deepseek-reasoner"
```

#### DEEPSEEK.thinking

Optional boolean. When unset, aicommit2 picks a default from the model name (see table above).

#### DEEPSEEK.reasoningEffort

Optional: `high` or `max`. Used when thinking mode is enabled; defaults to `high` if unset.
