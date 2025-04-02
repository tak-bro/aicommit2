# Anthropic 

## Settings

| Setting     | Description    | Default                     |
|-------------|----------------|-----------------------------|
| `key`       | API key        | -                           |
| `model`     | Model to use   | `claude-3-5-haiku-20241022` |

## Configuration 

#### ANTHROPIC.key

The Anthropic API key. To get started with Anthropic Claude, request access to their API at [anthropic.com/earlyaccess](https://www.anthropic.com/earlyaccess).

#### ANTHROPIC.model

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
