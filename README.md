<div align="center">
  <div>
    <img src="https://github.com/tak-bro/aicommit2/blob/main/img/demo-min.gif?raw=true" alt="AICommit2"/>
    <h1 align="center">AICommit2</h1>
  </div>
  <p>
    A Reactive CLI that generates git commit messages with Ollama, ChatGPT, Gemini, Claude, Mistral and other AI
  </p>
</div>

<div align="center" markdown="1">

[![tak-bro](https://img.shields.io/badge/by-tak--bro-293462?logo=github)](https://github.com/tak-bro)
[![license](https://img.shields.io/badge/license-MIT-211A4C.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRiIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTMgNiAzIDFtMCAwLTMgOWE1IDUgMCAwIDAgNi4wMDEgME02IDdsMyA5TTYgN2w2LTJtNiAyIDMtMW0tMyAxLTMgOWE1IDUgMCAwIDAgNi4wMDEgME0xOCA3bDMgOW0tMy05LTYtMm0wLTJ2Mm0wIDE2VjVtMCAxNkg5bTMgMGgzIi8+PC9zdmc+)](https://github.com/tak-bro/aicommit2/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/aicommit2?logo=semanticrelease&label=release&color=A51C2D)](https://www.npmjs.com/package/aicommit2)
[![downloads](https://img.shields.io/npm/dt/aicommit2?color=F33535&logo=npm)](https://www.npmjs.com/package/aicommit2)

</div>

---

## 🚀 Quick Start

```bash
# Install globally
npm install -g aicommit2
# Set up at least one AI provider
aicommit2 config set OPENAI.key=<your-key>
# Use in your git repository
git add .
aicommit2
```

## 📖 Introduction

_aicommit2_ is a reactive CLI tool that automatically generates Git commit messages using various AI models. It supports simultaneous requests to multiple AI providers, allowing users to select the most suitable commit message. The core functionalities and architecture of this project are inspired by [AICommits](https://github.com/Nutlope/aicommits).

## ✨ Key Features

- **Multi-AI Support**: Integrates with OpenAI, Anthropic Claude, Google Gemini, Mistral AI, Cohere, Groq, Ollama and more.
- **OpenAI API Compatibility**: Support for any service that implements the OpenAI API specification.
- **Reactive CLI**: Enables simultaneous requests to multiple AIs and selection of the best commit message.
- **Git Hook Integration**: Can be used as a prepare-commit-msg hook.
- **Custom Prompt**: Supports user-defined system prompt templates.

## 🤖 Supported Providers

### Cloud AI Services

- [OpenAI](https://openai.com/) - Configuration
- [Anthropic Claude](https://console.anthropic.com/)
- [Gemini](https://gemini.google.com/)
- [Mistral AI](https://mistral.ai/) (including [Codestral](https://mistral.ai/news/codestral/))
- [Cohere](https://cohere.com/)
- [Groq](https://groq.com/)
- [Perplexity](https://docs.perplexity.ai/)
- [DeepSeek](https://www.deepseek.com/)
- [OpenAI API Compatibility](#openai-api-compatible-services)

### Local AI Services

- [Ollama](https://ollama.com/) 

## Setup

> ⚠️ The minimum supported version of Node.js is the v18. Check your Node.js version with `node --version`.

1. Install _aicommit2_:

```sh
npm install -g aicommit2
```

2. Set up API keys (**at least ONE key must be set**):

```sh
aicommit2 config set OPENAI.key=<your key>
aicommit2 config set ANTHROPIC.key=<your key>
# ... (similar commands for other providers)
```

3. Run _aicommit2_ with your staged files in git repository:
```shell
git add <files...>
aicommit2
```

> 👉 **Tip:** Use the `aic2` alias if `aicommit2` is too long for you.

### Alternative Installation Methods

#### From Source

```sh
git clone https://github.com/tak-bro/aicommit2.git
cd aicommit2
npm run build
npm install -g .
```

#### Via VSCode Devcontainer

Add [feature](https://github.com/kvokka/features/tree/main/src/aicommit2) to
your `devcontainer.json` file:

```json
"features": {
    "ghcr.io/kvokka/features/aicommit2:1": {}
}
```

## Using Ollama

You can also use your model for free with [Ollama](https://ollama.com/) and it is available to use both Ollama and remote providers **simultaneously**.

1. Install Ollama from [https://ollama.com](https://ollama.com/)

2. Start it with your model
```shell
ollama run llama3.2 # model you want use. ex) codellama, deepseek-coder
```

3. Set the host, model and numCtx. (The default numCtx value in Ollama is 2048. It is recommended to set it to `4096` or higher.)
```sh
aicommit2 config set OLLAMA.host=<your host>
aicommit2 config set OLLAMA.model=<your model>
aicommit2 config set OLLAMA.numCtx=4096
```

> If you want to use Ollama, you must set **OLLAMA.model**.

4. Run _aicommit2_ with your staged in git repository
```shell
git add <files...>
aicommit2
```

> 👉 **Tip:** Ollama can run LLMs **in parallel** from v0.1.33. Please see [this section](#loading-multiple-ollama-models).

## How it works

This CLI tool runs `git diff` to grab all your latest code changes, sends them to configured AI, then returns the AI generated commit message.

> If the diff becomes too large, AI will not function properly. If you encounter an error saying the message is too long or it's not a valid commit message, **try reducing the commit unit**.

## Usage

### CLI mode

You can call `aicommit2` directly to generate a commit message for your staged changes:

```sh
git add <files...>
aicommit2
```

`aicommit2` passes down unknown flags to `git commit`, so you can pass in [`commit` flags](https://git-scm.com/docs/git-commit).

For example, you can stage all changes in tracked files with as you commit:

```sh
aicommit2 --all # or -a
```

#### CLI Options

- `--locale` or `-l`: Locale to use for the generated commit messages (default: **en**)
- `--all` or `-a`: Automatically stage changes in tracked files for the commit (default: **false**)
- `--type` or `-t`: Git commit message format (default: **conventional**). It supports [`conventional`](https://conventionalcommits.org/) and [`gitmoji`](https://gitmoji.dev/)
- `--confirm` or `-y`: Skip confirmation when committing after message generation (default: **false**)
- `--clipboard` or `-c`: Copy the selected message to the clipboard (default: **false**).
  - If you give this option, **_aicommit2_ will not commit**.
- `--generate` or `-g`: Number of messages to generate (default: **1**)
  - **Warning**: This uses more tokens, meaning it costs more.
- `--exclude` or `-x`: Files to exclude from AI analysis
- `--hook-mode`: Run as a Git hook, typically used with prepare-commit-msg hook (default: **false**)
  - This mode is automatically enabled when running through the Git hook system
  - See [Git hook](#git-hook) section for more details
- `--pre-commit`: Run in [pre-commit](https://pre-commit.com/) framework mode (default: **false**)
  - This option is specifically for use with the pre-commit framework
  - See [Integration with pre-commit framework](#integration-with-pre-commit-framework) section for setup instructions
   
Example:
```sh
aicommit2 --locale "jp" --all --type "conventional" --generate 3 --clipboard --exclude "*.json" --exclude "*.ts"
```

### Git hook

You can also integrate _aicommit2_ with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. This lets you use Git like you normally would, and edit the commit message before committing.

#### Automatic Installation

In the Git repository you want to install the hook in:

```sh
aicommit2 hook install
```

#### Manual Installation

if you prefer to set up the hook manually, create or edit the `.git/hooks/prepare-commit-msg` file:

```sh
#!/bin/sh
# your-other-hook "$@"
aicommit2 --hook-mode "$@"
 ```

Make the hook executable:

```sh
chmod +x .git/hooks/prepare-commit-msg
```

#### Uninstall

In the Git repository you want to uninstall the hook from:

```sh
aicommit2 hook uninstall
```

Or manually delete the `.git/hooks/prepare-commit-msg` file.

### Configuration

#### Reading and Setting Configuration

- READ: `aicommit2 config get <key>`
- SET: `aicommit2 config set <key>=<value>`

Example:
```sh
aicommit2 config get OPENAI
aicommit2 config get GEMINI.key
aicommit2 config set OPENAI.generate=3 GEMINI.temperature=0.5
```

#### Environment Variables

You can configure API keys using environment variables. This is particularly useful for CI/CD environments or when you don't want to store keys in the configuration file.

```bash
# OpenAI
OPENAI_API_KEY="your-openai-key"
# Anthropic
ANTHROPIC_API_KEY="your-anthropic-key"
# Google
GEMINI_API_KEY="your-gemini-key"
# Mistral AI
MISTRAL_API_KEY="your-mistral-key"
CODESTRAL_API_KEY="your-codestral-key"
# Other Providers
COHERE_API_KEY="your-cohere-key"
GROQ_API_KEY="your-groq-key"
PERPLEXITY_API_KEY="your-perplexity-key"
DEEPSEEK_API_KEY="your-deepseek-key"
```

Usage Example:

```sh
OPENAI_API_KEY="your-openai-key" ANTHROPIC_API_KEY="your-anthropic-key" aicommit2
```

> **Note**: Environment variables take precedence over configuration file settings. 

#### How to Configure in detail

1. Command-line arguments: **use the format** `--[Model].[Key]=value`
```sh
aicommit2 --OPENAI.locale="jp" --GEMINI.temperatue="0.5"
```

2. Configuration file: **use INI format in the `~/.aicommit2` file or use `set` command**.
   Example `~/.aicommit2`:
```ini
# General Settings
logging=true
generate=2
temperature=1.0

# Model-Specific Settings
[OPENAI]
key="<your-api-key>"
temperature=0.8
generate=1
systemPromptPath="<your-prompt-path>"

[GEMINI]
key="<your-api-key>"
generate=5
includeBody=true

[OLLAMA]
temperature=0.7
model[]=llama3.2
model[]=codestral
```

> The priority of settings is: **Command-line Arguments > Environment Variables > Model-Specific Settings > General Settings > Default Values**.

## General Settings

The following settings can be applied to most models, but support may vary.
Please check the documentation for each specific model to confirm which settings are supported.

| Setting                | Description                                                         | Default      |
|------------------------|---------------------------------------------------------------------|--------------|
| `systemPrompt`         | System Prompt text                                                  | -            |
| `systemPromptPath`     | Path to system prompt file                                          | -            |
| `exclude`              | Files to exclude from AI analysis                                   | -            |
| `type`                 | Type of commit message to generate                                  | conventional |
| `locale`               | Locale for the generated commit messages                            | en           |
| `generate`             | Number of commit messages to generate                               | 1            |
| `logging`              | Enable logging                                                      | true         |
| `includeBody`          | Whether the commit message includes body                            | false        |
| `maxLength`            | Maximum character length of the Subject of generated commit message | 50           |
| `timeout`              | Request timeout (milliseconds)                                      | 10000        |
| `temperature`          | Model's creativity (0.0 - 2.0)                                      | 0.7          |
| `maxTokens`            | Maximum number of tokens to generate                                | 1024         |
| `topP`                 | Nucleus sampling                                                    | 0.9          |
| `codeReview`           | Whether to include an automated code review in the process          | false        |
| `codeReviewPromptPath` | Path to code review prompt file                                     | -            |
| `disabled`             | Whether a specific model is enabled or disabled                     | false        |

> 👉 **Tip:** To set the General Settings for each model, use the following command.
> ```shell
> aicommit2 config set OPENAI.locale="jp"
> aicommit2 config set CODESTRAL.type="gitmoji"
> aicommit2 config set GEMINI.includeBody=true
> ```

##### systemPrompt
- Allow users to specify a custom system prompt

```sh
aicommit2 config set systemPrompt="Generate git commit message."
```

> `systemPrompt` takes precedence over `systemPromptPath` and does not apply at the same time.

##### systemPromptPath
- Allow users to specify a custom file path for their own system prompt template
- Please see [Custom Prompt Template](#custom-prompt-template)

```sh
aicommit2 config set systemPromptPath="/path/to/user/prompt.txt"
```

##### exclude

- Files to exclude from AI analysis
- It is applied with the `--exclude` option of the CLI option. All files excluded through `--exclude` in CLI and `exclude` general setting.

```sh
aicommit2 config set exclude="*.ts"
aicommit2 config set exclude="*.ts,*.json"
```

> NOTE: `exclude` option does not support per model. It is **only** supported by General Settings.

##### type

Default: `conventional`

Supported: `conventional`, `gitmoji`

The type of commit message to generate. Set this to "conventional" to generate commit messages that follow the Conventional Commits specification:

```sh
aicommit2 config set type="conventional"
```

##### locale

Default: `en`

The locale to use for the generated commit messages. Consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639_language_codes.

```sh
aicommit2 config set locale="jp"
```

##### generate

Default: `1`

The number of commit messages to generate to pick from.

Note, this will use more tokens as it generates more results.

```sh
aicommit2 config set generate=2
```

##### logging

Default: `true`

Option that allows users to decide whether to generate a log file capturing the responses.
The log files will be stored in the `~/.aicommit2_log` directory(user's home).

![log-path](https://github.com/tak-bro/aicommit2/blob/main/img/log_path.png?raw=true)

- You can remove all logs below comamnd.

```sh
aicommit2 log removeAll
```

##### includeBody

Default: `false`

This option determines whether the commit message includes body. If you want to include body in message, you can set it to `true`.

```sh
aicommit2 config set includeBody="true"
```

![ignore_body_false](https://github.com/tak-bro/aicommit2/blob/main/img/demo_body_min.gif?raw=true)


```sh
aicommit2 config set includeBody="false"
```

![ignore_body_true](https://github.com/tak-bro/aicommit2/blob/main/img/ignore_body_true.png?raw=true)

##### maxLength

The maximum character length of the Subject of generated commit message

Default: `50`

```sh
aicommit2 config set maxLength=100
```

##### timeout

The timeout for network requests in milliseconds.

Default: `10_000` (10 seconds)

```sh
aicommit2 config set timeout=20000 # 20s
```

> **Note**: Each AI provider has its own default timeout value, and if the configured timeout is less than the provider's default, the setting will be ignored.

##### temperature

The temperature (0.0-2.0) is used to control the randomness of the output

Default: `0.7`

```sh
aicommit2 config set temperature=0.3
```

##### maxTokens

The maximum number of tokens that the AI models can generate.

Default: `1024`

```sh
aicommit2 config set maxTokens=3000
```

##### topP

Default: `0.9`

Nucleus sampling, where the model considers the results of the tokens with top_p probability mass.

```sh
aicommit2 config set topP=0.2
```

##### disabled

Default: `false`

This option determines whether a specific model is enabled or disabled. If you want to disable a particular model, you can set this option to `true`.

To disable a model, use the following commands:

```sh
aicommit2 config set GEMINI.disabled="true"
aicommit2 config set GROQ.disabled="true"
```

##### codeReview

Default: `false`

The `codeReview` parameter determines whether to include an automated code review in the process.

```sh
aicommit2 config set codeReview=true
```

> NOTE: When enabled, aicommit2 will perform a code review before generating commit messages.

<img src="https://github.com/tak-bro/aicommit2/blob/main/img/code_review.gif?raw=true" alt="CODE_REVIEW" />

⚠️ **CAUTION**

- The `codeReview` feature is currently experimental.
- This feature performs a code review before generating commit messages.
- Using this feature will significantly increase the overall processing time.
- It may significantly impact performance and cost.
- **The code review process consumes a large number of tokens.**

##### codeReviewPromptPath
- Allow users to specify a custom file path for code review

```sh
aicommit2 config set codeReviewPromptPath="/path/to/user/prompt.txt"
```

## Available General Settings by Model
|                             | timeout | temperature | maxTokens |  topP  |
|:---------------------------:|:-------:|:-----------:|:---------:|:------:|
|         **OpenAI**          |    ✓    |      ✓      |     ✓     |   ✓    |
|    **Anthropic Claude**     |    ✓    |      ✓      |     ✓     |   ✓    |
|         **Gemini**          |         |      ✓      |     ✓     |   ✓    |
|       **Mistral AI**        |    ✓    |      ✓      |     ✓     |   ✓    |
|        **Codestral**        |    ✓    |      ✓      |     ✓     |   ✓    |
|         **Cohere**          |    ✓    |      ✓      |     ✓     |   ✓    |
|          **Groq**           |    ✓    |      ✓      |     ✓     |   ✓    |
|       **Perplexity**        |    ✓    |      ✓      |     ✓     |   ✓    |
|        **DeepSeek**         |    ✓    |      ✓      |     ✓     |   ✓    |
|         **Ollama**          |    ✓    |      ✓      |           |   ✓    |
| **OpenAI API-Compatible**   |    ✓    |      ✓      |     ✓     |   ✓    |

> All AI support the following options in General Settings.
> - systemPrompt, systemPromptPath, codeReview, codeReviewPromptPath, exclude, type, locale, generate, logging, includeBody, maxLength

## Model-Specific Settings

> Some models mentioned below are subject to change.

### OpenAI

| Setting | Description        | Default                |
|---------|--------------------|------------------------|
| `key`   | API key            | -                      |
| `model` | Model to use       | `gpt-4o-mini`          |
| `url`   | API endpoint URL   | https://api.openai.com |
| `path`  | API path           | /v1/chat/completions   |
| `proxy` | Proxy settings     | -                      |

##### OPENAI.key

The OpenAI API key. You can retrieve it from [OpenAI API Keys page](https://platform.openai.com/account/api-keys).

```sh
aicommit2 config set OPENAI.key="your api key"
```

##### OPENAI.model

Default: `gpt-4o-mini`

The Chat Completions (`/v1/chat/completions`) model to use. Consult the list of models available in the [OpenAI Documentation](https://platform.openai.com/docs/models/model-endpoint-compatibility).

```sh
aicommit2 config set OPENAI.model=gpt-4o
```

##### OPENAI.url

Default: `https://api.openai.com`

The OpenAI URL. Both https and http protocols supported. It allows to run local OpenAI-compatible server.

```sh
aicommit2 config set OPENAI.url="<your-host>"
```

##### OPENAI.path

Default: `/v1/chat/completions`

The OpenAI Path.

##### OPENAI.topP

Default: `0.9`

The `top_p` parameter selects tokens whose combined probability meets a threshold. Please see [detail](https://platform.openai.com/docs/api-reference/chat/create#chat-create-top_p).

```sh
aicommit2 config set OPENAI.topP=0.2
```

> NOTE: If `topP` is less than 0, it does not deliver the `top_p` parameter to the request.

### Anthropic

| Setting     | Description    | Default                     |
|-------------|----------------|-----------------------------|
| `key`       | API key        | -                           |
| `model`     | Model to use   | `claude-3-5-haiku-20241022` |

##### ANTHROPIC.key

The Anthropic API key. To get started with Anthropic Claude, request access to their API at [anthropic.com/earlyaccess](https://www.anthropic.com/earlyaccess).

##### ANTHROPIC.model

Default: `claude-3-5-haiku-20241022`

Supported:
- `claude-3-7-sonnet-20250219`
- `claude-3-5-sonnet-20241022`
- `claude-3-5-haiku-20241022`
- `claude-3-opus-20240229`
- `claude-3-sonnet-20240229`
- `claude-3-haiku-20240307`

```sh
aicommit2 config set ANTHROPIC.model="claude-3-5-sonnet-20240620"
```

### Gemini

| Setting            | Description            | Default                |
|--------------------|------------------------|------------------------|
| `key`              | API key                | -                      |
| `model`            | Model to use           | `gemini-2.0-flash`     |

##### GEMINI.key

The Gemini API key. If you don't have one, create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).

```sh
aicommit2 config set GEMINI.key="your api key"
```

##### GEMINI.model

Default: `gemini-2.0-flash`

Supported:
- `gemini-2.0-flash`
- `gemini-2.0-flash-lite`
- `gemini-2.0-pro-exp-02-05`
- `gemini-2.0-flash-thinking-exp-01-21`
- `gemini-2.0-flash-exp`
- `gemini-1.5-flash`
- `gemini-1.5-flash-8b`
- `gemini-1.5-pro`

```sh
aicommit2 config set GEMINI.model="gemini-2.0-flash"
```

##### Unsupported Options

Gemini does not support the following options in General Settings.

- timeout

### Mistral

| Setting  | Description      | Default            |
|----------|------------------|--------------------|
| `key`    | API key          | -                  |
| `model`  | Model to use     | `pixtral-12b-2409` |

##### MISTRAL.key

The Mistral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/).

##### MISTRAL.model

Default: `pixtral-12b-2409`

Supported:
- `codestral-latest`
- `mistral-large-latest`
- `pixtral-large-latest`
- `ministral-8b-latest`
- `mistral-small-latest`
- `mistral-embed`
- `mistral-moderation-latest`

### Codestral

| Setting | Description      | Default            |
|---------|------------------|--------------------|
| `key`   | API key          | -                  |
| `model` | Model to use     | `codestral-latest` |

##### CODESTRAL.key

The Codestral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/codestral).

##### CODESTRAL.model

Default: `codestral-latest`

Supported:
- `codestral-latest`
- `codestral-2501`

```sh
aicommit2 config set CODESTRAL.model="codestral-2501"
```

### Cohere

| Setting            | Description  | Default     |
|--------------------|--------------|-------------|
| `key`              | API key      | -           |
| `model`            | Model to use | `command`   |

##### COHERE.key

The Cohere API key. If you don't have one, please sign up and get the API key in [Cohere Dashboard](https://dashboard.cohere.com/).

##### COHERE.model

Default: `command`

Supported models:
- `command-r7b-12-2024`
- `command-r-plus-08-2024`
- `command-r-plus-04-2024`
- `command-r-plus`
- `command-r-08-2024`
- `command-r-03-2024`
- `command-r`
- `command`
- `command-nightly`
- `command-light`
- `command-light-nightly`
- `c4ai-aya-expanse-8b`
- `c4ai-aya-expanse-32b`

```sh
aicommit2 config set COHERE.model="command-nightly"
```

### Groq

| Setting            | Description            | Default                         |
|--------------------|------------------------|---------------------------------|
| `key`              | API key                | -                               |
| `model`            | Model to use           | `deepseek-r1-distill-llama-70b` |

##### GROQ.key

The Groq API key. If you don't have one, please sign up and get the API key in [Groq Console](https://console.groq.com).

##### GROQ.model

Default: `deepseek-r1-distill-llama-70b`

Supported:
- `qwen-2.5-32b`
- `qwen-2.5-coder-32b`
- `deepseek-r1-distill-qwen-32b`
- `deepseek-r1-distill-llama-70b`
- `distil-whisper-large-v3-en`
- `gemma2-9b-it`
- `llama-3.3-70b-versatile`
- `llama-3.1-8b-instant`
- `llama-guard-3-8b`
- `llama3-70b-8192`
- `llama3-8b-8192`
- `mixtral-8x7b-32768`
- `whisper-large-v3`
- `whisper-large-v3-turbo`
- `llama-3.3-70b-specdec`
- `llama-3.2-1b-preview`
- `llama-3.2-3b-preview`
- `llama-3.2-11b-vision-preview`
- `llama-3.2-90b-vision-preview`


```sh
aicommit2 config set GROQ.model="deepseek-r1-distill-llama-70b"
```

### Perplexity

| Setting  | Description      | Default  |
|----------|------------------|----------|
| `key`    | API key          | -        |
| `model`  | Model to use     | `sonar`  |

##### PERPLEXITY.key

The Perplexity API key. If you don't have one, please sign up and get the API key in [Perplexity](https://docs.perplexity.ai/)

##### PERPLEXITY.model

Default: `sonar`

Supported:
- `sonar-pro`
- `sonar`
- `llama-3.1-sonar-small-128k-online`
- `llama-3.1-sonar-large-128k-online`
- `llama-3.1-sonar-huge-128k-online`

> The models mentioned above are subject to change.

```sh
aicommit2 config set PERPLEXITY.model="sonar-pro"
```

### DeepSeek

| Setting | Description      | Default            |
|---------|------------------|--------------------|
| `key`   | API key          | -                  |
| `model` | Model to use     | `deepseek-chat`    |

##### DEEPSEEK.key

The DeepSeek API key. If you don't have one, please sign up and subscribe in [DeepSeek Platform](https://platform.deepseek.com/).

##### DEEPSEEK.model

Default: `deepseek-chat`

Supported:
- `deepseek-chat`
- `deepseek-reasoner`

```sh
aicommit2 config set DEEPSEEK.model="deepseek-reasoner"
```

### Ollama

| Setting    | Description                                                 | Default                |
|------------|-------------------------------------------------------------|------------------------|
| `model`    | Model(s) to use (comma-separated list)                      | -                      |
| `host`     | Ollama host URL                                             | http://localhost:11434 |
| `auth`     | Authentication type                                         | Bearer                 |
| `key`      | Authentication key                                          | -                      |
| `numCtx`   | The maximum number of tokens the model can process at once  | 2048                   |

##### OLLAMA.model

The Ollama Model. Please see [a list of models available](https://ollama.com/library)

```sh
aicommit2 config set OLLAMA.model="llama3.1"
aicommit2 config set OLLAMA.model="llama3,codellama" # for multiple models

aicommit2 config add OLLAMA.model="gemma2" # Only Ollama.model can be added.
```

> OLLAMA.model is **string array** type to support multiple Ollama. Please see [this section](#loading-multiple-ollama-models).

##### OLLAMA.host

Default: `http://localhost:11434`

The Ollama host

```sh
aicommit2 config set OLLAMA.host=<host>
```

##### OLLAMA.auth

Not required. Use when your Ollama server requires authentication. Please see [this issue](https://github.com/tak-bro/aicommit2/issues/90).

```sh
aicommit2 config set OLLAMA.auth=<auth>
```

##### OLLAMA.key

Not required. Use when your Ollama server requires authentication. Please see [this issue](https://github.com/tak-bro/aicommit2/issues/90).

```sh
aicommit2 config set OLLAMA.key=<key>
```

Few examples of authentication methods:

| **Authentication Method** | **OLLAMA.auth**              | **OLLAMA.key**                        |
|---------------------------|------------------------------|---------------------------------------|
| Bearer                    | `Bearer`                     | `<API key>`                           |
| Basic                     | `Basic`                      | `<Base64 Encoded username:password>`  |
| JWT                       | `Bearer`                     | `<JWT Token>`                         |
| OAuth 2.0                 | `Bearer`                     | `<Access Token>`                      |
| HMAC-SHA256               | `HMAC`                       | `<Base64 Encoded clientId:signature>` |

##### OLLAMA.numCtx

The maximum number of tokens the model can process at once, determining its context length and memory usage.
It is recommended to set it to 4096 or higher.

```sh
aicommit2 config set OLLAMA.numCtx=4096
```

##### Unsupported Options

Ollama does not support the following options in General Settings.

- maxTokens

### OpenAI API-Compatible Services

You can configure any OpenAI API-compatible service by adding a configuration section with the `compatible=true` option. This allows you to use services that implement the OpenAI API specification.

```sh
# together
aicommit2 config set TOGETHER.compatible=true
aicommit2 config set TOGETHER.url=https://api.together.xyz
aicommit2 config set TOGETHER.path=/v1
aicommit2 config set TOGETHER.model=meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo
aicommit2 config set TOGETHER.key="your-api-key"
```

| Setting      | Description                            | Required             | Default |
|--------------|----------------------------------------|----------------------|---------|
| `compatible` | Enable OpenAI API compatibility mode   | ✓ (**must be true**) | false   |
| `url`        | Base URL of the API endpoint           | ✓                    | -       |
| `path`       | API path for chat completions          |                      | -       |
| `key`        | API key for authentication             | ✓                    | -       |
| `model`      | Model identifier to use                | ✓                    | -       |

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
```

## Watch Commit Mode

![watch-commit-gif](https://github.com/tak-bro/aicommit2/blob/main/img/watch-commit-min.gif?raw=true)

Watch Commit mode allows you to monitor Git commits in real-time and automatically perform AI code reviews using the `--watch-commit` flag.

```sh
aicommit2 --watch-commit
```

This feature only works within Git repository directories and automatically triggers whenever a commit event occurs. When a new commit is detected, it automatically:
1. Analyzes commit changes
2. Performs AI code review
3. Displays results in real-time

> For detailed configuration of the code review feature, please refer to the [codeReview](#codereview) section. The settings in that section are shared with this feature.

⚠️ **CAUTION**

- The Watch Commit feature is currently **experimental**
- This feature performs AI analysis for each commit, which **consumes a significant number of API tokens**
- API costs can increase substantially if there are many commits
- It is recommended to **carefully monitor your token usage** when using this feature
- To use this feature, you must enable watch mode for at least one AI model:
  ```sh
  aicommit2 config set [MODEL].watchMode="true"
  ```

## Upgrading

Check the installed version with:

```
aicommit2 --version
```

If it's not the [latest version](https://github.com/tak-bro/aicommit2/releases/latest), run:

```sh
npm update -g aicommit2
```

## Custom Prompt Template

_aicommit2_ supports custom prompt templates through the `systemPromptPath` option. This feature allows you to define your own prompt structure, giving you more control over the commit message generation process.

### Using the systemPromptPath Option
To use a custom prompt template, specify the path to your template file when running the tool:

```
aicommit2 config set systemPromptPath="/path/to/user/prompt.txt"
aicommit2 config set OPENAI.systemPromptPath="/path/to/another-prompt.txt"
```

For the above command, OpenAI uses the prompt in the `another-prompt.txt` file, and the rest of the model uses `prompt.txt`.

> **NOTE**: For the `systemPromptPath` option, set the **template path**, not the template content

### Template Format

Your custom template can include placeholders for various commit options.
Use curly braces `{}` to denote these placeholders for options. The following placeholders are supported:

- [{locale}](#locale): The language for the commit message (**string**)
- [{maxLength}](#max-length): The maximum length for the commit message (**number**)
- [{type}](#type): The type of the commit message (**conventional** or **gitmoji**)
- [{generate}](#generate): The number of commit messages to generate (**number**)

#### Example Template

Here's an example of how your custom template might look:

```
Generate a {type} commit message in {locale}.
The message should not exceed {maxLength} characters.
Please provide {generate} messages.

Remember to follow these guidelines:
1. Use the imperative mood
2. Be concise and clear
3. Explain the 'why' behind the change
```

#### **Appended Text**

Please note that the following text will **ALWAYS** be appended to the end of your custom prompt:

```
Lastly, Provide your response as a JSON array containing exactly {generate} object, each with the following keys:
- "subject": The main commit message using the {type} style. It should be a concise summary of the changes.
- "body": An optional detailed explanation of the changes. If not needed, use an empty string.
- "footer": An optional footer for metadata like BREAKING CHANGES. If not needed, use an empty string.
The array must always contain {generate} element, no more and no less.
Example response format:
[
  {
    "subject": "fix: fix bug in user authentication process",
    "body": "- Update login function to handle edge cases\n- Add additional error logging for debugging",
    "footer": ""
  }
]
Ensure you generate exactly {generate} commit message, even if it requires creating slightly varied versions for similar changes.
The response should be valid JSON that can be parsed without errors.
```

This ensures that the output is consistently formatted as a JSON array, regardless of the custom template used.

## Integration with pre-commit framework

If you're using the [pre-commit](https://pre-commit.com/) framework, you can add _aicommit2_ to your `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: local
    hooks:
      - id: aicommit2
        name: AI Commit Message Generator
        entry: aicommit2 --pre-commit
        language: node
        stages: [prepare-commit-msg]
        always_run: true
```

Make sure you have:

1. Installed pre-commit: `brew install pre-commit`
2. Installed aicommit2 globally: `npm install -g aicommit2`
3. Run `pre-commit install --hook-type prepare-commit-msg` to set up the hook

> **Note** : The `--pre-commit` flag is specifically designed for use with the pre-commit framework and ensures proper integration with other pre-commit hooks.

## Loading Multiple Ollama Models

<img src="https://github.com/tak-bro/aicommit2/blob/main/img/ollama_parallel.gif?raw=true" alt="OLLAMA_PARALLEL" />

You can load and make simultaneous requests to multiple models using Ollama's experimental feature, the `OLLAMA_MAX_LOADED_MODELS` option.
- `OLLAMA_MAX_LOADED_MODELS`: Load multiple models simultaneously

#### Setup Guide

Follow these steps to set up and utilize multiple models simultaneously:

##### 1. Running Ollama Server

First, launch the Ollama server with the `OLLAMA_MAX_LOADED_MODELS` environment variable set. This variable specifies the maximum number of models to be loaded simultaneously.
For example, to load up to 3 models, use the following command:

```shell
OLLAMA_MAX_LOADED_MODELS=3 ollama serve
```
> Refer to [configuration](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-do-i-configure-ollama-server) for detailed instructions.

##### 2. Configuring _aicommit2_

Next, set up _aicommit2_ to specify multiple models. You can assign a list of models, separated by **commas(`,`)**, to the OLLAMA.model environment variable. Here's how you do it:

```shell
aicommit2 config set OLLAMA.model="mistral,dolphin-llama3"
```

With this command, _aicommit2_ is instructed to utilize both the "mistral" and "dolphin-llama3" models when making requests to the Ollama server.

##### 3. Run _aicommit2_

```shell
aicommit2
```

> Note that this feature is available starting from Ollama version [**0.1.33**](https://github.com/ollama/ollama/releases/tag/v0.1.33) and _aicommit2_ version [**1.9.5**](https://www.npmjs.com/package/aicommit2/v/1.9.5).

## Disclaimer and Risks

This project uses functionalities from external APIs but is not officially affiliated with or endorsed by their providers. Users are responsible for complying with API terms, rate limits, and policies.

## Contributing

For bug fixes or feature implementations, please check the [Contribution Guide](CONTRIBUTING.md).

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/eltociear"><img src="https://avatars.githubusercontent.com/eltociear" width="100px;" alt=""/><br /><sub><b>@eltociear</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=eltociear" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/ubranch"><img src="https://avatars.githubusercontent.com/ubranch" width="100px;" alt=""/><br /><sub><b>@ubranch</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=ubranch" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/bhodrolok"><img src="https://avatars.githubusercontent.com/bhodrolok" width="100px;" alt=""/><br /><sub><b>@bhodrolok</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=bhodrolok" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/ryicoh"><img src="https://avatars.githubusercontent.com/ryicoh" width="100px;" alt=""/><br /><sub><b>@ryicoh</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=ryicoh" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/noamsto"><img src="https://avatars.githubusercontent.com/noamsto" width="100px;" alt=""/><br /><sub><b>@noamsto</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=noamsto" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/tdabasinskas"><img src="https://avatars.githubusercontent.com/tdabasinskas" width="100px;" alt=""/><br /><sub><b>@tdabasinskas</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=tdabasinskas" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/gnpaone"><img src="https://avatars.githubusercontent.com/gnpaone" width="100px;" alt=""/><br /><sub><b>@gnpaone</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=gnpaone" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/devxpain"><img src="https://avatars.githubusercontent.com/devxpain" width="100px;" alt=""/><br /><sub><b>@devxpain</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=devxpain" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/delenzhang"><img src="https://avatars.githubusercontent.com/delenzhang" width="100px;" alt=""/><br /><sub><b>@delenzhang</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=delenzhang" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/kvokka"><img src="https://avatars.githubusercontent.com/kvokka" width="100px;" alt=""/><br /><sub><b>@kvokka</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=kvokka" title="Documentation">📖</a></td>
  </tr>
</table>
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

---

If this project has been helpful, please consider giving it a Star ⭐️!

Maintainer: [@tak-bro](https://env-tak.github.io/)
