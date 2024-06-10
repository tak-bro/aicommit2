## [1.9.7](https://github.com/tak-bro/aicommit2/compare/v1.9.6...v1.9.7) (2024-06-10)


### Features

* implement GroqService for Groq AI ([8c4ad8c](https://github.com/tak-bro/aicommit2/commit/8c4ad8cd7a0595c412e63e51cfd164dff1a0590b))

## [1.9.6](https://github.com/tak-bro/aicommit2/compare/v1.9.5...v1.9.6) (2024-06-09)

## [1.9.5](https://github.com/tak-bro/aicommit2/compare/v1.9.4...v1.9.5) (2024-06-04)


### Bug Fixes

* update logging in ParallelOllamaService to include model information ([2ad9f76](https://github.com/tak-bro/aicommit2/commit/2ad9f760988e8d60aab2c36cc80057cd08081432))


### Features

* add ParallelOllamaService ([5a13ce3](https://github.com/tak-bro/aicommit2/commit/5a13ce38d9eb83a5d410b04953e326c0981b53f6))
* support multiple Ollama models ([cb865d9](https://github.com/tak-bro/aicommit2/commit/cb865d93284034ee705a7601d3309d906e6466f8))
* update OllamaService to support multiple models ([7103f03](https://github.com/tak-bro/aicommit2/commit/7103f0338de726f7267d115acb95487e08ac884b))

## [1.9.4](https://github.com/tak-bro/aicommit2/compare/v1.9.3...v1.9.4) (2024-06-03)


### Bug Fixes

* update gitmoji regular expression ([e8a3d36](https://github.com/tak-bro/aicommit2/commit/e8a3d368fd0333870a15e7d6ce37b059d6e8e562))

## [1.9.3](https://github.com/tak-bro/aicommit2/compare/v1.9.2...v1.9.3) (2024-06-02)


### Features

* implement removeAll command to delete all log files ([20b7fa8](https://github.com/tak-bro/aicommit2/commit/20b7fa8c5f6d0ade5eb4d289908c638e253d388a))
* updated commit message format description ([15e6a38](https://github.com/tak-bro/aicommit2/commit/15e6a3844faea310d41af7d527da763f9f5f6ac1))

## [1.9.2](https://github.com/tak-bro/aicommit2/compare/v1.9.1...v1.9.2) (2024-05-31)


### ✨ Features

* add Cohere AI service ([34f2d7e](https://github.com/tak-bro/aicommit2/commit/34f2d7e56419e01d76a2ef5087631785b11cd6ed))


### 💫 CI/CD

* add no response issue workflow ([c017ec4](https://github.com/tak-bro/aicommit2/commit/c017ec41317516c820540a7755bc48a1c1e703ed))
* add no-response-issues workflow ([16aac67](https://github.com/tak-bro/aicommit2/commit/16aac675ad2b1e3d85819bd5d60ef20926a9cb3a))
* add stale_issues.yml workflow ([0b718e8](https://github.com/tak-bro/aicommit2/commit/0b718e85368702b5e5c3696bf1b3d84e0c1a8c3d))


### 📦 Chores

* add scheduled job for no response issues ([e2f0a74](https://github.com/tak-bro/aicommit2/commit/e2f0a74cf0835d244ba1ca4ea098632c7eb96a1c))

## [1.9.1](https://github.com/tak-bro/aicommit2/compare/v1.9.0...v1.9.1) (2024-05-27)


### ✨ Features

* **gemini:** update default Gemini model to 'gemini-1.5-flash-latest' ([9e50f5e](https://github.com/tak-bro/aicommit2/commit/9e50f5e15822e10f0bbdb052a8f71905c2e0bf13))


### 🐛 Bug Fixes

* validate against all config parsers ([193d68c](https://github.com/tak-bro/aicommit2/commit/193d68c34eea806b07f5c92ebc105f4ed6e36613))


### ♻️ Refactor

* add generalConfigParsers ([8ebb2fe](https://github.com/tak-bro/aicommit2/commit/8ebb2fe29f6cf871a5f89f9995451406754db468))

## [1.9.0](https://github.com/tak-bro/aicommit2/compare/v1.8.7...v1.9.0) (2024-05-24)


### ✨ Features

* add error logging to check ai response ([d050a81](https://github.com/tak-bro/aicommit2/commit/d050a81caf7ff3c708669df6418a3f2a1bedc698))
* update log file name and content format ([9777072](https://github.com/tak-bro/aicommit2/commit/9777072e9de5a03a2355a22439509bf8b8c74ce7))
* update log message to include prompt ([47f3c5f](https://github.com/tak-bro/aicommit2/commit/47f3c5fd2c7e0c2e7efb11500040e0f511d6d47d))


### 🐛 Bug Fixes

* correct the generateDefaultPrompt function ([fc0aa0c](https://github.com/tak-bro/aicommit2/commit/fc0aa0cfea918f1d96135cf82d87143218f190d0))


### ♻️ Refactor

* improve regular expression pattern to check message loosely ([d527fa4](https://github.com/tak-bro/aicommit2/commit/d527fa4198c6d64ae593e3717bceb4fd4f7b72a8))


### 💫 CI/CD

* **minor:** update release configuration ([461c0fd](https://github.com/tak-bro/aicommit2/commit/461c0fdcd92bef5f095850a2fadf209a5f48006a))


### 📦 Chores

* update logging logic for OllamaService ([7b346ec](https://github.com/tak-bro/aicommit2/commit/7b346ec8fe29c451e6ba2c11a5423418995b5e2a))
* update logging mechanism ([ad06ac1](https://github.com/tak-bro/aicommit2/commit/ad06ac1200f8670cdcdbb0fafc5ff7ecd040cf14))

## [1.8.7](https://github.com/tak-bro/aicommit2/compare/v1.8.6...v1.8.7) (2024-05-22)


### ✨ Features

* correct prompt message for generating commit messages ([2c4f854](https://github.com/tak-bro/aicommit2/commit/2c4f8545f3cc7aa307b82752b650aaa1ac8e4cd8))
* update prompt and commit type format messages ([447ce8a](https://github.com/tak-bro/aicommit2/commit/447ce8aa0879a130a7b02393842ec3e6841c6d6a))


### 📦 Chores

* remove keep_alive option from OllamaService ([4879337](https://github.com/tak-bro/aicommit2/commit/4879337a9c6076ca6352f1638e5b409e62ea1d21))
* update prompt for commit message guidelines ([4121875](https://github.com/tak-bro/aicommit2/commit/41218754896e0d2594a1ac0ddac57a2ead7d4d6b))

## [1.8.6](https://github.com/tak-bro/aicommit2/compare/v1.8.5...v1.8.6) (2024-05-16)


### ♻️ Refactor

* replace localhost url with default constant and add DEFAULT_OLLMA_HOST to config.ts ([76b9d00](https://github.com/tak-bro/aicommit2/commit/76b9d00fdebc2fbbabfc92d8976bf9b7bf5cc30a))

## [1.8.5](https://github.com/tak-bro/aicommit2/compare/v1.8.4...v1.8.5) (2024-05-08)


### ✨ Features

* improved OllamaService with configurable prompt and temperature ([c200906](https://github.com/tak-bro/aicommit2/commit/c20090638067e2309921658e69f9c00eae1041e0))
* simplify prompt generation and update buildPrompt method ([6c39016](https://github.com/tak-bro/aicommit2/commit/6c390168746c4e9e71c76fbe523d6b88826d91bb))


### 🐛 Bug Fixes

* correct prompt format ([2b258f1](https://github.com/tak-bro/aicommit2/commit/2b258f1d06a9c89795180031f103f205213369af))
* **prompt:** fix generatePrompt function to accept additionalPrompts ([d42507d](https://github.com/tak-bro/aicommit2/commit/d42507da601b474729ce457c5abd527dd2e55081))


### 📝 Docs

* update badges ([c765a64](https://github.com/tak-bro/aicommit2/commit/c765a64b187abd1e87f20c6694ffe77b3583bf3e))
* update documentation for Ollama model, host, and stream ([6750db1](https://github.com/tak-bro/aicommit2/commit/6750db18558ed55f3ea2f26fe33d6c9defd13956))
* update README ([fdb080b](https://github.com/tak-bro/aicommit2/commit/fdb080bbae2951ef280f87acd5cfb8f76191bacb))
* update README ([b9c2c73](https://github.com/tak-bro/aicommit2/commit/b9c2c73bb8edf8eb6dbdbb676f0cad7e1b2037f5))
* update README.md with new links and images ([3e9f87e](https://github.com/tak-bro/aicommit2/commit/3e9f87e1f1061566114ffd0d9f925db9491c7340))


### 📦 Chores

* rollback code for ollama service ([721710c](https://github.com/tak-bro/aicommit2/commit/721710cccb17154f9e7ad4df9d46b62ca296e339))

## [1.8.4](https://github.com/tak-bro/aicommit2/compare/v1.8.3...v1.8.4) (2024-05-04)


### ✨ Features

* **anthropic:** add temperature parameter to Anthropic API call ([ca32486](https://github.com/tak-bro/aicommit2/commit/ca32486357f9ace726419153a3ad8c7da3645995))
* support claude3 models ([c4985b8](https://github.com/tak-bro/aicommit2/commit/c4985b886461e793d370f9539ee1eb12072182b2))


### 📝 Docs

* update Anthropic model default in README ([09db772](https://github.com/tak-bro/aicommit2/commit/09db7726bd099b5e1178a6590276cab9ea551d17))

## [1.8.3](https://github.com/tak-bro/aicommit2/compare/v1.8.2...v1.8.3) (2024-04-30)


### ✨ Features

* update supported models in HuggingFace ([6ceb341](https://github.com/tak-bro/aicommit2/commit/6ceb3410716d5288852eae8ce1a51ab6842a0398))


### 📝 Docs

* clarify stream request option ([8cacb2a](https://github.com/tak-bro/aicommit2/commit/8cacb2a65048624a09edb61b7e37170dc1c9cd64))
* **README:** update introduction and features ([e0682dd](https://github.com/tak-bro/aicommit2/commit/e0682ddc7b4e2eba919a0dd2e767625d43caa9d5))

## [1.8.2](https://github.com/tak-bro/aicommit2/compare/v1.8.1...v1.8.2) (2024-04-21)


### 💫 CI/CD

* add semantic-release npm plugin to release config ([2b756c8](https://github.com/tak-bro/aicommit2/commit/2b756c8cf9ca5770a270d3d76ef0e072fa7846bb))


### 📦 Chores

* update prompt to include commit type ([fd5647a](https://github.com/tak-bro/aicommit2/commit/fd5647ab8490adadd43cc8ea13345f55c20fe0d0))

## [1.8.1](https://github.com/tak-bro/aicommit2/compare/v1.8.0...v1.8.1) (2024-04-20)


### 📝 Docs

* **README:** update README ([8bf9d4f](https://github.com/tak-bro/aicommit2/commit/8bf9d4f741a1169c35bd00b1bf5aaa36e88c056f))
* **README:** update README ([c617056](https://github.com/tak-bro/aicommit2/commit/c6170561c928074483d48247c3801a22afbd5c27))


### 💫 CI/CD

* **release:** update semantic release plugins and config ([9c4f7ee](https://github.com/tak-bro/aicommit2/commit/9c4f7ee07dd3400f018406e2a146a8346e40706a))
