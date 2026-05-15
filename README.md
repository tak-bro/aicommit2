<div align="center">
  <div>
    <img src="https://github.com/tak-bro/aicommit2/blob/main/img/demo-min.gif?raw=true" alt="aicommit2"/>
    <h1 align="center">aicommit2</h1>
  </div>
  <p>
    A Reactive CLI that generates commit messages for Git, YADM, and Jujutsu with Ollama, ChatGPT, Gemini, Claude, Mistral, and other AI
  </p>
</div>

<div align="center" markdown="1">

[![tak-bro](https://img.shields.io/badge/by-tak--bro-293462?logo=github)](https://github.com/tak-bro)
![license: MIT](https://img.badges.sh/license-MIT-2D2654?labelColor=5C5C5C&logo=lucide%3AScale&logoColor=ffffff&logoStrokeWidth=1.5&letterSpacing=0.5)
[![version](https://img.shields.io/npm/v/aicommit2?logo=semanticrelease&label=release&color=A51C2D)](https://www.npmjs.com/package/aicommit2)
[![downloads](https://img.shields.io/npm/dt/aicommit2?color=F33535&logo=npm)](https://www.npmjs.com/package/aicommit2)
[![Nix](https://img.shields.io/badge/Nix-5277C3?logo=nixos&logoColor=fff)](#nix-installation)
[![Homebrew](https://img.shields.io/badge/Homebrew-FBB040?logo=homebrew&logoColor=000)](https://formulae.brew.sh/formula/aicommit2)

</div>

______________________________________________________________________

## Table of Contents

- [Quick start](#quick-start)
- [Introduction](#introduction)
- [Key features](#key-features)
- [Supported providers](#supported-providers)
- [Setup](#setup)
- [How it works](#how-it-works)
- [Version Control Systems](#version-control-systems)
- [Usage](#usage)
- [Integrations](#integrations)
  - [LazyGit](#lazygit)
  - [Git Hooks](#git-hooks)
- [Configuration](#configuration)
- [General Settings](#general-settings)
- [Diff Compression](#diff-compression)
- [Logging](#logging)
- [Custom Prompt Template](#custom-prompt-template)
- [Code Review](#code-review)
- [Watch Commit Mode](#watch-commit-mode)
- [Upgrading](#upgrading)
- [Contributing](#contributing)

______________________________________________________________________

## Quick start

```bash
# Install via Homebrew (macOS/Linux)
brew install aicommit2

# Or install via npm
npm install -g aicommit2

# Set up AI providers (interactive wizard)
aicommit2 setup

# Or configure manually
aicommit2 config set OPENAI.key=<your-key>

# Use in your Git repository
git add .
aicommit2

# Also works with YADM and Jujutsu repositories (auto-detected)
yadm add <file>
aicommit2
```

## Introduction

_aicommit2_ automatically generates commit messages using AI. It supports [Git](https://git-scm.com/), [YADM](https://yadm.io/) (Yet Another Dotfiles Manager), and [Jujutsu](https://github.com/jj-vcs/jj) (jj) repositories with automatic detection. [AICommits](https://github.com/Nutlope/aicommits) inspired the core functionalities and architecture of this project.

## Key features

- **[VCS Support](#version-control-systems)**: Works with Git, YADM, and Jujutsu repositories
- **[Multi-AI Support](#cloud-ai-services)**: Integrates with OpenAI, Anthropic Claude, Google Gemini, Mistral AI, Cohere, Groq, Ollama and more
- **[OpenAI API Compatibility](docs/providers/compatible.md)**: Support for any service that implements the OpenAI API specification
- **[Reactive CLI](#usage)**: Enables simultaneous requests to multiple AIs and selection of the best commit message
- **[Code Review](#code-review)**: AI-powered structured code review with severity levels before committing
- **[Git Hook Integration](#git-hooks)**: Can be used as a prepare-commit-msg hook
- **[Custom Prompt](#custom-prompt-template)**: Supports user-defined system prompt templates
- **[Diff Compression](#diff-compression)**: Reduces token usage by 30-60% with smart diff compression

## Supported Providers

| Provider | Default Model | Documentation |
|----------|---------------|---------------|
| OpenAI | `gpt-4o-mini` | [Guide](docs/providers/openai.md) |
| Copilot SDK (Preview) | `gpt-4.1` | [Guide](docs/providers/copilot-sdk.md) |
| OpenRouter | `openrouter/auto` | [Guide](docs/providers/openrouter.md) |
| Anthropic | `claude-sonnet-4-20250514` | [Guide](docs/providers/anthropic.md) |
| Gemini | `gemini-3-flash-preview` | [Guide](docs/providers/gemini.md) |
| Mistral | `mistral-small-latest` | [Guide](docs/providers/mistral.md) |
| Codestral | `codestral-latest` | [Guide](docs/providers/mistral.md) |
| Cohere | `command-a-03-2025` | [Guide](docs/providers/cohere.md) |
| Groq | `llama-3.3-70b-versatile` | [Guide](docs/providers/groq.md) |
| Perplexity | `sonar` | [Guide](docs/providers/perplexity.md) |
| DeepSeek | `deepseek-v4-flash` | [Guide](docs/providers/deepseek.md) |
| GitHub Models | `openai/gpt-4o-mini` | [Guide](docs/providers/github-models.md) |
| Bedrock | `anthropic.claude-haiku-4-5-20251001-v1:0` | [Guide](docs/providers/bedrock.md) |
| Ollama | *(user configured)* | [Guide](docs/providers/ollama.md) |

> 📘 For OpenAI-compatible APIs, see [Compatibility Guide](docs/providers/compatible.md)
>
> 📘 GitHub note: `COPILOT_SDK` uses Copilot CLI authentication (`Copilot Requests` permission), while `GITHUB_MODELS` uses GitHub Models API tokens (`models: read`).
>
> 📘 Copilot SDK stable setup example (`config.ini` + env): [Copilot SDK Guide](docs/providers/copilot-sdk.md#recommended-configini-stable-baseline).

## Setup

1. Install _aicommit2_:

**Via Homebrew (recommended for macOS/Linux):**
```bash
brew install aicommit2
```

**Via npm:**
```bash
npm install -g aicommit2
```

> ⚠️ For npm installation, the minimum supported version of Node.js is v18. Check your Node.js version with `node --version`.

> ⚠️ Homebrew installation does not include [Copilot SDK](docs/providers/copilot-sdk.md) support due to its proprietary dependency. Use npm if you need Copilot SDK.

2. Configure your AI provider(s) (**at least ONE provider must be configured**):

**Option A: Interactive setup wizard (recommended)**
```bash
aicommit2 setup
```

> 👉 The setup wizard guides you through provider selection, API key entry, and model configuration in one step.

**Option B: Manual configuration**
```bash
aicommit2 config set OPENAI.key=<your key>
aicommit2 config set ANTHROPIC.key=<your key>
# ... (similar commands for other providers)
```

3. Run _aicommit2_ in your Git or Jujutsu repository:

```bash
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

```bash
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

```bash
nix develop github:tak-bro/aicommit2
```

After setting up with Nix, you'll still need to configure API keys as described in the [Setup](#setup) section.

#### From Source

```bash
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

### YADM Support

_aicommit2_ supports [YADM (Yet Another Dotfiles Manager)](https://yadm.io/) for managing dotfiles:

```bash
# Standard YADM workflow
yadm add <files>
aicommit2
```

**Features:**

- Automatic detection of YADM repositories (prioritized before Git)
- Uses `yadm` commands instead of `git` for all operations
- Supports all YADM features including encryption and alternate files
- Works with dotfiles in `$HOME` directory
- Hook installation: `aicommit2 hook install` (installs to `~/.config/yadm/hooks/`)
- **Note:** Watch mode (`--watch-commit`) is not supported for YADM repositories

**Installation:**

```bash
# macOS
brew install yadm

# Linux
apt-get install yadm  # Debian/Ubuntu
dnf install yadm      # Fedora

# Initialize repository
yadm init
# or clone existing dotfiles
yadm clone <url>
```

### Jujutsu Support

_aicommit2_ also supports [Jujutsu (jj)](https://github.com/jj-vcs/jj) repositories:

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
- Uses `jj describe` to set commit message (does NOT run `jj new` by default)
- Supports Jujutsu's fileset syntax for file exclusions
- Works seamlessly with colocated Git repositories

**jj new Behavior:**

By default, _aicommit2_ only runs `jj describe` to set the commit message, without creating a new changeset. This matches the workflow of many Jujutsu users who prefer to manually control when to run `jj new`.

To automatically run `jj new` after describing (mimics `jj commit` behavior):

```bash
# Via CLI flag
aicommit2 --jj-auto-new

# Or via config (persistent)
aicommit2 config set jjAutoNew=true
```

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

1. **CLI flags** (highest priority - overrides everything):
   - `--git`: Force use Git
   - `--yadm`: Force use YADM
   - `--jj`: Force use Jujutsu
2. **Environment variables**:
   - `FORCE_GIT=true`: Forces Git
   - `FORCE_YADM=true`: Forces YADM
   - `FORCE_JJ=true`: Forces Jujutsu
3. **Config**: `aicommit2 config set forceGit=true` (forces Git)
4. **Auto-detection**:
   - Jujutsu repository (checked first - since jj v0.34.0+, repos are colocated with .git)
   - Git repository (checked for .git directories - regular Git repos)
   - YADM repository (checked last - for dotfiles in $HOME without .git directory)

### Force VCS Selection

Sometimes you may want to use a specific VCS even when multiple are available:

```bash
# Use YADM in a directory that has both .git and YADM tracking
cd ~/my-project  # Has .git directory
aicommit2 --yadm  # Forces YADM usage instead of Git

# Use Git explicitly
aicommit2 --git

# Use Jujutsu explicitly
aicommit2 --jj
```

## Usage

### CLI mode

You can call `aicommit2` directly to generate a commit message for your staged changes:

```bash
git add <files...>
aicommit2
```

`aicommit2` passes down unknown flags to `git commit`, so you can pass in [`commit` flags](https://git-scm.com/docs/git-commit).

For example, you can stage all changes in tracked files as you commit:

```bash
aicommit2 --all # or -a
```

#### CLI Options

Run `aicommit2 --help` to see all available options grouped by category.

##### Message Options

- `--locale` or `-l`: Locale to use for the generated commit messages (default: **en**)
- `--generate` or `-g`: Number of messages to generate (default: **1**)
  - **Warning**: This uses more tokens, meaning it costs more.
- `--type` or `-t`: Git commit message format (default: **conventional**). It supports [`conventional`](https://conventionalcommits.org/) and [`gitmoji`](https://gitmoji.dev/)
- `--prompt` or `-p`: Custom prompt to fine-tune the AI generation
- `--include-body` or `-i`: Force include commit body in all generated messages (default: **false**)

##### Behavior

- `--all` or `-a`: Automatically stage changes in tracked files for the commit (default: **false**)
- `--confirm` or `-y`: Skip confirmation when committing after message generation (default: **false**)
- `--auto-select` or `-s`: Automatically select when only one message is generated (default: **false**)
- `--edit` or `-e`: Open the AI-generated commit message in your default editor (default: **false**)
- `--clipboard` or `-c`: Copy the selected message to clipboard and exit **without committing** (default: **false**)
- `--dry-run` or `-d`: Generate commit message without committing (default: **false**)
  - Useful for reviewing messages before manual commit (e.g., with GitHub Desktop)
- `--output` or `-o`: Output format for non-interactive mode (default: **none**)
  - Use `--output json` for [LazyGit](#lazygit) integration

##### VCS Selection

- `--git`: Force use Git (overrides auto-detection)
- `--yadm`: Force use YADM (overrides auto-detection)
- `--jj`: Force use Jujutsu (overrides auto-detection)
- `--jj-auto-new`: Run `jj new` after `jj describe` (default: **false**)

##### Hook Integration

- `--hook-mode`: Run as a Git hook with [`prepare-commit-msg`](https://git-scm.com/book/en/v2/Customizing-Git-Git-Hooks#_committing_workflow_hooks) (default: **false**)
- `--pre-commit`: Run in [pre-commit](https://pre-commit.com/) framework mode (default: **false**)

##### Formatting & Debug

- `--exclude` or `-x`: Files to exclude from AI analysis
- `--disable-lowercase`: Preserve original casing of commit messages (default: **false**)
- `--verbose` or `-v`: Enable verbose logging for debugging (default: **false**)

Examples:

```bash
# Generate multiple commit messages with clipboard and file exclusions
aicommit2 --locale "jp" --all --type "conventional" --generate 3 --clipboard --exclude "*.json" --exclude "*.ts"

# Generate and edit a commit message
aicommit2 --edit --type conventional # or gitmoji

# Generate message without committing (dry-run)
aicommit2 --dry-run # or -d

# Dry-run with clipboard (generate, select, then copy)
aicommit2 -d -c

# Enable verbose logging for debugging
aicommit2 --verbose # or -v
```

#### Commands

In addition to the main commit message generation, aicommit2 provides several utility commands:

| Command | Description |
|---------|-------------|
| `aicommit2 setup` | Interactive setup wizard for configuring AI providers |
| `aicommit2 config` | Manage configuration (get, set, list, del) |
| `aicommit2 doctor` | Check health status of AI providers |
| `aicommit2 stats` | View usage statistics and performance metrics |
| `aicommit2 hook` | Install/uninstall Git prepare-commit-msg hook |
| `aicommit2 log` | Manage log files |
| `aicommit2 github-login` | Login to GitHub for GitHub Models access |

```bash
# Interactive setup wizard
aicommit2 setup

# Configuration management
aicommit2 config set OPENAI.key=<your-key>
aicommit2 config get OPENAI
aicommit2 config list

# Health check
aicommit2 doctor

# Statistics
aicommit2 stats
aicommit2 stats -d 7    # Last 7 days
aicommit2 stats clear   # Clear all stats

# Git hook
aicommit2 hook install
aicommit2 hook uninstall
```

> GitHub Models tip: use `aicommit2 github-login` and set `GITHUB_MODELS.model` in `publisher/model` format (for example, `openai/gpt-5`).

## Integrations

### LazyGit

_aicommit2_ supports non-interactive JSON output mode for seamless integration with [LazyGit](https://github.com/jesseduffield/lazygit).

#### Setup

Use the `--output json` flag to get AI-generated commit messages in JSON Lines format:

```bash
aicommit2 --output json
# Output: {"subject":"feat: add user authentication","body":""}
# Output: {"subject":"fix: resolve login bug","body":"Fixes issue with session handling"}
```

Each line is a separate JSON object with `subject` and `body` fields, compatible with LazyGit's `menuFromCommand` prompt type.

#### LazyGit Configuration

Add the following to your LazyGit config file (`~/.config/lazygit/config.yml` or `~/Library/Application Support/lazygit/config.yml` on macOS):

```yaml
customCommands:
  # Quick commit with AI-generated subject (c in files panel)
  - key: "c"
    context: "files"
    description: "Generate commit message with aicommit2"
    prompts:
      - type: "menuFromCommand"
        title: "Select commit message"
        key: "Commit"
        command: "aicommit2 --output json"
        filter: '"subject":"(?P<subject>[^"]+)","body":"(?P<body>[^"]*)"'
        valueFormat: '{{ .subject }}<SEP>{{ .body }}'
        labelFormat: '{{ .subject }}'
    output: "terminal"
    command: bash -c 'MSG="{{ .Form.Commit }}" && SUBJ="${MSG%%<SEP>*}" && BODY="${MSG#*<SEP>}" && git commit -e -m "$SUBJ" ${BODY:+-m "$BODY"}'
```

> **Note:** This overrides LazyGit's default `c` (commit) key. You can change the key to another value (e.g., `<c-a>`) if you prefer to keep the default behavior.

#### Usage in LazyGit

1. Stage your changes in LazyGit
2. Press `c` to generate AI commit messages and select one
3. The editor opens with the selected message for final review

#### Advanced: fzf Preview with Body

For detailed commit messages with **subject + body**, use the fzf-based approach. This uses `--include-body` (`-i`) flag to generate detailed body content and shows a preview window before committing.

**Requirements:** `jq` and `fzf` must be installed (`brew install jq fzf`).

First, create the script file at `~/.config/lazygit/scripts/aicommit_fzf.sh` (or `~/Library/Application Support/lazygit/scripts/` on macOS):

```bash
#!/usr/bin/env bash
set -euo pipefail

for cmd in aicommit2 jq fzf; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required"
    exit 1
  fi
done

results_file="$(mktemp -t lazygit-aicommit-results.XXXXXX)"
trap 'rm -f "$results_file"' EXIT INT TERM

selected="$(
  echo | fzf \
    --prompt="AI commit> " \
    --header="Select a message" \
    --height=100% \
    --layout=reverse \
    --info=inline \
    --with-nth=2.. \
    --delimiter=$'\t' \
    --with-shell="bash --noprofile --norc -c" \
    --preview-window="right:60%:wrap" \
    --preview "jq -r '.[ {1} ] | \"\(.subject)\n\n\(.body)\"' $results_file" \
    --bind "load:unbind(load)+reload-sync#aicommit2 -i --output json 2>/dev/null | jq -s '.' > $results_file && jq -r 'to_entries[] | \"\\(.key)\\t\\(.value.subject)\"' $results_file#"
)" || exit 0

[ -n "$selected" ] || exit 0

index="${selected%%$'\t'*}"
subject="$(jq -r ".[$index].subject" "$results_file")"
body="$(jq -r ".[$index].body" "$results_file")"

git commit -e -m "$subject" -m "$body"
```

Make it executable: `chmod +x ~/.config/lazygit/scripts/aicommit_fzf.sh`

Then add this to your LazyGit config:

```yaml
customCommands:
  # Long commit with fzf preview (Shift+C in files panel)
  - key: "C"
    context: "files"
    description: "Generate commit message (long) with aicommit2"
    output: "terminal"
    command: "/path/to/aicommit_fzf.sh"  # Update with your script path
```

> Thanks to [@peinan](https://github.com/peinan) for this configuration! See the [original discussion](https://github.com/tak-bro/aicommit2/issues/215#issuecomment-3982049025) and dotfiles ([config.yml](https://github.com/peinan/dotfiles/blob/main/src/.config/lazygit/config.yml), [aicommit_fzf.sh](https://github.com/peinan/dotfiles/blob/main/src/.config/lazygit/scripts/aicommit_fzf.sh)) for reference.

### Git Hooks

You can integrate _aicommit2_ with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. This lets you use Git like you normally would, and edit the commit message before committing.

#### Automatic Installation

In the Git repository you want to install the hook in:

```bash
aicommit2 hook install
```

#### Manual Installation

If you prefer to set up the hook manually, create or edit the `.git/hooks/prepare-commit-msg` file:

```bash
#!/bin/sh
# your-other-hook "$@"
aicommit2 --hook-mode "$@"
```

Make the hook executable:

```bash
chmod +x .git/hooks/prepare-commit-msg
```

##### Use with a custom `core.hooksPath`

If you are using [`husky`](https://typicode.github.io/husky/) or have configured a custom [`core.hooksPath`](https://git-scm.com/docs/git-config#Documentation/git-config.txt-corehooksPath), update the corresponding hooks file instead. For Husky users, this file is `.husky/prepare-commit-message`.

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

> **Note:** The `--pre-commit` flag is specifically designed for use with the pre-commit framework and ensures proper integration with other pre-commit hooks.

#### Uninstall

In the Git repository you want to uninstall the hook from:

```bash
aicommit2 hook uninstall
```

Or manually delete the `.git/hooks/prepare-commit-msg` file.

### Health Check

Use the `doctor` command to check the status of your configured AI providers:

```bash
aicommit2 doctor
```

Example output:

```
🩺 aicommit2 Health Check

Providers:
  ✅ OPENAI         API key configured
  ✅ OLLAMA         Running (Host: http://localhost:11434)
  ⏭️ ANTHROPIC      Not configured
  ⚠️ GEMINI         API key configured

Summary: 2 healthy, 0 error, 1 warning, 1 skipped
```

Status icons:
- ✅ **Healthy**: Provider is properly configured
- ⚠️ **Warning**: Provider has issues (e.g., Ollama not running)
- ❌ **Error**: Provider configuration has errors
- ⏭️ **Skipped**: Provider is not configured

### Statistics

Use the `stats` command to view AI request statistics and performance metrics:

```bash
aicommit2 stats
```

Example output:

```
📊 aicommit2 Statistics
   Period: 3/16/2026 - 3/17/2026

Overview:
  Total requests:     144
  Success rate:       60.4%
  Avg response time:  1.3s

Provider Usage:
  Provider       Rate  Bar                    Cnt  Selected        Time
  GROQ           100%  ████████████████████    48     1  (2.1%)   732ms
  OPENAI           0%  ░░░░░░░░░░░░░░░░░░░░    46     0           514ms
  GITHUB_MODELS   96%  ███████████████████░    25     0            2.0s
  GEMINI          29%  ██████░░░░░░░░░░░░░░    14     0            2.8s
```

**Columns:**
- **Rate**: Success rate (bar color: 🟢 ≥80%, 🟡 50-79%, 🔴 <50%)
- **Cnt**: Total request count
- **Selected**: How many times you chose this provider's message

Options:
- `aicommit2 stats -d 7` - Show statistics for the last 7 days
- `aicommit2 stats clear` - Clear all statistics

Statistics are stored locally at `~/.config/aicommit2/stats.json`. Use `aicommit2 stats clear` to reset.

## Configuration

aicommit2 supports configuration via command-line arguments, environment variables, and a configuration file. Settings are resolved in the following order of precedence:

1. Command-line arguments
2. Environment variables
3. Configuration file
4. Default values

### Configuration File Location

aicommit2 follows the [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/latest/index.html) for its configuration file. The configuration file is named `config.ini` and is in INI format. It is resolved in the following order of precedence:

1. **`AICOMMIT_CONFIG_PATH` environment variable**: If this environment variable is set, its value is used as the direct path to the configuration file.
2. **`$XDG_CONFIG_HOME/aicommit2/config.ini`**: This is the primary XDG-compliant location. If `$XDG_CONFIG_HOME` is not set, it defaults to `~/.config/aicommit2/config.ini`.
3. **`~/.aicommit2`**: This is a legacy location maintained for backward compatibility.

The first existing file found in this order will be used. If no configuration file is found, aicommit2 will default to creating a new `config.ini` file in the `$XDG_CONFIG_HOME/aicommit2/` directory.

You can find the path of the currently loaded configuration file using the `config path` command:

```bash
aicommit2 config path
```

### Environment Variable Expansion in Config File

You can use environment variables in your configuration file values. Both `$VAR` and `${VAR}` syntax are supported.

Example `config.ini`:

```ini
[OPENAI]
key=$OPENAI_API_KEY
url=${CUSTOM_API_URL}/v1
```

OpenRouter example:

```ini
logging=true
generate=1
locale=ru
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

If `systemPromptPath` is relative, it is resolved relative to the config file
location.
Nested OpenRouter objects such as `responseFormat` and `provider` can be written
directly in `config.ini` using dotted keys, or set with JSON via `aicommit2 config set`.

### Reading and Setting Configuration

- READ: `aicommit2 config get [<key> [<key> ...]]`
- SET: `aicommit2 config set <key>=<value>`
- DELETE: `aicommit2 config del <config-name>`

Example:

```bash
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

### Environment Variables

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

```bash
OPENAI_API_KEY="your-openai-key" ANTHROPIC_API_KEY="your-anthropic-key" aicommit2
```

> **Note**: Environment variables take precedence over configuration file settings.

### How to Configure in detail

_aicommit2_ offers flexible configuration options for all AI services, including support for specifying multiple models. You can configure settings via command-line arguments, environment variables, or a configuration file.

1. **Command-line arguments**: Use the format `--[Model].[Key]=value`.
   To specify multiple models, use the `--[Model].model=model1,model2` format.

   ```bash
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
   model="gemini-3-flash-preview,gemini-3.1-pro-preview"

   [OLLAMA]
   temperature=0.7
   model[]=llama3.2
   model[]=codestral
   ```

> The priority of settings is: **Command-line Arguments > Environment Variables > Model-Specific Settings > General Settings > Default Values**.

### Configuration Examples

```bash
aicommit2 config set \
  generate=2 \
  topP=0.8 \
  maxTokens=1024 \
  temperature=0.7 \
  OPENAI.key="sk-..." OPENAI.model="gpt-4o-mini" OPENAI.temperature=0.5 \
  ANTHROPIC.key="sk-..." ANTHROPIC.model="claude-sonnet-4-20250514" ANTHROPIC.maxTokens=2000 \
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

## General Settings

For detailed information about all available settings, see the [General Settings documentation](docs/settings.md).

| Setting                | Description                                                         | Default      |
| ---------------------- | ------------------------------------------------------------------- | ------------ |
| `locale`               | Locale for the generated commit messages                            | en           |
| `generate`             | Number of commit messages to generate                               | 1            |
| `type`                 | Type of commit message (`conventional` / `gitmoji`)                 | conventional |
| `maxLength`            | Maximum character length of the commit subject                      | 50           |
| `timeout`              | Request timeout (milliseconds)                                      | 10000        |
| `temperature`          | Model's creativity (0.0 - 2.0)                                      | 0.7          |
| `maxTokens`            | Maximum number of tokens to generate                                | 1024         |
| `includeBody`          | Whether the commit message includes body                            | false        |
| `codeReview`           | Enable automated code review before commit                          | false        |
| `codeReviewPromptPath` | Path to custom code review prompt file                              | -            |
| `autoCopy`             | Auto-copy commit message to clipboard (commits normally)            | false        |
| `useStats`             | Enable usage statistics tracking                                    | true         |
| `statsDays`            | Days to retain statistics data (auto-cleanup)                       | 30           |
| `systemPromptPath`     | Path to custom system prompt file                                   | -            |
| `modelNameDisplay`     | Model name display in CLI labels (`none` / `short` / `full`)       | short        |
| `stream`               | **Experimental.** Enable streaming for real-time commit message generation | false        |
| `diffCompression`      | Diff compression mode (`none` / `compact`)                          | none         |
| `maxHunkLines`         | Max lines per hunk in compressed diff (0 = unlimited)               | 0            |
| `maxDiffLines`         | Max total lines in compressed diff (0 = unlimited)                  | 0            |
| `diffContext`           | Number of context lines in git diff (0-10)                          | 3            |

```bash
# Example: Set settings for a specific model
aicommit2 config set OPENAI.locale="jp"
aicommit2 config set GEMINI.temperature=0.5
aicommit2 config set ANTHROPIC.includeBody=true
```

> 👉 For all settings and detailed explanations, see [docs/settings.md](docs/settings.md)

### Available Settings by Model

|                           | timeout | temperature | maxTokens | topP | stream |
| :-----------------------: | :-----: | :---------: | :-------: | :--: | :----: |
|        **OpenAI**         |    ✓    |      ✓      |     ✓     |  ✓   |   ✓    |
|   **Anthropic Claude**    |    ✓    |      ✓      |     ✓     |  ✓   |   ✓    |
|        **Gemini**         |         |      ✓      |     ✓     |  ✓   |   ✓    |
|      **Mistral AI**       |    ✓    |      ✓      |     ✓     |  ✓   |        |
|       **Codestral**       |    ✓    |      ✓      |     ✓     |  ✓   |        |
|        **Cohere**         |    ✓    |      ✓      |     ✓     |  ✓   |        |
|         **Groq**          |    ✓    |      ✓      |     ✓     |  ✓   |   ✓    |
|      **Perplexity**       |    ✓    |      ✓      |     ✓     |  ✓   |        |
|       **DeepSeek**        |    ✓    |      ✓      |     ✓     |  ✓   |   ✓    |
|     **Github Models**     |    ✓    |      ✓      |     ✓     |  ✓   |        |
|        **Ollama**         |    ✓    |      ✓      |           |  ✓   |   ✓    |
| **OpenAI API-Compatible** |    ✓    |      ✓      |     ✓     |  ✓   |   ✓    |

## Diff Compression

aicommit2 can compress git diffs before sending to AI providers, reducing token usage by 30-60%. Inspired by [RTK](https://github.com/rtk-ai/rtk)'s token optimization techniques.

When enabled (`compact` mode), the compressor:
- Strips diff metadata headers (`diff --git`, `index`, `---/+++`)
- Minimizes context lines (keeps only lines adjacent to changes, replaces distant context with `...`)
- Caps large hunks and total diff size to protect model context windows

```bash
# Enable diff compression globally
aicommit2 config set diffCompression=compact

# Or per model — useful for models with smaller context windows
aicommit2 config set OLLAMA.diffCompression=compact
aicommit2 config set OLLAMA.maxHunkLines=100
aicommit2 config set OLLAMA.maxDiffLines=500

# Tune compression settings
aicommit2 config set maxHunkLines=200   # max lines per hunk (0=unlimited)
aicommit2 config set maxDiffLines=1000  # max total diff lines (0=unlimited)
aicommit2 config set diffContext=1      # reduce git context lines (default: 3)

# Disable compression (default)
aicommit2 config set diffCompression=none
```

## Logging

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

```bash
# List all log files with details
aicommit2 log list

# Show logs directory path
aicommit2 log path
```

#### Open Log Directory

```bash
# Open logs directory in your file manager
aicommit2 log open
```

#### Clean Up Logs

```bash
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

```bash
aicommit2 config set systemPromptPath="/path/to/user/prompt.txt"
aicommit2 config set OPENAI.systemPromptPath="/path/to/another-prompt.txt"
```

For the above command, OpenAI uses the prompt in the `another-prompt.txt` file, and the rest of the model uses `prompt.txt`.

> **NOTE**: For the `systemPromptPath` option, set the **template path**, not the template content

### Template Format

Your custom template can include placeholders for various commit options.
Use curly braces `{}` to denote these placeholders for options. The following placeholders are supported:

- `{locale}`: The language for the commit message (default: **en**)
- `{maxLength}`: The maximum length for the commit message (default: **50**)
- `{type}`: The type of the commit message (**conventional** or **gitmoji**)
- `{generate}`: The number of commit messages to generate (default: **1**)

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

## Code Review

aicommit2 includes an AI-powered code review feature that analyzes your staged changes before generating commit messages. When enabled, it provides structured feedback with severity levels and actionable suggestions.

### Enable Code Review

```bash
# Enable globally
aicommit2 config set codeReview=true

# Or enable for specific providers only
aicommit2 config set OPENAI.codeReview=true
aicommit2 config set ANTHROPIC.codeReview=true
```

### How It Works

When `codeReview` is enabled, the commit flow becomes:

1. **Stage changes** (`git add`)
2. **Run aicommit2** — code review runs automatically before commit message generation
3. **Review results** — AI analyzes the diff and returns structured feedback
4. **Confirm or abort** — choose to continue with the commit or fix issues first
5. **Generate commit messages** — proceeds as normal after confirmation

### Structured Review Output

Reviews are organized by severity and category:

- **Severity levels**: `critical`, `warning`, `suggestion`, `praise`
- **Categories**: `bug`, `security`, `performance`, `style`, `maintainability`, `other`

Each review item includes a title, description, file reference, and concrete suggestion for improvement. When critical issues are found, the confirmation prompt defaults to "No" to encourage fixing before committing.

### Custom Review Prompt

You can customize the code review prompt using a template file:

```bash
aicommit2 config set codeReviewPromptPath="/path/to/review-prompt.txt"
aicommit2 config set OPENAI.codeReviewPromptPath="/path/to/another-prompt.txt"
```

The template supports the same `{locale}`, `{type}`, `{generate}`, `{maxLength}` placeholders as the commit prompt.

> **NOTE**: When using a custom review prompt, the response format is plain text (not structured JSON). The structured severity/category output is only available with the default prompt.

> **WARNING**: Code review runs **in addition to** commit message generation, which means **API token usage roughly doubles** per commit. If multiple providers have `codeReview` enabled, each provider performs its own review. Monitor your token usage carefully, especially with large diffs.

## Watch Commit Mode

![watch-commit-gif](https://github.com/tak-bro/aicommit2/blob/main/img/watch-commit-min.gif?raw=true)

Watch Commit mode allows you to monitor Git commits in real-time and automatically perform AI code reviews using the `--watch-commit` flag.

```bash
aicommit2 --watch-commit
```

This feature only works within Git repository directories and automatically triggers whenever a commit event occurs. When a new commit is detected, it automatically:

1. Analyzes commit changes
2. Performs AI code review
3. Displays results in real-time

> For detailed configuration of the code review feature, please refer to the [codeReview](docs/settings.md#codereview) section. The settings in that section are shared with this feature.

⚠️ **CAUTION**

- The Watch Commit feature is currently **experimental**
- This feature performs AI analysis for each commit, which **consumes a significant number of API tokens**
- API costs can increase substantially if there are many commits
- It is recommended to **carefully monitor your token usage** when using this feature
- To use this feature, you must enable watch mode for at least one AI model:

```bash
aicommit2 config set [MODEL].watchMode="true"
```

## Upgrading

Check the installed version with:

```bash
aicommit2 --version
```

If it's not the [latest version](https://github.com/tak-bro/aicommit2/releases/latest), run:

```bash
# Via Homebrew
brew upgrade aicommit2

# Via npm
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
    <td align="center"><a href="https://github.com/forivall"><img src="https://avatars.githubusercontent.com/forivall" width="100px;" alt=""/><br /><sub><b>@forivall</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=forivall" title="Documentation">📖</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/jaytaylor"><img src="https://avatars.githubusercontent.com/jaytaylor" width="100px;" alt=""/><br /><sub><b>@jaytaylor</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=jaytaylor" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/denniswebb"><img src="https://avatars.githubusercontent.com/denniswebb" width="100px;" alt=""/><br /><sub><b>@denniswebb</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=denniswebb" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/peinan"><img src="https://avatars.githubusercontent.com/peinan" width="100px;" alt=""/><br /><sub><b>@peinan</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/issues/215" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/totoroot"><img src="https://avatars.githubusercontent.com/totoroot" width="100px;" alt=""/><br /><sub><b>@totoroot</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=totoroot" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/lawrence3699"><img src="https://avatars.githubusercontent.com/lawrence3699" width="100px;" alt=""/><br /><sub><b>@lawrence3699</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=lawrence3699" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/atlet99"><img src="https://avatars.githubusercontent.com/atlet99" width="100px;" alt=""/><br /><sub><b>@atlet99</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=atlet99" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/HoChihchou"><img src="https://avatars.githubusercontent.com/HoChihchou" width="100px;" alt=""/><br /><sub><b>@HoChihchou</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=HoChihchou" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/chenmi319"><img src="https://avatars.githubusercontent.com/chenmi319" width="100px;" alt=""/><br /><sub><b>@chenmi319</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=chenmi319" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/JiwaniZakir"><img src="https://avatars.githubusercontent.com/JiwaniZakir" width="100px;" alt=""/><br /><sub><b>@JiwaniZakir</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=JiwaniZakir" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/qistchan"><img src="https://avatars.githubusercontent.com/qistchan" width="100px;" alt=""/><br /><sub><b>@qistchan</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=qistchan" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Cassius0924"><img src="https://avatars.githubusercontent.com/Cassius0924" width="100px;" alt=""/><br /><sub><b>@Cassius0924</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=Cassius0924" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/Xyhlon"><img src="https://avatars.githubusercontent.com/Xyhlon" width="100px;" alt=""/><br /><sub><b>@Xyhlon</b></sub></a><br /><a href="https://github.com/tak-bro/aicommit2/commits?author=Xyhlon" title="Code">💻</a></td>
  </tr>
</table>
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

______________________________________________________________________

If this project has been helpful, please consider giving it a Star ⭐️!

Maintainer: [@tak-bro](https://env-tak.github.io/)
