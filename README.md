<div align="center">
  <div>
    <img src=".github/screenshot.png" alt="AICommit2"/>
    <h1 align="center">AICommit2</h1>
  </div>
	<p>The project was inspired by the <a href="https://https://github.com/Nutlope/aicommits">AI Commits</a></p>
	<a href="https://www.npmjs.com/package/aicommit2"><img src="https://img.shields.io/npm/v/aicommit2" alt="Current version"></a>
</div>

---

# AICommit2

A Reactive CLI that generates git commit messages with diverse AI

## Setup

> The minimum supported version of Node.js is the latest v14. Check your Node.js version with `node --version`.

1. Install _aicommit2_:

```sh
npm install -g aicommit2
```

2. Retrieve your API key or Cookie

- [OpenAI](https://platform.openai.com/account/api-keys)
- [HuggingChat](https://github.com/tak-bro/aicommit2/blob/master/README.md#how-to-get-cookie)
 
> If you haven't already, you'll have to create an account and set up billing. 

3. Set the key so aicommit2 can use it:

```sh
aicommit2 config set OPENAI_KEY=<your token> # openai
aicommit2 config set HUGGING_COOKIE="<your browser cookie>" # huggingface
```

This will create a `.aicommit2` file in your home directory.

> At least one API key must be set up.

### Upgrading

Check the installed version with:

```
aicommit2 --version
```

If it's not the [latest version](https://github.com/tak-bro/aicommit2/releases/latest), run:

```sh
npm update -g aicommit2
```

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

##### `--locale`
- Locale to use for the generated commit messages (default: **en**)

```sh
aicommit2 --locale <s> # or -l <s>
```

##### `--generate`
- Number of messages to generate (Warning: generating multiple costs more) (default: **1**)
- Sometimes the recommended commit message isn't the best so you want it to generate a few to pick from. You can generate multiple commit messages at once by passing in the `--generate <i>` flag, where 'i' is the number of generated messages:

```sh
aicommit2 --generate <i> # or -g <i>
```

> Warning: this uses more tokens, meaning it costs more.

##### `--all`
- Automatically stage changes in tracked files for the commit (default **false**)

```sh
aicommit2 --all # or -a
```

##### `--type`
- Automatically stage changes in tracked files for the commit (default **conventional**)
- it supports [`conventional`](https://conventionalcommits.org/) and [`gitmoji`](https://gitmoji.dev/)

```sh
aicommit2 --type conventional # or -t conventional
aicommit2 --type gitmoji # or -t gitmoji
```

##### `--confirm`
- Skip confirmation when committing after message generation (default: **false**)

```sh
aicommit2 --confirm # or -y
```

##### `--clipboard`
- Copy the selected message to the clipboard (default: **false**)
- This is a useful option when you don't want to commit through aicommit2.

```sh
aicommit2 --clipboard # or -c
```

### Git hook

You can also integrate _aicommit2_ with Git via the [`prepare-commit-msg`](https://git-scm.com/docs/githooks#_prepare_commit_msg) hook. This lets you use Git like you normally would, and edit the commit message before committing.

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

2. aicommit2 will generate the commit message for you and pass it back to Git. Git will open it with the [configured editor](https://docs.github.com/en/get-started/getting-started-with-git/associating-text-editors-with-git) for you to review/edit it.

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
aicommit2 config get OPENAI_KEY generate
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

### All Options

> This is an ongoing project currently in preparation.

| Option           | Default                                | Description                                                                 |
|------------------|----------------------------------------|-----------------------------------------------------------------------------|
| `OPENAI_KEY`     | N/A                                    | The OpenAI API key.                                                         |
| `OPENAI_MODEL`   | `gpt-3.5-turbo`                        | The OpenAI Model to use.                                                    |
| `HUGGING_COOKIE` | N/A                                    | The HuggingFace Cookie string                                               |
| `HUGGING_MODEL`  | `mistralai/Mixtral-8x7B-Instruct-v0.1` | The HuggingFace Model to use.                                               |
| `confirm`        | `false`                                | Skip confirmation when committing after message generation (default: false) |
| `clipboard`      | `false`                                | Copy the selected message to the clipboard                                  |
| `locale`         | `en`                                   | Locale for the generated commit messages.                                   |
| `generate`       | `1`                                    | Number of commit messages to generate.                                      |
| `type`           | `conventional`                         | Type of commit message to generate.                                         |
| `proxy`          | N/A                                    | Set a HTTP/HTTPS proxy to use for requests(only **OpenAI**).                |
| `timeout`        | `10000` ms                             | Network request timeout                                                     |
| `max-length`     | `50`                                   | Maximum character length of the generated commit message.                   |
| `max-tokens`     | `200`                                  | The maximum number of tokens that the AI models can generate.               |
| `temperature`    | `0.7`                                  | The temperature (0.0-2.0) is used to control the randomness of the output   |


### Options

#### OPENAI_KEY

Required

The OpenAI API key. You can retrieve it from [OpenAI API Keys page](https://platform.openai.com/account/api-keys).

#### locale

Default: `en`

The locale to use for the generated commit messages. Consult the list of codes in: https://wikipedia.org/wiki/List_of_ISO_639_language_codes.

#### generate

Default: `1`

The number of commit messages to generate to pick from.

Note, this will use more tokens as it generates more results.

#### proxy

Set a HTTP/HTTPS proxy to use for requests.

To clear the proxy option, you can use the command (note the empty value after the equals sign):

> Only supported within the OpenAI

```sh
aicommit2 config set proxy=
```

#### confirm

Default: true

Check again when committing after message generation

#### OPENAI_MODEL

Default: `gpt-3.5-turbo`

The Chat Completions (`/v1/chat/completions`) model to use. Consult the list of models available in the [OpenAI Documentation](https://platform.openai.com/docs/models/model-endpoint-compatibility).

> Tip: If you have access, try upgrading to [`gpt-4`](https://platform.openai.com/docs/models/gpt-4) for next-level code analysis. It can handle double the input size, but comes at a higher cost. Check out OpenAI's website to learn more.

```sh
aicommit2 config set OPENAI_MODEL=gpt-4
```

#### timeout

The timeout for network requests to the OpenAI API in milliseconds.

Default: `10000` (10 seconds)

```sh
aicommit2 config set timeout=20000 # 20s
```

#### max-length

The maximum character length of the generated commit message.

Default: `50`

```sh
aicommit2 config set max-length=100
```

#### type

Default: `""` (Empty string)

The type of commit message to generate. Set this to "conventional" to generate commit messages that follow the Conventional Commits specification:

```sh
aicommit2 config set type=conventional
```

You can clear this option by setting it to an empty string:

```sh
aicommit2 config set type=
```

#### max-tokens
The maximum number of tokens that the AI models can generate.

Default: `200`

```sh
aicommit2 config set max-tokens=1000
```

## How it works

This CLI tool runs `git diff` to grab all your latest code changes, sends them to OpenAI's GPT-3, then returns the AI generated commit message.

Video coming soon where I rebuild it from scratch to show you how to easily build your own CLI tools powered by AI.

## HuggingFace

### How to get Cookie
* Login to the [HuggingFace Chat](https://huggingface.co/chat).
* You can get cookie from the browser's developer tools network tab
* See for any requests check out the Cookie, **Copy whole value**
* check below image for the format of cookie

![how-to-get-cookie](https://github-production-user-asset-6210df.s3.amazonaws.com/7614353/301202605-0ab8fcb5-d1fe-40ab-928b-cf53fe00a18f.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=AKIAVCODYLSA53PQK4ZA%2F20240131%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20240131T145334Z&X-Amz-Expires=300&X-Amz-Signature=c470928801cffafcbb39e1292fc6bd54117386d4c109e57687e8ea01523f15d9&X-Amz-SignedHeaders=host&actor_id=7614353&key_id=0&repo_id=750368232)
 

## Maintainers

-   **Hyungtak Jin**: [@tak-bro](https://github.com/tak-bro)

## Contributing

If you want to help fix a bug or implement a feature in [Issues](https://github.com/tak-bro/aicommit2/issues), checkout the [Contribution Guide](CONTRIBUTING.md) to learn how to setup and test the project.
