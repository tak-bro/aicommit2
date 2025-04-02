# Cohere 

## Settings

| Setting            | Description  | Default     |
|--------------------|--------------|-------------|
| `key`              | API key      | -           |
| `model`            | Model to use | `command`   |

## Configuration 

#### COHERE.key

The Cohere API key. If you don't have one, please sign up and get the API key in [Cohere Dashboard](https://dashboard.cohere.com/).

#### COHERE.model

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
