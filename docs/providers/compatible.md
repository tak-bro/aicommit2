# OpenAI API-Compatible Services

## 📌 Important Note

**Before configuring, please review:**

- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Configuration

You can configure any OpenAI API-compatible service by adding a configuration section with the `compatible=true` option. This allows you to use services that implement the OpenAI API specification.

```sh
# together
aicommit2 config set TOGETHER.compatible=true
aicommit2 config set TOGETHER.url=https://api.together.xyz
aicommit2 config set TOGETHER.path=/v1
aicommit2 config set TOGETHER.model=meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo
aicommit2 config set TOGETHER.key="your-api-key"
```

## Settings

| Setting      | Description                                      | Required             | Default |
| ------------ | ------------------------------------------------ | -------------------- | ------- |
| `compatible` | Enable OpenAI API compatibility mode             | ✓ (**must be true**) | false   |
| `url`        | Base URL of the API endpoint                     | ✓                    | -       |
| `path`       | API path for chat completions                    |                      | -       |
| `key`        | API key for authentication                       | ✓                    | -       |
| `envKey`     | Custom environment variable name for the API key |                      | -       |
| `model`      | Model identifier to use                          | ✓                    | -       |

Example configuration:

```ini
[TOGETHER]
compatible=true
key=<your-api-key>
url=https://api.together.xyz/v1
model=meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo

[GEMINI_COMPATIBILITY]
compatible=true
key=<your-api-key>
url=https://generativelanguage.googleapis.com
path=/v1beta/openai/
model=gemini-1.5-flash

[OLLAMA_COMPATIBILITY]
compatible=true
key=ollama
url=http://localhost:11434/v1
model=llama3.2

[OR_DEEPSEEK_R1]
compatible=true
url=https://openrouter.ai/api/v1
envKey=OPENROUTER_API_KEY
model=deepseek/deepseek-r1:free

[OR_QWEN3_235B_A22B]
compatible=true
url=https://openrouter.ai/api/v1
envKey=OPENROUTER_API_KEY
model=qwen/qwen3-235b-a22b:free
```
