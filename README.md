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

- **[Multi-AI Support](#cloud-ai-services)**: Integrates with OpenAI, Anthropic Claude, Google Gemini, Mistral AI, Cohere, Groq, Ollama and more.
- **[OpenAI API Compatibility](docs/providers/compatible.md)**: Support for any service that implements the OpenAI API specification.
- **[Reactive CLI](#usage)**: Enables simultaneous requests to multiple AIs and selection of the best commit message.
- **[Git Hook Integration](#git-hook)**: Can be used as a prepare-commit-msg hook.
- **[Custom Prompt](#custom-prompt-template)**: Supports user-defined system prompt templates.

## 🤖 Supported Providers

### Cloud AI Services

- [OpenAI](docs/providers/openai.md)
- [Anthropic Claude](docs/providers/anthropic.md)
- [Gemini](docs/providers/gemini.md)
- [Mistral & Codestral](docs/providers/mistral.md)
- [Cohere](docs/providers/cohere.md)
- [Groq](docs/providers/groq.md)
- [Perplexity](docs/providers/perplexity.md)
- [DeepSeek](docs/providers/deepseek.md)
- [OpenAI API Compatibility](docs/providers/compatible.md)

### Local AI Services

- [Ollama](docs/providers/ollama.md) 

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

#### Integration with pre-commit Framework

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


## Configuration Examples

```
aicommit2 config set \
  generate=2 \
  topP=0.8 \
  maxTokens=1024 \
  temperature=0.7 \
  OPENAI.key="sk-..." OPENAI.model="gpt-4o" OPENAI.temperature=0.5 \
  ANTHROPIC.key="sk-..." ANTHROPIC.model="claude-3-haiku" ANTHROPIC.maxTokens=2000 \
  MISTRAL.key="your-key" MISTRAL.model="codestral-latest"  \
  OLLAMA.model="llama3.2" OLLAMA.numCtx=4096 OLLAMA.watchMode=true
```

> 🔍 **Detailed Support Info**: Check each provider's documentation for specific limits and behaviors:
> - [OpenAI](docs/providers/openai.md)
> - [Anthropic Claude](docs/providers/anthropic.md)
> - [Gemini](docs/providers/gemini.md)
> - [Mistral & Codestral](docs/providers/mistral.md)
> - [Cohere](docs/providers/cohere.md)
> - [Groq](docs/providers/groq.md)
> - [Perplexity](docs/providers/perplexity.md)
> - [DeepSeek](docs/providers/deepseek.md)
> - [OpenAI API Compatibility](docs/providers/compatible.md)
> - [Ollama](docs/providers/ollama.md) 
 
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
