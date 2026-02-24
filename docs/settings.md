# General Settings

The following settings can be applied to most models, but support may vary.
Please check the documentation for each specific model to confirm which settings are supported.

## Settings Reference

| Setting                | Description                                                         | Default      |
| ---------------------- | ------------------------------------------------------------------- | ------------ |
| `envKey`               | Custom environment variable name for the API key                    | -            |
| `systemPrompt`         | System Prompt text                                                  | -            |
| `systemPromptPath`     | Path to system prompt file                                          | -            |
| `exclude`              | Files to exclude from AI analysis                                   | -            |
| `type`                 | Type of commit message to generate                                  | conventional |
| `locale`               | Locale for the generated commit messages                            | en           |
| `generate`             | Number of commit messages to generate                               | 1            |
| `logging`              | Enable logging                                                      | true         |
| `includeBody`          | Whether the commit message includes body                            | false        |
| `maxLength`            | Maximum character length of the Subject of generated commit message | 50           |
| `disableLowerCase`     | Disable automatic lowercase conversion of commit messages           | false        |
| `timeout`              | Request timeout (milliseconds)                                      | 10000        |
| `temperature`          | Model's creativity (0.0 - 2.0)                                      | 0.7          |
| `maxTokens`            | Maximum number of tokens to generate                                | 1024         |
| `topP`                 | Nucleus sampling                                                    | 0.9          |
| `codeReview`           | Whether to include an automated code review in the process          | false        |
| `codeReviewPromptPath` | Path to code review prompt file                                     | -            |
| `disabled`             | Whether a specific model is enabled or disabled                     | false        |

> **Tip:** To set the General Settings for each model, use the following command.
>
> ```bash
> aicommit2 config set OPENAI.locale="jp"
> aicommit2 config set CODESTRAL.type="gitmoji"
> aicommit2 config set GEMINI.includeBody=true
> ```

## Detailed Settings

### envKey

- Allows users to specify a custom environment variable name for their API key.
- If `envKey` is not explicitly set, the system defaults to using an environment variable named after the service, followed by `_API_KEY` (e.g., `OPENAI_API_KEY` for OpenAI, `GEMINI_API_KEY` for Gemini).
- This setting provides flexibility for managing API keys, especially when multiple services are used or when specific naming conventions are required.

```bash
aicommit2 config set OPENAI.envKey="MY_CUSTOM_OPENAI_KEY"
```

> `envKey` is used to retrieve the API key from your system's environment variables. Ensure the specified environment variable is set with your API key.

### systemPrompt

- Allow users to specify a custom system prompt

```bash
aicommit2 config set systemPrompt="Generate git commit message."
```

> `systemPrompt` takes precedence over `systemPromptPath` and does not apply at the same time.

### systemPromptPath

