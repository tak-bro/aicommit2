<div align="center">
  <div>
    <img src="https://github.com/tak-bro/aicommit2/assets/7614353/9046d4ab-5652-4f2a-99b8-e58920ddbe17" alt="AICommit2"/>
    <h1 align="center">AICommit2</h1>
  </div>
	<p>A Reactive CLI that generates git commit messages with various AI</p>
	<a aria-label="npm" href="https://www.npmjs.com/package/aicommit2">
        <img src="https://img.shields.io/npm/v/aicommit2" alt="Current version">
    </a>
    <a aria-label="license" href="https://github.com/tak-bro/aicommit2/blob/main/LICENSE">
        <img src="https://img.shields.io/github/license/tak-bro/aicommit2.svg" alt="license">
    </a>
</div>

---

## Introduction

AICommit2 streamlines interactions with various AI, enabling users to request multiple AI simultaneously and select the most suitable message without waiting for all AI responses.

## Project Base & Inspiration

The core functionalities and architecture of this project are inspired by [AI Commits](https://github.com/Nutlope/aicommits).

## Features
- **Generate Messages**: Quickly generate commit messages based on AI predictions.
- **Multiple AI Support**: Utilize various AI providers simultaneously.
- **Local Model**: Integrate with the local Ollama model for offline use.

## Supported Providers

### Remote 

- [OpenAI](https://openai.com/)
- [Anthropic Claude](https://console.anthropic.com/)
- [Gemini](https://gemini.google.com/)
- [Mistral AI](https://mistral.ai/)
- [Huggingface **(Unofficial)**](https://huggingface.co/chat/)
- [Clova X **(Unofficial)**](https://clova-x.naver.com/)

### Local 

- [Ollama](https://ollama.com/)

## Setup

> The minimum supported version of Node.js is the v18. Check your Node.js version with `node --version`.

1. Install _aicommit2_:

```sh
npm install -g aicommit2
```

2. Retrieve the API key or Cookie you intend to use:

- [OpenAI](https://platform.openai.com/account/api-keys)
- [Anthropic Claude](https://console.anthropic.com/)
- [Gemini](https://aistudio.google.com/app/apikey)
- [Mistral AI](https://console.mistral.ai/)
- [Huggingface **(Unofficial)**](https://github.com/tak-bro/aicommit2?tab=readme-ov-file#how-to-get-cookieunofficial-api)
- [Clova X **(Unofficial)**](https://github.com/tak-bro/aicommit2?tab=readme-ov-file#how-to-get-cookieunofficial-api)

> You may need to create an account and set up billing.

3. Set API keys you intend to use:

> It is not necessary to set all keys. **But at least one key must be set up.**

- OpenAI
```sh
aicommit2 config set OPENAI_KEY=<your key>
```

- Anthropic Claude
```sh
aicommit2 config set ANTHROPIC_KEY=<your key>
```

- Gemini
```sh
aicommit2 config set GEMINI_KEY=<your key>
```

- Mistral AI
```sh
aicommit2 config set MISTRAL_KEY=<your key>
```

- Huggingface Chat
```shell
# Please be cautious of Escape characters(\", \') in browser cookie string 
aicommit2 config set HUGGING_COOKIE="<your browser cookie>"
```

- Clova X
```shell
# Please be cautious of Escape characters(\", \') in browser cookie string 
aicommit2 config set CLOVAX_COOKIE="<your browser cookie>"
```

This will create a `.aicommit2` file in your home directory.

4. Run aicommits with your staged in git repository:
```shell
git add <files...>
aicommit2
```

## Using Locally

You can also use your model for free with [Ollama](https://ollama.com/).

1. Install Ollama from [https://ollama.com](https://ollama.com/)

2. Start it with your model

```shell
ollama run codellama # model you want use. ex) llama2, codellama
```

3. Set the model and host

```sh
aicommit2 config set OLLAMA_MODEL=<your model> 
aicommit2 config set OLLAMA_HOST=<host> # Optional. The default host for ollama is http://localhost:11434.
aicommit2 config set OLLAMA_TIMEOUT=<timout> # Optional. default is 100000ms (100s)
```

> If you want to use ollama, you must set **OLLAMA_MODEL**.

4. Run aicommits with your staged in git repository
```shell
git add <files...>
aicommit2
```

## How it works

This CLI tool runs `git diff` to grab all your latest code changes, sends them to configured AI, then returns the AI generated commit message.

> If the diff becomes too large, AI will not function properly. If you encounter an error saying the message is too long or it's not a valid commit message, try reducing the commit unit.

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

> 👉 **Tip:** Use the `aic2` alias if `aicommit2` is too long for you.

#### CLI Options

##### `--locale` or `-l`
- Locale to use for the generated commit messages (default: **en**)

```sh
aicommit2 --locale <s> # or -l <s>
```

##### `--generate` or `-g`
- Number of messages to generate (Warning: generating multiple costs more) (default: **1**)
- Sometimes the recommended commit message isn't the best so you want it to generate a few to pick from. You can generate multiple commit messages at once by passing in the `--generate <i>` flag, where 'i' is the number of generated messages:

```sh
aicommit2 --generate <i> # or -g <i>
```

> Warning: this uses more tokens, meaning it costs more.

##### `--all` or `-a`
- Automatically stage changes in tracked files for the commit (default: **false**)

```sh
aicommit2 --all # or -a
```

##### `--type` or `-t`
- Automatically stage changes in tracked files for the commit (default: **conventional**)
- it supports [`conventional`](https://conventionalcommits.org/) and [`gitmoji`](https://gitmoji.dev/)

```sh
aicommit2 --type conventional # or -t conventional
aicommit2 --type gitmoji # or -t gitmoji
```

##### `--confirm` or `-y`
- Skip confirmation when committing after message generation (default: **false**)

```sh
aicommit2 --confirm # or -y
```

##### `--clipboard` or `-c`
- Copy the selected message to the clipboard (default: **false**)
- This is a useful option when you don't want to commit through AICommit2.
- If you give this option, AICommit2 will not commit.

```sh
aicommit2 --clipboard # or -c
```

##### `--prompt` or `-p`
- Additional prompt to let users fine-tune provided prompt

```sh
aicommit2 --prompt <s> # or -p <s>
```

### Git hook

You can also integrate _AICommit2_ with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. This lets you use Git like you normally would, and edit the commit message before committing.

#### Install

In the Git repository you want to install the hook in:

```sh
aicommit2 hook install
```

#### Uninstall

In the Git repository you want to uninstall the hook from:

```sh
aicommit2 hook uninstall
```

#### Usage

1. Stage your files and commit:

```sh
git add <files...>
git commit # Only generates a message when it's not passed in
```

> If you ever want to write your own message instead of generating one, you can simply pass one in: `git commit -m "My message"`

2. AICommit2 will generate the commit message for you and pass it back to Git. Git will open it with the [configured editor](https://docs.github.com/en/get-started/getting-started-with-git/associating-text-editors-with-git) for you to review/edit it.

3. Save and close the editor to commit!

## Configuration

### Reading a configuration value

To retrieve a configuration option, use the command:

```sh
aicommit2 config get <key>
```

For example, to retrieve the API key, you can use:

```sh
aicommit2 config get OPENAI_KEY
```

You can also retrieve multiple configuration options at once by separating them with spaces:

```sh
aicommit2 config get OPENAI_KEY OPENAI_MODEL GEMINI_KEY 
```

### Setting a configuration value

To set a configuration option, use the command:

```sh
aicommit2 config set <key>=<value>
```

For example, to set the API key, you can use:

```sh
aicommit2 config set OPENAI_KEY=<your-api-key>
```

You can also set multiple configuration options at once by separating them with spaces, like

```sh
aicommit2 config set OPENAI_KEY=<your-api-key> generate=3 locale=en
```

## Options

| Option            | Default                                | Description                                                                                                             |
|-------------------|----------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `OPENAI_KEY`      | N/A                                    | The OpenAI API key                                                                                                      |
| `OPENAI_MODEL`    | `gpt-3.5-turbo`                        | The OpenAI Model to use                                                                                                 |
| `OPENAI_URL`      | `https://api.openai.com`               | The OpenAI URL                                                                                                          |
| `OPENAI_PATH`     | `/v1/chat/completions`                 | The OpenAI request pathname                                                                                             |
| `ANTHROPIC_KEY`   | N/A                                    | The Anthropic API key                                                                                                   |
| `ANTHROPIC_MODEL` | `claude-2.1`                           | The Anthropic Model to use                                                                                              |
| `GEMINI_KEY`      | N/A                                    | The Gemini API key                                                                                                      |
| `GEMINI_MODEL`    | `gemini-pro`                           | The Gemini Model                                                                                                        |
| `MISTRAL_KEY`     | N/A                                    | The Mistral API key                                                                                                     |
| `MISTRAL_MODEL`   | `mistral-tiny`                         | The Mistral Model to use                                                                                                |
| `HUGGING_COOKIE`  | N/A                                    | The HuggingFace Cookie string                                                                                           |
| `HUGGING_MODEL`   | `mistralai/Mixtral-8x7B-Instruct-v0.1` | The HuggingFace Model to use                                                                                            |
| `CLOVAX_COOKIE`   | N/A                                    | The Clova X Cookie string                                                                                               |
| `OLLAMA_MODEL`    | N/A                                    | The Ollama Model. It should be downloaded your local                                                                    |
| `OLLAMA_HOST`     | `http://localhost:11434`               | The Ollama Host                                                                                                         |
| `OLLAMA_TIMEOUT`  | `100000` ms                            | Request timeout for the Ollama                                                                                          |
| `OLLAMA_STREAM`   | N/A                                    | Whether to make stream requests (**experimental feature**)                                                              |
| `locale`          | `en`                                   | Locale for the generated commit messages                                                                                |
| `generate`        | `1`                                    | Number of commit messages to generate                                                                                   |
| `type`            | `conventional`                         | Type of commit message to generate                                                                                      |
| `proxy`           | N/A                                    | Set a HTTP/HTTPS proxy to use for requests(only **OpenAI**)                                                             |
| `timeout`         | `10000` ms                             | Network request timeout                                                                                                 |
| `max-length`      | `50`                                   | Maximum character length of the generated commit message                                                                |
| `max-tokens`      | `200`                                  | The maximum number of tokens that the AI models can generate (for **Open AI, Anthropic, Gemini, Mistral**)              |
| `temperature`     | `0.7`                                  | The temperature (0.0-2.0) is used to control the randomness of the output (for **Open AI, Anthropic, Gemini, Mistral**) |
| `prompt`          | N/A                                    | Additional prompt to let users fine-tune provided prompt                                                                |

> **Currently, options are set universally. However, there are plans to develop the ability to set individual options in the future.**

### Available Options by Model
|                      | locale | generate | type  | proxy |        timeout         | max-length  | max-tokens | temperature | prompt |
|:--------------------:|:------:|:--------:|:-----:|:-----:|:----------------------:|:-----------:|:----------:|:-----------:|:------:|
|      **OpenAI**      |   ✓    |    ✓     |   ✓   |   ✓   |           ✓            |      ✓      |     ✓      |      ✓      |   ✓    |
| **Anthropic Claude** |   ✓    |    ✓     |   ✓   |       |                        |      ✓      |     ✓      |      ✓      |   ✓    |
|      **Gemini**      |   ✓    |    ✓     |   ✓   |       |                        |      ✓      |     ✓      |      ✓      |   ✓    |
|    **Mistral AI**    |   ✓    |    ✓     |   ✓   |       |           ✓            |      ✓      |     ✓      |      ✓      |   ✓    |
|   **Huggingface**    |   ✓    |    ✓     |   ✓   |       |           ✓            |      ✓      |            |             |   ✓    |
|     **Clova X**      |   ✓    |    ✓     |   ✓   |       |           ✓            |      ✓      |            |             |   ✓    |
|      **Ollama**      |   ✓    |    ✓     |   ✓   |       | ✓<br/>(OLLAMA_TIMEOUT) |      ✓      |            |      ✓      |   ✓    |


### Common Options

##### locale

Default: `en`

The locale to use for the generated commit messages. Consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639_language_codes.

##### generate

Default: `1`

The number of commit messages to generate to pick from.

Note, this will use more tokens as it generates more results.

##### proxy

Set a HTTP/HTTPS proxy to use for requests.

To clear the proxy option, you can use the command (note the empty value after the equals sign):

> **Only supported within the OpenAI**

```sh
aicommit2 config set proxy=
```

##### timeout

The timeout for network requests to the OpenAI API in milliseconds.

Default: `10000` (10 seconds)

```sh
aicommit2 config set timeout=20000 # 20s
```

##### max-length

The maximum character length of the generated commit message.

Default: `50`

```sh
aicommit2 config set max-length=100
```

##### type

Default: `conventional`

Supported: `conventional`, `gitmoji`

The type of commit message to generate. Set this to "conventional" to generate commit messages that follow the Conventional Commits specification:

```sh
aicommit2 config set type=conventional
```

You can clear this option by setting it to an empty string:

```sh
aicommit2 config set type=
```

##### max-tokens
The maximum number of tokens that the AI models can generate.

Default: `200`

```sh
aicommit2 config set max-tokens=1000
```

##### temperature
The temperature (0.0-2.0) is used to control the randomness of the output

Default: `0.7`

```sh
aicommit2 config set temperature=0
```

##### prompt
Additional prompt to let users fine-tune provided prompt. Users provide extra instructions to AI and can guide how commit messages should look like.

```sh
aicommit2 config set prompt="Do not mention config changes"
```

### OPEN AI

##### OPENAI_KEY

The OpenAI API key. You can retrieve it from [OpenAI API Keys page](https://platform.openai.com/account/api-keys).

##### OPENAI_MODEL

Default: `gpt-3.5-turbo`

The Chat Completions (`/v1/chat/completions`) model to use. Consult the list of models available in the [OpenAI Documentation](https://platform.openai.com/docs/models/model-endpoint-compatibility).

> Tip: If you have access, try upgrading to [`gpt-4`](https://platform.openai.com/docs/models/gpt-4) for next-level code analysis. It can handle double the input size, but comes at a higher cost. Check out OpenAI's website to learn more.

```sh
aicommit2 config set OPENAI_MODEL=gpt-4
```

#### OPENAI_URL

Default: `https://api.openai.com`

The OpenAI URL. Both https and http protocols supported. It allows to run local OpenAI-compatible server.

#### OPENAI_PATH

Default: `/v1/chat/completions`

The OpenAI Path.


### Anthropic Claude

##### ANTHROPIC_KEY

The Anthropic API key. To get started with Anthropic Claude, request access to their API at [anthropic.com/earlyaccess](https://www.anthropic.com/earlyaccess).

##### ANTHROPIC_MODEL

Default: `claude-2.1`

Supported:
- `claude-2.1`
- `claude-2.0`
- `claude-instant-1.2`

```sh
aicommit2 config set ANTHROPIC_MODEL=claude-instant-1.2
```

### GEMINI

##### GEMINI_KEY

The Gemini API key. If you don't have one, create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).

##### GEMINI_MODEL

Default: `gemini-pro`

Supported:
- `gemini-pro`

> Currently supporting only one model, but as Gemini starts supporting other models, it will be updated.

### MISTRAL

##### MISTRAL_KEY

The Mistral API key. If you don't have one, please sign up and subscribe in [Mistral Console](https://console.mistral.ai/).

##### MISTRAL_MODEL

Default: `mistral-tiny`

Supported:
- `open-mistral-7b`
- `mistral-tiny-2312`
- `mistral-tiny`
- `open-mixtral-8x7b`
- `mistral-small-2312`
- `mistral-small`
- `mistral-small-2402`
- `mistral-small-latest`
- `mistral-medium-latest`
- `mistral-medium-2312`
- `mistral-medium`
- `mistral-large-latest`
- `mistral-large-2402`
- `mistral-embed`

> The models mentioned above are subject to change.

### HuggingFace Chat

##### HUGGING_COOKIE

The [Huggingface Chat](https://huggingface.co/chat/) Cookie. Please check [how to get cookie](https://github.com/tak-bro/aicommit2?tab=readme-ov-file#how-to-get-cookieunofficial-api)

##### HUGGING_MODEL

Default: `mistralai/Mixtral-8x7B-Instruct-v0.1`

Supported:
- `mistralai/Mixtral-8x7B-Instruct-v0.1`
- `meta-llama/Llama-2-70b-chat-hf`
- `NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO`
- `codellama/CodeLlama-70b-Instruct-hf`
- `mistralai/Mistral-7B-Instruct-v0.2`
- `openchat/openchat-3.5-0106`

>  The models mentioned above are subject to change.

### Clova X

##### CLOVAX_COOKIE

The [Clova X](https://clova-x.naver.com/) Cookie. Please check [how to get cookie](https://github.com/tak-bro/aicommit2?tab=readme-ov-file#how-to-get-cookieunofficial-api)

### Ollama

##### OLLAMA_MODEL

The Ollama Model. Please see [a list of models available](https://ollama.com/library)

##### OLLAMA_HOST

Default: `http://localhost:11434`

The Ollama host

##### OLLAMA_TIMEOUT

Default: `100000` (100 seconds)

Request timeout for the Ollama. Default OLLAMA_TIMEOUT is **100 seconds** because it can take a long time to run locally.

##### OLLAMA_STREAM

Default: `false`

Determines whether the application will make stream requests to Ollama. This feature is experimental and may not be fully stable.

## Upgrading

Check the installed version with:

```
aicommit2 --version
```

If it's not the [latest version](https://github.com/tak-bro/aicommit2/releases/latest), run:

```sh
npm update -g aicommit2
```

## How to get Cookie(**Unofficial API**)

* Login to the site you want
* You can get cookie from the browser's developer tools network tab
* See for any requests check out the Cookie, **Copy whole value**
* Check below image for the format of cookie

> When setting cookies with long string values, ensure to **escape characters** like ", ', and others properly.
> - For double quotes ("), use \\"
> - For single quotes ('), use \\'

![how-to-get-cookie](https://github.com/tak-bro/aicommit2/assets/7614353/66f2994d-23d9-4c88-a113-f2d3dc5c0669)

![how-to-get-clova-x-cookie](https://github.com/tak-bro/aicommit2/assets/7614353/dd2202d6-ca1a-4a8a-ba2f-b5703a19c71d)

## Disclaimer

This project utilizes certain functionalities or data from external APIs, but it is important to note that it is not officially affiliated with or endorsed by the providers of those APIs. The use of external APIs is at the sole discretion and risk of the user.

## Risk Acknowledgment

Users are responsible for understanding and abiding by the terms of use, rate limits, and policies set forth by the respective API providers. The project maintainers cannot be held responsible for any misuse, downtime, or issues arising from the use of the external APIs.

It is recommended that users thoroughly review the API documentation and adhere to best practices to ensure a positive and compliant experience.

## Please Star⭐️ 
If this project has been helpful to you, I would greatly appreciate it if you could click the Star⭐️ button on this repository!

## Maintainers

- [@tak-bro](https://env-tak.github.io/)

## Contributing

If you want to help fix a bug or implement a feature in [Issues](https://github.com/tak-bro/aicommit2/issues), checkout the [Contribution Guide](CONTRIBUTING.md) to learn how to setup and test the project.
