<div align="center">
  <div>
    <img src="https://github.com/tak-bro/aicommit2/blob/main/img/demo-min.gif?raw=true" alt="AICommit2"/>
    <h1 align="center">AICommit2</h1>
  </div>
  <p>
    A Reactive CLI that generates commit messages for Git and Jujutsu with Ollama, ChatGPT, Gemini, Claude, Mistral, and other AI
  </p>
</div>

<div align="center" markdown="1">

[![tak-bro](https://img.shields.io/badge/by-tak--bro-293462?logo=github)](https://github.com/tak-bro)
[![license](https://img.shields.io/badge/license-MIT-211A4C.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0ZGRiIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiIHN0cm9rZS13aWR0aD0iMiIgZD0ibTMgNiAzIDFtMCAwLTMgOWE1IDUgMCAwIDAgNi4wMDEgME02IDdsMyA5TTYgN2w2LTJtNiAyIDMtMW0tMyAxLTMgOWE1IDUgMCAwIDAgNi4wMDEgME0xOCA3bDMgOW0tMy05LTYtMm0wLTJ2Mm0wIDE2VjVtMCAxNkg5bTMgMGgzIi8+PC9zdmc+)](https://github.com/tak-bro/aicommit2/blob/main/LICENSE)
[![version](https://img.shields.io/npm/v/aicommit2?logo=semanticrelease&label=release&color=A51C2D)](https://www.npmjs.com/package/aicommit2)
[![downloads](https://img.shields.io/npm/dt/aicommit2?color=F33535&logo=npm)](https://www.npmjs.com/package/aicommit2)
[![Nix](https://img.shields.io/badge/Nix-5277C3?logo=nixos&logoColor=fff)](#nix-installation)

</div>

______________________________________________________________________

## 🚀 Quick Start

```bash
# Install globally
npm install -g aicommit2
# Set up at least one AI provider
aicommit2 config set OPENAI.key=<your-key>

# Use in your Git repository
git add .
aicommit2

# Also works with Jujutsu repositories (auto-detected)
aicommit2
```

## 📖 Introduction

AICommit2 automatically generates commit messages using AI. It primarily supports [Git](https://git-scm.com/) and also works with [Jujutsu](https://github.com/jj-vcs/jj)(jj) repositories. The core functionalities and architecture of this project are inspired by [AICommits](https://github.com/Nutlope/aicommits).

## ✨ Key Features

- **[VCS Support](#version-control-systems)**: Works with both Git and Jujutsu repositories
- **[Multi-AI Support](#cloud-ai-services)**: Integrates with OpenAI, Anthropic Claude, Google Gemini, Mistral AI, Cohere, Groq, Ollama and more
- **[OpenAI API Compatibility](docs/providers/compatible.md)**: Support for any service that implements the OpenAI API specification
- **[Reactive CLI](#usage)**: Enables simultaneous requests to multiple AIs and selection of the best commit message
- **[Git Hook Integration](#git-hook)**: Can be used as a prepare-commit-msg hook
- **[Custom Prompt](#custom-prompt-template)**: Supports user-defined system prompt templates

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
- [GitHub Models](docs/providers/github-models.md)
- [Amazon Bedrock](docs/providers/bedrock.md)
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

3. Run _aicommit2_ in your Git or Jujutsu repository:

```shell
# For Git repositories
git add <files...>
aicommit2

# Works with Jujutsu too (auto-detected, no staging needed)
aicommit2
```

> 👉 **Tip:** Use the `aic2` alias if `aicommit2` is too long for you.

### Alternative Installation Methods

#### Nix Installation

If you use the Nix package manager, aicommit2 can be installed directly using the provided flake:

```sh
# Install temporarily in your current shell
nix run github:tak-bro/aicommit2

# Install permanently to your profile
nix profile install github:tak-bro/aicommit2

# Use the shorter alias
nix run github:tak-bro/aic2 -- --help
```

##### Using in a Flake-based Project

Add aicommit2 to your flake inputs:

```nix
{
  # flake.nix configuration file
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    aicommit2.url = "github:tak-bro/aicommit2";
  };
  # Rest of your flake.nix file
}
```

```nix
# Somewhere where you define your packages
{pkgs, inputs, ...}:{
  environment.systemPackages = [inputs.aicommit2.packages.x86_64-linux.default];
  # Or home packages
  home.packages = [inputs.aicommit2.packages.x86_64-linux.default];
}
```

##### Development Environment

To enter a development shell with all dependencies:

```sh
nix develop github:tak-bro/aicommit2
```

After setting up with Nix, you'll still need to configure API keys as described in the [Setup](#setup) section.

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

## Version Control Systems

### Git (Primary)

```bash
# Standard Git workflow
git add <files>
aicommit2
```

- Uses `git diff --cached` for staged changes
- Supports all Git features and hooks
- Requires staging changes before commit

### Jujutsu Support

AICommit2 also supports [Jujutsu (jj)](https://github.com/martinvonz/jj) repositories:

```bash
# Automatic jj detection (no staging needed)
aicommit2

# Force Git when both .jj and .git exist (for colocated repos)
FORCE_GIT=true aicommit2
# or
aicommit2 config set forceGit=true
```

**Features:**

- Automatic detection of `.jj` repositories (prioritized over Git since jj v0.34.0+ uses colocated repos)
- Uses `jj describe` and `jj new` for commits
- Supports Jujutsu's fileset syntax for file exclusions
- Works seamlessly with colocated Git repositories

**Installation:**

```bash
# macOS
brew install jj

# Linux/Windows
cargo install jj-cli

# Initialize repository
jj init
```

### Detection Priority

1. `FORCE_GIT=true` environment variable (highest priority - forces Git)
2. Config: `aicommit2 config set forceGit=true` (forces Git)
3. Jujutsu repository (checked first - since jj v0.34.0+, repos are colocated with .git by default)
4. Git repository (fallback)

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
- `--edit` or `-e`: Open the AI-generated commit message in your default editor for modification (default: **false**)
  - Opens the message in the editor specified by `$VISUAL`, `$EDITOR`, or platform default
  - Works with both Git and Jujutsu repositories
  - Allows fine-tuning of AI-generated messages before committing
- `--generate` or `-g`: Number of messages to generate (default: **1**)
  - **Warning**: This uses more tokens, meaning it costs more.
- `--exclude` or `-x`: Files to exclude from AI analysis
- `--include-body` or `-i`: Force include commit body in all generated messages (default: **false**)
  - When enabled, all commit messages will include a detailed body section
  - Useful for providing more context in commit messages
- `--auto-select` or `-s`: Automatically select the commit message when only one AI model is configured (default: **false**)
  - When enabled and only one AI provider is configured, the generated message is automatically selected
  - Also skips the confirmation prompt for a seamless experience
  - Has no effect when multiple AI providers are configured
- `--disable-lowercase`: Disable automatic lowercase conversion of commit messages (default: **false**)
  - Preserves the original casing of commit types and descriptions
  - Useful when working with custom commit conventions that require specific casing
- `--hook-mode`: Run as a Git hook, typically used with [`prepare-commit-msg` hook](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks#_committing_workflow_hooks) hook (default: **false**)
  - This mode is automatically enabled when running through the Git hook system
  - See [Git hook](#git-hook) section for more details
- `--pre-commit`: Run in [pre-commit](https://pre-commit.com/) framework mode (default: **false**)
  - This option is specifically for use with the pre-commit framework
  - See [Integration with pre-commit framework](#integration-with-pre-commit-framework) section for setup instructions

Examples:

```sh
# Generate multiple commit messages with clipboard and file exclusions
aicommit2 --locale "jp" --all --type "conventional" --generate 3 --clipboard --exclude "*.json" --exclude "*.ts"

# Generate and edit a commit message
aicommit2 --edit --type conventional # or gitmoji
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

##### Use with a custom `core.hooksPath`

If you are using [`husky`](https://typicode.github.io/husky/)** or have configured a custom [`core.hooksPath`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corehooksPath), update the corresponding hooks file instead. For Husky users, this file is `.husky/prepare-commit-message`.

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

aicommit2 supports configuration via command-line arguments, environment variables, and a configuration file. Settings are resolved in the following order of precedence:

1. Command-line arguments
2. Environment variables
3. Configuration file
4. Default values

#### Configuration File Location

aicommit2 follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/index.html) for its configuration file. The configuration file is named `config.ini` and is in INI format. It is resolved in the following order of precedence:

1. **`AICOMMIT_CONFIG_PATH` environment variable**: If this environment variable is set, its value is used as the direct path to the configuration file.
2. **`$XDG_CONFIG_HOME/aicommit2/config.ini`**: This is the primary XDG-compliant location. If `$XDG_CONFIG_HOME` is not set, it defaults to `~/.config/aicommit2/config.ini`.
3. **`~/.aicommit2`**: This is a legacy location maintained for backward compatibility.

The first existing file found in this order will be used. If no configuration file is found, aicommit2 will default to creating a new `config.ini` file in the `$XDG_CONFIG_HOME/aicommit2/` directory.

You can find the path of the currently loaded configuration file using the `config path` command:

```sh
aicommit2 config path
```

#### Reading and Setting Configuration

- READ: `aicommit2 config get [<key> [<key> ...]]`
- SET: `aicommit2 config set <key>=<value>`
- DELETE: `aicommit2 config del <config-name>`

Example:

```sh
# Get all configurations
aicommit2 config get

# Get specific configuration
aicommit2 config get OPENAI
aicommit2 config get GEMINI.key

# Set configurations
aicommit2 config set OPENAI.generate=3 GEMINI.temperature=0.5

# Delete a configuration setting or section
aicommit2 config del OPENAI.key
aicommit2 config del GEMINI
aicommit2 config del timeout
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

> **Note**: You can customize the environment variable name used for the API key with the `envKey` configuration property for each service.

Usage Example:

```sh
OPENAI_API_KEY="your-openai-key" ANTHROPIC_API_KEY="your-anthropic-key" aicommit2
```

> **Note**: Environment variables take precedence over configuration file settings.

#### How to Configure in detail

_aicommit2_ offers flexible configuration options for all AI services, including support for specifying multiple models. You can configure settings via command-line arguments, environment variables, or a configuration file.

1. **Command-line arguments**: Use the format `--[Model].[Key]=value`.
   To specify multiple models, use the `--[Model].model=model1,model2` format.

   ```sh
   aicommit2 --OPENAI.locale="jp" --GEMINI.temperature="0.5" --OPENAI.model="gpt-4o-mini,gpt-3.5-turbo"
   ```

2. **Configuration file**: Refer to [Configuration File Location](#configuration-file-location) or use the `set` command.
   For array-like values like `model`, you can use either the `model=model1,model2` comma-separated syntax or the `model[]=` syntax for multiple entries. This applies to all AI services.

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
   model="gpt-4o-mini,gpt-3.5-turbo"
   systemPromptPath="<your-prompt-path>"

   [GEMINI]
   key="<your-api-key>"
   generate=5
   includeBody=true
   model="gemini-2.0-flash,gemini-1.5-pro"

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

> 👉 **Tip:** To set the General Settings for each model, use the following command.
>
> ```shell
> aicommit2 config set OPENAI.locale="jp"
> aicommit2 config set CODESTRAL.type="gitmoji"
> aicommit2 config set GEMINI.includeBody=true
> ```

##### envKey

- Allows users to specify a custom environment variable name for their API key.
- If `envKey` is not explicitly set, the system defaults to using an environment variable named after the service, followed by `_API_KEY` (e.g., `OPENAI_API_KEY` for OpenAI, `GEMINI_API_KEY` for Gemini).
- This setting provides flexibility for managing API keys, especially when multiple services are used or when specific naming conventions are required.

```sh
aicommit2 config set OPENAI.envKey="MY_CUSTOM_OPENAI_KEY"
```

> `envKey` is used to retrieve the API key from your system's environment variables. Ensure the specified environment variable is set with your API key.

##### systemPrompt

- Allow users to specify a custom system prompt

```sh
aicommit2 config set systemPrompt="Generate git commit message."
```

> `systemPrompt` takes precedence over `systemPromptPath` and does not apply at the same time.

##### systemPromptPath

- Allow users to specify a custom file path for their own system prompt template
- Please see [Custom Prompt Template](#custom-prompt-template)
- **Note**: Paths can be absolute or relative to the configuration file location.

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

##### forceGit

Default: `false`

Force Git detection even in Jujutsu repositories (useful when you have both `.jj` and `.git` directories):

```sh
aicommit2 config set forceGit=true
```

This is equivalent to using the `FORCE_GIT=true` environment variable, but persistent across sessions.

##### type

Default: `conventional`

Supported: `conventional`, `gitmoji`

The type of commit message to generate:

**Conventional Commits**: Follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```sh
aicommit2 config set type="conventional"
```

**Gitmoji**: Use [Gitmoji](https://gitmoji.dev/) emojis in commit messages:

```sh
aicommit2 config set type="gitmoji"
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

This boolean option controls whether the application generates log files. When enabled, both the general application logs and the AI request/response logs are written to their respective paths. For a detailed explanation of all logging settings, including how to enable/disable logging and manage log files, please refer to the main [Logging](#main-logging-section) section.

- **Log File Example**:
  ![log-path](https://github.com/tak-bro/aicommit2/blob/main/img/log_path.png?raw=true)

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

##### disableLowerCase

Disable automatic lowercase conversion of commit messages

Default: `false`

By default, AICommit2 converts the first character of commit types and descriptions to lowercase to follow conventional commit standards. Set this to `true` to preserve the original casing.

```sh
aicommit2 config set disableLowerCase=true
```

You can also use the CLI flag:

```sh
aicommit2 --disable-lowercase
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
- **Note**: Paths can be absolute or relative to the configuration file location.

```sh
aicommit2 config set codeReviewPromptPath="/path/to/user/prompt.txt"
```

## Available General Settings by Model

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

## Configuration Examples

```
aicommit2 config set \
  generate=2 \
  topP=0.8 \
  maxTokens=1024 \
  temperature=0.7 \
  OPENAI.key="sk-..." OPENAI.model="gpt-4o-mini" OPENAI.temperature=0.5 \
  ANTHROPIC.key="sk-..." ANTHROPIC.model="claude-3-5-haiku-20241022" ANTHROPIC.maxTokens=2000 \
  MISTRAL.key="your-key" MISTRAL.model="mistral-small-latest"  \
  OLLAMA.model="llama3.2" OLLAMA.numCtx=4096 OLLAMA.watchMode=true
```

> 🔍 **Detailed Support Info**: Check each provider's documentation for specific limits and behaviors:
>
> - [OpenAI](docs/providers/openai.md)
> - [Anthropic Claude](docs/providers/anthropic.md)
> - [Gemini](docs/providers/gemini.md)
> - [Mistral & Codestral](docs/providers/mistral.md)
> - [Cohere](docs/providers/cohere.md)
> - [Groq](docs/providers/groq.md)
> - [Perplexity](docs/providers/perplexity.md)
> - [DeepSeek](docs/providers/deepseek.md)
> - [GitHub Models](docs/providers/github-models.md)
> - [OpenAI API Compatibility](docs/providers/compatible.md)
> - [Ollama](docs/providers/ollama.md)

## <a id="main-logging-section"></a>Logging

The application utilizes two distinct logging systems to provide comprehensive insights into its operations:

### 1. Application Logging (Winston)

This system handles general application logs and exceptions. Its behavior can be configured through the following settings in your `config.ini` file:

- **`logLevel`**:

  - **Description**: Specifies the minimum level for logs to be recorded. Messages with a level equal to or higher than the configured `logLevel` will be captured.
  - **Default**: `info`
  - **Supported Levels**: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`

- **`logFilePath`**:

  - **Description**: Defines the path to the main application log file. This setting supports date patterns (e.g., `%DATE%`) to automatically rotate log files daily.
  - **Default**: `logs/aicommit2-%DATE%.log` (relative to the application's state directory, typically `~/.local/state/aicommit2/logs` on Linux or `~/Library/Application Support/aicommit2/logs` on macOS).

- **`exceptionLogFilePath`**:

  - **Description**: Specifies the path to a dedicated log file for recording exceptions. Similar to `logFilePath`, it supports date patterns for daily rotation.
  - **Default**: `logs/exceptions-%DATE%.log` (relative to the application's state directory, typically `~/.local/state/aicommit2/logs` on Linux or `~/Library/Application Support/aicommit2/logs` on macOS).

### 2. AI Request/Response Logging

This system is specifically designed to log the prompts and responses exchanged with AI models for review and commit generation. These logs are stored in the application's dedicated logs directory.

- **Log Location**: These logs are stored in the same base directory as the application logs, which is determined by the system's state directory (e.g., `~/.local/state/aicommit2/logs` on Linux or `~/Library/Application Support/aicommit2/logs` on macOS).
- **File Naming**: Each AI log file is uniquely named using a combination of the date (`YYYY-MM-DD_HH-MM-SS`) and a hash of the git diff content, ensuring easy identification and chronological order.

### Enable/Disable Logging

The `logging` setting controls whether log files are generated. It can be configured both globally and for individual AI services:

- **Global `logging` setting**: When set in the general configuration, it controls the overall application logging (handled by Winston) and acts as a default for AI request/response logging.
- **Service-specific `logging` setting**: You can override the global `logging` setting for a particular AI service. If `logging` is set to `false` for a specific service, AI request/response logs will not be generated for that service, regardless of the global setting.

### Log Management

_aicommit2_ generates detailed logs for debugging and tracking AI requests. You can manage these log files using the built-in log commands:

#### View Log Files

```sh
# List all log files with details
aicommit2 log list

# Show logs directory path
aicommit2 log path
```

#### Open Log Directory

```sh
# Open logs directory in your file manager
aicommit2 log open
```

#### Clean Up Logs

```sh
# Remove all log files
aicommit2 log removeAll
```

#### Log File Information

- **Location**: Logs are stored in your system's state directory (usually `~/.local/state/aicommit2/logs` on Linux/macOS)
- **Content**: Each log file contains the git diff, system prompt, AI response, and metadata
- **Naming**: Files are named with timestamp and hash for easy identification
- **Size**: File sizes are displayed in human-readable format (B, KB, MB, GB)

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
    <td align="center"><a href="https://github.com/mdeweerd"><img src="https://avatars.githubusercontent.com/mdeweerd" width="100px;" alt=""/><br /><sub><b>@mdeweerd</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=mdeweerd" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/DivitMittal"><img src="https://avatars.githubusercontent.com/DivitMittal" width="100px;" alt=""/><br /><sub><b>@DivitMittal</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=DivitMittal" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/aaccioly"><img src="https://avatars.githubusercontent.com/aaccioly" width="100px;" alt=""/><br /><sub><b>@aaccioly</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=aaccioly" title="Code">💻</a></td>
  </tr>
</table>
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

______________________________________________________________________

If this project has been helpful, please consider giving it a Star ⭐️!

Maintainer: [@tak-bro](https://env-tak.github.io/)
