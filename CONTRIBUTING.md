# Contribution Guide

## Setting up the project

Use [nvm](https://nvm.sh) to use the appropriate Node.js version from `.nvmrc`:

```sh
nvm i
```

Install the dependencies using pnpm:

```sh
pnpm i
```

## Building the project

Run the `build` script:

```sh
pnpm build
```

The package is bundled using [pkgroll](https://github.com/privatenumber/pkgroll) (Rollup). It infers the entry-points from `package.json` so there are no build configurations.

### Development (watch) mode

During development, you can use the watch flag (`--watch, -w`) to automatically rebuild the package on file changes:

```sh
pnpm build -w
```

## Running the package locally

Since pkgroll knows the entry-point is a binary (being in `package.json#bin`), it automatically adds the Node.js hashbang to the top of the file, and chmods it so it's executable.

You can run the distribution file in any directory:

```sh
./dist/cli.mjs
```

Or in non-UNIX environments, you can use Node.js to run the file:

```sh
node ./dist/cli.mjs
```

## Testing

Testing requires passing in `OPENAI_KEY` as an environment variable:

```sh
OPENAI_KEY=<your OPENAI key> pnpm test
```

You can still run tests that don't require `OPENAI_KEY` but will not test the main functionality:

```
pnpm test
```

## Using & testing your changes

Let's say you made some changes in a fork/branch and you want to test it in a project. You can publish the package to a GitHub branch using [`git-publish`](https://github.com/privatenumber/git-publish):

Publish your current branch to a `npm/*` branch on your GitHub repository:

```sh
$ pnpm dlx git-publish

✔ Successfully published branch! Install with command:
→ npm i 'tak-bro/aicommit2#npm/develop'
```

> Note: The `tak-bro/aicommit2` will be replaced with your fork's URL.

Now, you can run the branch in your project:

```sh
$ pnpm dlx 'tak-bro/aicommit2#npm/develop' # same as running `npx aicommit2`
```