- Allow users to specify a custom file path for their own system prompt template
- Please see [Custom Prompt Template](../README.md#custom-prompt-template)
- **Note**: Paths can be absolute or relative to the configuration file location.

```bash
aicommit2 config set systemPromptPath="/path/to/user/prompt.txt"
```

### exclude

- Files to exclude from AI analysis
- It is applied with the `--exclude` option of the CLI option. All files excluded through `--exclude` in CLI and `exclude` general setting.

```bash
aicommit2 config set exclude="*.ts"
aicommit2 config set exclude="*.ts,*.json"
```

> NOTE: `exclude` option does not support per model. It is **only** supported by General Settings.

### forceGit

Default: `false`

Force Git detection even in Jujutsu repositories (useful when you have both `.jj` and `.git` directories):

```bash
aicommit2 config set forceGit=true
```

This is equivalent to using the `FORCE_GIT=true` environment variable, but persistent across sessions.

### type

Default: `conventional`

Supported: `conventional`, `gitmoji`

The type of commit message to generate:

**Conventional Commits**: Follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```bash
aicommit2 config set type="conventional"
```

**Gitmoji**: Use [Gitmoji](https://gitmoji.dev/) emojis in commit messages:

```bash
aicommit2 config set type="gitmoji"
```

### locale

Default: `en`

The locale to use for the generated commit messages. Consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639_language_codes.

```bash
aicommit2 config set locale="jp"
```

### generate

Default: `1`

The number of commit messages to generate to pick from.

Note, this will use more tokens as it generates more results.

```bash
aicommit2 config set generate=2
```

### logging

Default: `true`

This boolean option controls whether the application generates log files. When enabled, both the general application logs and the AI request/response logs are written to their respective paths. For a detailed explanation of all logging settings, including how to enable/disable logging and manage log files, please refer to the main [Logging](../README.md#logging) section.

- **Log File Example**:
  ![log-path](https://github.com/tak-bro/aicommit2/blob/main/img/log_path.png?raw=true)

### includeBody

Default: `false`

This option determines whether the commit message includes body. If you want to include body in message, you can set it to `true`.

```bash
aicommit2 config set includeBody="true"
```

![ignore_body_false](https://github.com/tak-bro/aicommit2/blob/main/img/demo_body_min.gif?raw=true)

```bash
aicommit2 config set includeBody="false"
```

![ignore_body_true](https://github.com/tak-bro/aicommit2/blob/main/img/ignore_body_true.png?raw=true)

### maxLength

The maximum character length of the Subject of generated commit message

Default: `50`

```bash
aicommit2 config set maxLength=100
```

### disableLowerCase

Disable automatic lowercase conversion of commit messages

Default: `false`

By default, AICommit2 converts the first character of commit types and descriptions to lowercase to follow conventional commit standards. Set this to `true` to preserve the original casing.

```bash
aicommit2 config set disableLowerCase=true
```

You can also use the CLI flag:

```bash
aicommit2 --disable-lowercase
```

### timeout

The timeout for network requests in milliseconds.

Default: `10_000` (10 seconds)

```bash
aicommit2 config set timeout=20000 # 20s
```

> **Note**: Each AI provider has its own default timeout value, and if the configured timeout is less than the provider's default, the setting will be ignored.

### temperature

The temperature (0.0-2.0) is used to control the randomness of the output

Default: `0.7`

```bash
aicommit2 config set temperature=0.3
```

### maxTokens

The maximum number of tokens that the AI models can generate.

Default: `1024`

```bash
aicommit2 config set maxTokens=3000
```

### topP

Default: `0.9`

Nucleus sampling, where the model considers the results of the tokens with top_p probability mass.

> **Note**: Claude 4.x models do not support using `temperature` and `top_p` simultaneously. For these models, `top_p` is automatically excluded.

```bash
aicommit2 config set topP=0.2
```

### disabled

Default: `false`

This option determines whether a specific model is enabled or disabled. If you want to disable a particular model, you can set this option to `true`.

To disable a model, use the following commands:

```bash
aicommit2 config set GEMINI.disabled="true"
aicommit2 config set GROQ.disabled="true"
```

### codeReview

Default: `false`

The `codeReview` parameter determines whether to include an automated code review in the process.

```bash
aicommit2 config set codeReview=true
```

> NOTE: When enabled, aicommit2 will perform a code review before generating commit messages.

<img src="https://github.com/tak-bro/aicommit2/blob/main/img/code_review.gif?raw=true" alt="CODE_REVIEW" />

**CAUTION**

- The `codeReview` feature is currently experimental.
- This feature performs a code review before generating commit messages.
- Using this feature will significantly increase the overall processing time.
- It may significantly impact performance and cost.
- **The code review process consumes a large number of tokens.**

### codeReviewPromptPath

- Allow users to specify a custom file path for code review
- **Note**: Paths can be absolute or relative to the configuration file location.

```bash
aicommit2 config set codeReviewPromptPath="/path/to/user/prompt.txt"
```

## Available Settings by Model

|                           | timeout | temperature | maxTokens | topP |
| :-----------------------: | :-----: | :---------: | :-------: | :--: |
|        **OpenAI**         |    ✓    |      ✓      |     ✓     |  ✓   |
|   **Anthropic Claude**    |    ✓    |      ✓      |     ✓     |  ✓   |
|        **Gemini**         |         |      ✓      |     ✓     |  ✓   |
|      **Mistral AI**       |    ✓    |      ✓      |     ✓     |  ✓   |
|       **Codestral**       |    ✓    |      ✓      |     ✓     |  ✓   |
|        **Cohere**         |    ✓    |      ✓      |     ✓     |  ✓   |
|         **Groq**          |    ✓    |      ✓      |     ✓     |  ✓   |
|      **Perplexity**       |    ✓    |      ✓      |     ✓     |  ✓   |
|       **DeepSeek**        |    ✓    |      ✓      |     ✓     |  ✓   |
|     **Github Models**     |    ✓    |      ✓      |     ✓     |  ✓   |
|        **Ollama**         |    ✓    |      ✓      |           |  ✓   |
| **OpenAI API-Compatible** |    ✓    |      ✓      |     ✓     |  ✓   |

> All AI support the following options in General Settings.
>
> - systemPrompt, systemPromptPath, codeReview, codeReviewPromptPath, exclude, type, locale, generate, logging, includeBody, maxLength, disableLowerCase
