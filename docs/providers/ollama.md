# Ollama 

## Setup 

You can use your model for free with [Ollama](https://ollama.com/) and it is available to use both Ollama and remote providers **simultaneously**.

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

## 📌 Important Note

**Before configuring, please review:**
- [Configuration Guide](../../README.md#configuration) - How to configure providers
- [General Settings](../../README.md#general-settings) - Common settings applicable to all providers

## Example Configuration

### Basic Setup
```sh
aicommit2 config set OLLAMA.model="llama3.2"
```

### Advanced Setup
```sh
aicommit2 config set OLLAMA.model="codellama" \
  OLLAMA.numCtx=4096 \
  OLLAMA.temperature=0.7 \
  OLLAMA.maxTokens=4000 \
  OLLAMA.locale="en" \
  OLLAMA.generate=3 \
  OLLAMA.topP=0.9
```

## Settings

| Setting    | Description                                                 | Default                |
|------------|-------------------------------------------------------------|------------------------|
| `model`    | Model(s) to use (comma-separated list)                      | -                      |
| `host`     | Ollama host URL                                             | http://localhost:11434 |
| `auth`     | Authentication type                                         | Bearer                 |
| `key`      | Authentication key                                          | -                      |
| `numCtx`   | The maximum number of tokens the model can process at once  | 2048                   |

## Configuration

#### OLLAMA.model

The Ollama Model. Please see [a list of models available](https://ollama.com/library)

```sh
aicommit2 config set OLLAMA.model="llama3.1"
aicommit2 config set OLLAMA.model="llama3,codellama" # for multiple models

aicommit2 config add OLLAMA.model="gemma2" # Only Ollama.model can be added.
```

> OLLAMA.model is **string array** type to support multiple Ollama. Please see [this section](#loading-multiple-ollama-models).

#### OLLAMA.host

Default: `http://localhost:11434`

The Ollama host

```sh
aicommit2 config set OLLAMA.host=<host>
```

#### OLLAMA.auth

Not required. Use when your Ollama server requires authentication. Please see [this issue](https://github.com/tak-bro/aicommit2/issues/90).

```sh
aicommit2 config set OLLAMA.auth=<auth>
```

#### OLLAMA.key

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

#### OLLAMA.numCtx

The maximum number of tokens the model can process at once, determining its context length and memory usage.
It is recommended to set it to 4096 or higher.

```sh
aicommit2 config set OLLAMA.numCtx=4096
```

#### Unsupported Options

Ollama does not support the following options in General Settings.

- maxTokens


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
