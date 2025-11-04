## [2.4.15](https://github.com/tak-bro/aicommit2/compare/v2.4.14...v2.4.15) (2025-11-04)


### Features

* **cohere:** upgrade to v2 API and improve timeout ([0f94439](https://github.com/tak-bro/aicommit2/commit/0f94439a1afb84a7e0936d1096e59dd85860953c))

## [2.4.14](https://github.com/tak-bro/aicommit2/compare/v2.4.13...v2.4.14) (2025-10-28)


### Bug Fixes

* **ci:** update title in update_flake.yml workflow ([a368d18](https://github.com/tak-bro/aicommit2/commit/a368d18c3551ae2ff1d723b0620b2e7f8a433689))


### Features

* add Homebrew installation support ([c2661be](https://github.com/tak-bro/aicommit2/commit/c2661be4cdc0a4198f8763981c0543e285d7fd2a)), closes [#178](https://github.com/tak-bro/aicommit2/issues/178)
* **ci:** comprehensive CI/CD workflow improvements ([db50c17](https://github.com/tak-bro/aicommit2/commit/db50c173980aad93e3dffad85f7c45f8d7d28bcb))
* **deepseek:** enhance reasoning model support ([1a8a632](https://github.com/tak-bro/aicommit2/commit/1a8a632c03b44b47e25f25c15248655357135e7a))
* **prompt:** support localized examples in prompts ([0275d18](https://github.com/tak-bro/aicommit2/commit/0275d1894b34a20aed3203b2d1935bb8244c6964))

## [2.4.13](https://github.com/tak-bro/aicommit2/compare/v2.4.12...v2.4.13) (2025-10-25)


### Features

* **cli:** add verbose logging option for enhanced debugging ([254042d](https://github.com/tak-bro/aicommit2/commit/254042d743c2b4991e5734b00f643794fb0ef6bd))

## [2.4.12](https://github.com/tak-bro/aicommit2/compare/v2.4.11...v2.4.12) (2025-10-24)

## [2.4.11](https://github.com/tak-bro/aicommit2/compare/v2.4.10...v2.4.11) (2025-10-19)


### Bug Fixes

* **ci:** use PAT_TOKEN to trigger release workflows ([99e8cbf](https://github.com/tak-bro/aicommit2/commit/99e8cbf8f5ca51f512154b653238347c2a4aa6c4))

## [2.4.10](https://github.com/tak-bro/aicommit2/compare/v2.4.9...v2.4.10) (2025-10-19)


### Bug Fixes

* **ci:** update Node.js version to v22.15.1 for semantic-release compatibility ([888edea](https://github.com/tak-bro/aicommit2/commit/888edea7905a1331fb08244c05382f65e4844094))
* **prompt:** add missing ui properties to type ([9af9ec0](https://github.com/tak-bro/aicommit2/commit/9af9ec08481e754ec19099c8db8b1cfdc22dd461))
* **prompt:** prevent closing already closed readline ([16dab11](https://github.com/tak-bro/aicommit2/commit/16dab11cba46d3b759b186cb390d12fd0906a136))


### Features

* add gradient title printing ([f2b2d43](https://github.com/tak-bro/aicommit2/commit/f2b2d433e4e6908cbe95711ba10b53e8c5fc9077))

## [2.4.9](https://github.com/tak-bro/aicommit2/compare/v2.4.8...v2.4.9) (2025-10-14)

## [2.4.8](https://github.com/tak-bro/aicommit2/compare/v2.4.7...v2.4.8) (2025-10-13)

### Features

- allow forcing git with config or env var ([7f007ea](https://github.com/tak-bro/aicommit2/commit/7f007ea9422167b7a22aa3e16ac07703f3434bc4))
- update jj detection flow and remove jujutsu type [#173](https://github.com/tak-bro/aicommit2/issues/173) ([b679812](https://github.com/tak-bro/aicommit2/commit/b679812aa58b3a3a5f7eeaeba388588f8011326b))

## [2.4.7](https://github.com/tak-bro/aicommit2/compare/v2.4.6...v2.4.7) (2025-10-02)

### Bug Fixes

- **ui:** fix empty commit message ([8b2598b](https://github.com/tak-bro/aicommit2/commit/8b2598b3351b9765a97fc68763413bc1cd6cc656))
- **watch-git:** handle git reset and improve commit processing ([534287a](https://github.com/tak-bro/aicommit2/commit/534287aaef21beb42f72f7aed0542d763b1c3b8b))

### Features

- improve commit monitoring with git events ([168c897](https://github.com/tak-bro/aicommit2/commit/168c89775c8d7de7e70395ed4ee310719512c0c7))

## [2.4.6](https://github.com/tak-bro/aicommit2/compare/v2.4.5...v2.4.6) (2025-09-12)

### Features

- prevents memory leaks and refactor code ([2dfab71](https://github.com/tak-bro/aicommit2/commit/2dfab716d5e0b5cfdc294aba27bc47f0ba7809f4))

## [2.4.5](https://github.com/tak-bro/aicommit2/compare/v2.4.4...v2.4.5) (2025-08-25)

### Bug Fixes

- **config:** use correct path for macOS config dir ([8a1a6ff](https://github.com/tak-bro/aicommit2/commit/8a1a6ffb07a951a93719df83b5c5a33261874c82))

## [2.4.4](https://github.com/tak-bro/aicommit2/compare/v2.4.3...v2.4.4) (2025-08-20)

### Features

- add disable-lowercase flag and config option ([2b9a45d](https://github.com/tak-bro/aicommit2/commit/2b9a45d1f2750f2c2070e7b3e856872120e8edad))

## [2.4.3](https://github.com/tak-bro/aicommit2/compare/v2.4.2...v2.4.3) (2025-08-14)

## [2.4.2](https://github.com/tak-bro/aicommit2/compare/v2.4.1...v2.4.2) (2025-08-13)

### Features

- **cli:** add edit flag to open AI-generated commit message in editor ([30ae22d](https://github.com/tak-bro/aicommit2/commit/30ae22dab568dde763074cc3035650bde9f9d325))
- improve edit message feedback ([30e1924](https://github.com/tak-bro/aicommit2/commit/30e19247b13fbd814e2ad4ddcb9528b533bc5796))

## [2.4.1](https://github.com/tak-bro/aicommit2/compare/v2.4.0...v2.4.1) (2025-08-12)

### Features

- add GPT-5 model compatibility ([ba95ee8](https://github.com/tak-bro/aicommit2/commit/ba95ee8bd88e68677d310300e76b8d7355978c4b))
- **openai:** support distinct GPT-5 model parameters ([6eea701](https://github.com/tak-bro/aicommit2/commit/6eea7018e418678de153a865f8402965b6b22411))

# [2.4.0](https://github.com/tak-bro/aicommit2/compare/v2.3.6...v2.4.0) (2025-08-11)

### Features

- **ai:** support GPT-5 models with updated parameters ([4971d0c](https://github.com/tak-bro/aicommit2/commit/4971d0ccb4e4ded9f763b36e4b862925bb334909))
- **jujutsu:** implement fileset exclusion using Jujutsu syntax ([7455ab8](https://github.com/tak-bro/aicommit2/commit/7455ab8e14a9fd4c85bff6df3033bfcca9c774a6))
- support jujutsu vcs ([234c736](https://github.com/tak-bro/aicommit2/commit/234c736fbd1179ddefd6c854594f371a3a6126e5))

## [2.3.6](https://github.com/tak-bro/aicommit2/compare/v2.3.5...v2.3.6) (2025-08-05)

### Bug Fixes

- add redundant silent to console transport to please Copilot ([5a58097](https://github.com/tak-bro/aicommit2/commit/5a58097080cc6d447088e745246ab5d60ca618fd))
- **logger:** suppress winston message about missing transports ([62c8d8c](https://github.com/tak-bro/aicommit2/commit/62c8d8c170ad375e5666c530a4b6412f28b70098)), closes [#158](https://github.com/tak-bro/aicommit2/issues/158)

## [2.3.5](https://github.com/tak-bro/aicommit2/compare/v2.3.4...v2.3.5) (2025-07-31)

### Features

- **git:** display lint-staged output during commit ([3d2a5af](https://github.com/tak-bro/aicommit2/commit/3d2a5af2309dc4c438c26f90652acc586836d08d))
- remove ora spinner for commit ([d684a20](https://github.com/tak-bro/aicommit2/commit/d684a20e0cf67867dc2d00de1ea651d1aca9c7ef))

## [2.3.4](https://github.com/tak-bro/aicommit2/compare/v2.3.3...v2.3.4) (2025-07-28)

### Bug Fixes

- **nix:** add pnpmDeps fetcherVersion due to Nixpkgs[#426496](https://github.com/tak-bro/aicommit2/issues/426496) ([eda9c55](https://github.com/tak-bro/aicommit2/commit/eda9c551cbdb64cdf97118588278597c8eb14b5a))

## [2.3.3](https://github.com/tak-bro/aicommit2/compare/v2.3.2...v2.3.3) (2025-07-24)

## [2.3.2](https://github.com/tak-bro/aicommit2/compare/v2.3.1...v2.3.2) (2025-07-23)

### Bug Fixes

- **config:** update default model name in config ([2a845e4](https://github.com/tak-bro/aicommit2/commit/2a845e44c1db03230c98d9f0c6266e6d9078e705))

## [2.3.1](https://github.com/tak-bro/aicommit2/compare/v2.3.0...v2.3.1) (2025-07-21)

### Features

- add new supported models for providers ([3c5200d](https://github.com/tak-bro/aicommit2/commit/3c5200d311f28b9ae5e4e9b4e99f88a7722eaa16))

# [2.3.0](https://github.com/tak-bro/aicommit2/compare/v2.2.24...v2.3.0) (2025-07-20)

### Features

- add timeout config to AI service requests ([4f378b9](https://github.com/tak-bro/aicommit2/commit/4f378b980e08152beb6585d529bfc72f8c84f070))
- **git:** enhance diff to include binary file changes ([b8379fa](https://github.com/tak-bro/aicommit2/commit/b8379fa0fb09d483e9b11202e0868246df096931))
- **github-models:** update to GitHub Models API ([388e7ec](https://github.com/tak-bro/aicommit2/commit/388e7ec5f9247194e4b9b093b508cb3e335a6367))
- improve prompt generation for AI services ([1909961](https://github.com/tak-bro/aicommit2/commit/1909961727fbd833852bfe532868b0be7ec1a9d8))
- **log:** enhance log command with list, open, path actions ([70729ec](https://github.com/tak-bro/aicommit2/commit/70729ec644bba21897d8f39ed41c21ffebfcb786))
- pass flags to prepare-commit-msg hook ([2de0093](https://github.com/tak-bro/aicommit2/commit/2de00930d2fce51ebbe837f0b075af3c4af3522e))

## [2.2.24](https://github.com/tak-bro/aicommit2/compare/v2.2.23...v2.2.24) (2025-07-11)

### Features

- add auto-select option for single AI model ([4088be4](https://github.com/tak-bro/aicommit2/commit/4088be419518b5b6228bcf337e294913ef4e4760))

## [2.2.23](https://github.com/tak-bro/aicommit2/compare/v2.2.22...v2.2.23) (2025-07-11)

### Features

- add --include-body flag to force commit body ([a54edca](https://github.com/tak-bro/aicommit2/commit/a54edca35ca7d041672a1531ec525e2d52371efa))

## [2.2.22](https://github.com/tak-bro/aicommit2/compare/v2.2.21...v2.2.22) (2025-06-23)

### Features

- **gemini:** add support for new Gemini 2.5 models ([694a49c](https://github.com/tak-bro/aicommit2/commit/694a49c131d28d095cf859d815bcfe25fb6c3600))

## [2.2.21](https://github.com/tak-bro/aicommit2/compare/v2.2.20...v2.2.21) (2025-06-04)

## [2.2.20](https://github.com/tak-bro/aicommit2/compare/v2.2.19...v2.2.20) (2025-05-30)

### Bug Fixes

- correct commitType typo ([1ff8a27](https://github.com/tak-bro/aicommit2/commit/1ff8a276ff29d9f3421c8961a1d5eff9f489ac93))

## [2.2.19](https://github.com/tak-bro/aicommit2/compare/v2.2.18...v2.2.19) (2025-05-30)

### Features

- **anthropic:** add Claude 4 Opus and Sonnet models ([be0fc0d](https://github.com/tak-bro/aicommit2/commit/be0fc0d810de44f02b70cde64aecdde7da42a3e4))

## [2.2.18](https://github.com/tak-bro/aicommit2/compare/v2.2.17...v2.2.18) (2025-05-27)

### Features

- **ollama:** add support for maxTokens option ([3afa316](https://github.com/tak-bro/aicommit2/commit/3afa3164b6df3dcb18d750f4bdaf56f2ab4abecf))

## [2.2.17](https://github.com/tak-bro/aicommit2/compare/v2.2.16...v2.2.17) (2025-05-26)

### Bug Fixes

- **openai-compatible:** prevent 'undefined' choices error in message generation ([e47d670](https://github.com/tak-bro/aicommit2/commit/e47d6705e68656dd0eb31e69f367ecc0781fd398))

### Features

- **ai:** support multiple models per service ([5500614](https://github.com/tak-bro/aicommit2/commit/55006141141a68a0a81a46c263aab295e06af07f))
- **config:** add config path and XDG support ([7221e28](https://github.com/tak-bro/aicommit2/commit/7221e2849095d551746bb5a1b1708f229bffad54))
- **config:** add envKey configuration for custom API key environment variables ([eac2c57](https://github.com/tak-bro/aicommit2/commit/eac2c57f40258541d29b57fcb91ce079033f1cae))
- **config:** allow relative paths for prompt files ([7ef098b](https://github.com/tak-bro/aicommit2/commit/7ef098bdfd3ebb4a85b457ff2a84296ca9cd3632))
- **gemini:** add gemini-2.5-flash-preview-05-20 model ([31d1939](https://github.com/tak-bro/aicommit2/commit/31d1939f4e7459585c88936280d53fd6c94760a4))
- implement XDG config path lookup ([c6f0126](https://github.com/tak-bro/aicommit2/commit/c6f01260658043e844d46f21d5588791d1771589))
- **logger:** add option to disable file logging ([ca0af40](https://github.com/tak-bro/aicommit2/commit/ca0af4010bc3ac5c730a72efee374dc1e0d9e8d1))
- **logging:** implement file logging with daily rotation ([d4f4c34](https://github.com/tak-bro/aicommit2/commit/d4f4c34fa0bf80307afb0616f42ebe3ac3e9368c))
- **output:** add diff character count to staged message ([4e8d50e](https://github.com/tak-bro/aicommit2/commit/4e8d50e93f28a3eb270fb639431d701add3ca182))

## [2.2.16](https://github.com/tak-bro/aicommit2/compare/v2.2.15...v2.2.16) (2025-05-19)

### Bug Fixes

- **config:** support nested keys in get command ([d4885bd](https://github.com/tak-bro/aicommit2/commit/d4885bd0fadf043499bc093570e6b03549b968d5))
- **spell:** correct various typos ([a2d7f3f](https://github.com/tak-bro/aicommit2/commit/a2d7f3f1078b27dc4ec9522f08dfb468dc7ed8e8))

### Features

- **config:** add delete command for configuration ([7da6844](https://github.com/tak-bro/aicommit2/commit/7da68441c818f466d9dec363617c6ed440ed4ea8))
- **config:** list all keys when 'get' has no args ([be12d8d](https://github.com/tak-bro/aicommit2/commit/be12d8d2bb2fff31b5ca79040ec2c0a16f4c6432))
- **gemini:** update supported models and documentation ([5a2e170](https://github.com/tak-bro/aicommit2/commit/5a2e170634ebfa097b6d2fbbf3d66452cf7472a9))
- **groq:** update default model and supported models ([7f162f8](https://github.com/tak-bro/aicommit2/commit/7f162f88bdbd974760f704df69548d16a6537da5))

## [2.2.15](https://github.com/tak-bro/aicommit2/compare/v2.2.14...v2.2.15) (2025-05-06)

### Bug Fixes

- **utils:** fallback for missing git comment char ([899cbe6](https://github.com/tak-bro/aicommit2/commit/899cbe66430ec255cb2c3046f6c111f875f7508d))

### Features

- **prepare-commit-msg-hook:** add support for custom comment character ([181a8e9](https://github.com/tak-bro/aicommit2/commit/181a8e918b6bf4559ba6dfbbdd4c72fa3125d323))

## [2.2.14](https://github.com/tak-bro/aicommit2/compare/v2.2.13...v2.2.14) (2025-04-02)

### Features

- enhance CLI with config, hook, log commands ([fa2824b](https://github.com/tak-bro/aicommit2/commit/fa2824bb9544e8b1d8ac2dffeb36178493965816))

## [2.2.13](https://github.com/tak-bro/aicommit2/compare/v2.2.12...v2.2.13) (2025-03-27)

### Bug Fixes

- use undici fetch for timeout in Ollama ([c939e8a](https://github.com/tak-bro/aicommit2/commit/c939e8a859c4248bb23f68680c33595402cfc6c5))

## [2.2.12](https://github.com/tak-bro/aicommit2/compare/v2.2.11...v2.2.12) (2025-03-26)

### Features

- **ai:** add timeout configuration for AI providers ([f207ac6](https://github.com/tak-bro/aicommit2/commit/f207ac6b88a5c774346afc235c930f6efe87dc4a))
- **cohere:** add timeout configuration for API calls ([a04921e](https://github.com/tak-bro/aicommit2/commit/a04921e2c75a1dda0bd00e493672d212a0698347))
- **ollama:** add node-fetch for ollama ([6058cf5](https://github.com/tak-bro/aicommit2/commit/6058cf522b90cbd4425aaf203ce9556b7dd3bc70))

## [2.2.11](https://github.com/tak-bro/aicommit2/compare/v2.2.10...v2.2.11) (2025-03-25)

### Bug Fixes

- **config:** validate config key-value pairs ([e15dcbb](https://github.com/tak-bro/aicommit2/commit/e15dcbbaa08e7a5ebe999ec4fd3827c84d5f5409))

## [2.2.10](https://github.com/tak-bro/aicommit2/compare/v2.2.9...v2.2.10) (2025-03-24)

### Bug Fixes

- **config:** validate and parse configuration key-value pairs ([7ffbdbf](https://github.com/tak-bro/aicommit2/commit/7ffbdbf7b500ea931b5c803f052ac965a79ca311))

## [2.2.9](https://github.com/tak-bro/aicommit2/compare/v2.2.8...v2.2.9) (2025-03-24)

### Features

- **config:** add list command and AI stream support ([78043a6](https://github.com/tak-bro/aicommit2/commit/78043a6f1ee6f602cfe05b2d51b1f791b916f1b8))

## [2.2.8](https://github.com/tak-bro/aicommit2/compare/v2.2.7...v2.2.8) (2025-03-17)

### Bug Fixes

- filter out specific flags in hook scripts ([bbd9164](https://github.com/tak-bro/aicommit2/commit/bbd9164d786fee433fe5cf4a5949f7033c9d3aaa))
- fix prepare-commit-msg-hook ([57f7c09](https://github.com/tak-bro/aicommit2/commit/57f7c094dc2e9e109d2630d921931518c3acd76a))

## [2.2.7](https://github.com/tak-bro/aicommit2/compare/v2.2.6...v2.2.7) (2025-03-08)

### Bug Fixes

- robustify JSON parsing from AI response ([7b23554](https://github.com/tak-bro/aicommit2/commit/7b23554c845945a3e35c963ed612c0167ef5ce64))

### Features

- add hook-mode flag and improve hook execution ([7e59fe4](https://github.com/tak-bro/aicommit2/commit/7e59fe4de3ebc6f715936a1e25b3d6250af64208))
- improve prompt guidelines for clarity ([f225f3a](https://github.com/tak-bro/aicommit2/commit/f225f3a09da652c23a1d8e5ce09a33c2c0114613))
- **pre-commit:** add pre-commit hook integration with documentation ([d0dd2fc](https://github.com/tak-bro/aicommit2/commit/d0dd2fc0118c86f0afb009f2001c9aa24fa62997))
- support API key configuration via environment variables ([8141e73](https://github.com/tak-bro/aicommit2/commit/8141e732895e99886add97e1897abee2b685a451))

## [2.2.6](https://github.com/tak-bro/aicommit2/compare/v2.2.5...v2.2.6) (2025-03-04)

### Bug Fixes

- remove duplicate model name in modelConfigParsers ([9230394](https://github.com/tak-bro/aicommit2/commit/9230394a5c2bc6caa02c3eddcd4585a8cc46fbe7))
- set default model to gemini-2.0-flash ([a48f4dd](https://github.com/tak-bro/aicommit2/commit/a48f4ddc969cfd99384916e9c35b45d4e7958ff0))

### Features

- add new GROQ models support ([956eec1](https://github.com/tak-bro/aicommit2/commit/956eec1295ad6e80f1ace63bba07b0ccc3de3e92))

## [2.2.5](https://github.com/tak-bro/aicommit2/compare/v2.2.4...v2.2.5) (2025-03-01)

### Features

- add new Gemini models support ([d6aead7](https://github.com/tak-bro/aicommit2/commit/d6aead7ce3886ab3b19f05a4a83f425191a870b0))

## [2.2.4](https://github.com/tak-bro/aicommit2/compare/v2.2.3...v2.2.4) (2025-02-28)

### Features

- **config:** add claude-3-7-sonnet model to supported models list ([2f24e78](https://github.com/tak-bro/aicommit2/commit/2f24e780259d5633f618e1c0e83198eef63a9885))

## [2.2.3](https://github.com/tak-bro/aicommit2/compare/v2.2.2...v2.2.3) (2025-01-25)

### Features

- update supported GROQ models ([197ecfe](https://github.com/tak-bro/aicommit2/commit/197ecfeb4077fed4ebf40dec1a9ad9601398c25b))

## [2.2.2](https://github.com/tak-bro/aicommit2/compare/v2.2.1...v2.2.2) (2025-01-24)

### Bug Fixes

- update model defaults for Codestral and Mistral services ([0b6359c](https://github.com/tak-bro/aicommit2/commit/0b6359c8621a6bcc09b1b97dc4e261e3fb89585f))

### Features

- update Anthropic model list ([a4f023b](https://github.com/tak-bro/aicommit2/commit/a4f023b33f47d8c94f9cda597e90bca84bdb1b04))
- update DeepSeek supported models and default configuration ([423eb7a](https://github.com/tak-bro/aicommit2/commit/423eb7a8cb94a54eb0b91a69154ad409b91ca890))
- update default GEMINI model ([2446f96](https://github.com/tak-bro/aicommit2/commit/2446f96c80cfb4dc14aab0fd2bd64b6ec74bf21b))
- update supported Cohere models ([a8c7952](https://github.com/tak-bro/aicommit2/commit/a8c7952c38ee06647c25f6abb3bd281b252694d4))

## [2.2.1](https://github.com/tak-bro/aicommit2/compare/v2.2.0...v2.2.1) (2025-01-17)

### Bug Fixes

- improve JSON parsing for commit messages ([31fb168](https://github.com/tak-bro/aicommit2/commit/31fb1681e9eee036819992004d1c8b525575079d))
- update model name to use keyName ([e56c138](https://github.com/tak-bro/aicommit2/commit/e56c1384c0d997504e970674876bef1990d3ef55))
- validate OpenAI service config ([0624bc0](https://github.com/tak-bro/aicommit2/commit/0624bc009fce3f3029529ec595b7667335de77bc))

### Features

- add OpenAI compatible service ([c4c8aed](https://github.com/tak-bro/aicommit2/commit/c4c8aed874d82f44e14c4dc5a6aae4d82d02a71f))
- support OpenAI API compatible services ([755f2b6](https://github.com/tak-bro/aicommit2/commit/755f2b6087178f703b3e05d0637afdb82e3e1e7b))

# [2.2.0](https://github.com/tak-bro/aicommit2/compare/v2.1.11...v2.2.0) (2025-01-13)

### Bug Fixes

- prevent watch mode memory leak ([cd20e22](https://github.com/tak-bro/aicommit2/commit/cd20e226e7ec91e71cf5f0980d78e0f3cc5d9a89))

### Features

- add contributor tdabasinskas ([f74b804](https://github.com/tak-bro/aicommit2/commit/f74b8046a8cca5d5ee6410ff38e532544bc426f7))
- add watch-commit flag ([d2ed855](https://github.com/tak-bro/aicommit2/commit/d2ed85543b4a8f06d0eb59460cc08e8da019f12a))
- add watchMode ([c98b7f1](https://github.com/tak-bro/aicommit2/commit/c98b7f1c0e8ac2a443eab4fae75888e83a665e6d))
- update terminal rendering ([ce78347](https://github.com/tak-bro/aicommit2/commit/ce783478ad47b8177286249cb40b4e13182a3b8a))

## [2.1.11](https://github.com/tak-bro/aicommit2/compare/v2.1.10...v2.1.11) (2024-11-29)

## [2.1.10](https://github.com/tak-bro/aicommit2/compare/v2.1.9...v2.1.10) (2024-11-29)

### Features

- add numCtx config option for Ollama ([e64656a](https://github.com/tak-bro/aicommit2/commit/e64656a7b8ea6b5aecb2e2275454b851ee8d57ec))

## [2.1.9](https://github.com/tak-bro/aicommit2/compare/v2.1.8...v2.1.9) (2024-11-12)

### Features

- add authentication options to OLLAMA service ([75973a8](https://github.com/tak-bro/aicommit2/commit/75973a8581c3ee3a974d7490d8e885cc0bfbd928))
- **package:** add new package dependency @tak-bro/ollama ([456a29a](https://github.com/tak-bro/aicommit2/commit/456a29a8edc9dcebda7a316fd2a52bc1059545c5))

## [2.1.8](https://github.com/tak-bro/aicommit2/compare/v2.1.7...v2.1.8) (2024-10-29)

## [2.1.7](https://github.com/tak-bro/aicommit2/compare/v2.1.6...v2.1.7) (2024-10-29)

### Features

- add api key to ollama service ([47465e7](https://github.com/tak-bro/aicommit2/commit/47465e76174880d517b716501953814f8d5d8a0c))

## [2.1.6](https://github.com/tak-bro/aicommit2/compare/v2.1.5...v2.1.6) (2024-10-26)

### Features

- **anthropic:** add support for `claude-3-5-sonnet-20241022` model ([bc6eaf3](https://github.com/tak-bro/aicommit2/commit/bc6eaf38ca799480042bb403d6db61835d1bd212))
- **config:** add support for latest Claude-3 models ([46b490d](https://github.com/tak-bro/aicommit2/commit/46b490dc85eadda17969737c24920e2e1aea9ef3))

## [2.1.5](https://github.com/tak-bro/aicommit2/compare/v2.1.4...v2.1.5) (2024-10-11)

### Bug Fixes

- integrate OpenAI library for Deepseek chat completions ([83bd287](https://github.com/tak-bro/aicommit2/commit/83bd287c8f8d59c02aec29c76974b931caf96aec))

## [2.1.4](https://github.com/tak-bro/aicommit2/compare/v2.1.3...v2.1.4) (2024-09-19)

### Bug Fixes

- consider disabled models on msg-hook ([c89ece3](https://github.com/tak-bro/aicommit2/commit/c89ece340aacc461dc1e0a5daa8c81bbffae8653))

## [2.1.3](https://github.com/tak-bro/aicommit2/compare/v2.1.2...v2.1.3) (2024-09-19)

### Features

- add disabled option for models ([f56f3c0](https://github.com/tak-bro/aicommit2/commit/f56f3c0c6783098c5719916dc0cc4e7c4dc81d5d))

## [2.1.2](https://github.com/tak-bro/aicommit2/compare/v2.1.1...v2.1.2) (2024-09-13)

### Features

- update @google/generative-ai to v0.19.0 ([d3428e5](https://github.com/tak-bro/aicommit2/commit/d3428e5315e276e17264eac4c03abb829f7ba4f2))
- update groq-sdk to 0.7.0 ([025441e](https://github.com/tak-bro/aicommit2/commit/025441efb1d0e30f06c8d1b04b8e10378857fe0c))

## [2.1.1](https://github.com/tak-bro/aicommit2/compare/v2.1.0...v2.1.1) (2024-09-10)

### Bug Fixes

- **prepare-commit-msg-hook:** remove leading blank line ([60c76e4](https://github.com/tak-bro/aicommit2/commit/60c76e4cba37341caf7e56ef93fdbea1cc95be6b))

# [2.1.0](https://github.com/tak-bro/aicommit2/compare/v2.0.9...v2.1.0) (2024-09-09)

### Features

- add codeReviewPromptPath to config ([c53980f](https://github.com/tak-bro/aicommit2/commit/c53980f8db3569f9d5e1adb79c90ab6e96135335))
- **aicommit2:** add code review feature ([d672e4c](https://github.com/tak-bro/aicommit2/commit/d672e4c66539a3b7556df532fd65fad9702d7fb2))
- **minor:** support codeReview ([408d3bd](https://github.com/tak-bro/aicommit2/commit/408d3bd561711012e7005b5d1488b78ffa0a7b16))
- support language in code review prompt ([23a2446](https://github.com/tak-bro/aicommit2/commit/23a24461d040a6bb9828205da706d04359ef343f))
- update aicommit2 command file ([7b3fb88](https://github.com/tak-bro/aicommit2/commit/7b3fb88b4c22e9f6af366cb271d5f705e4ab5c1d))

## [2.0.9](https://github.com/tak-bro/aicommit2/compare/v2.0.8...v2.0.9) (2024-08-28)

### Bug Fixes

- append instructions instead of overwriting ([d4020f4](https://github.com/tak-bro/aicommit2/commit/d4020f4f53a933ae1de3838553d8dfb82e277bd4))
- correct the type of tools in HuggingFaceService ([eeb8651](https://github.com/tak-bro/aicommit2/commit/eeb8651d589d27bc855a1ddd107b3306d70a2ba8))

### Features

- support topP options ([e9be03e](https://github.com/tak-bro/aicommit2/commit/e9be03e9a226223f7730961ceacc976273197fcf))

## [2.0.8](https://github.com/tak-bro/aicommit2/compare/v2.0.7...v2.0.8) (2024-08-27)

### Features

- **gemini:** add safety settings for content moderation ([31be80c](https://github.com/tak-bro/aicommit2/commit/31be80ce7968c47a7aea92bf066bd8ed9b6e8617))

## [2.0.7](https://github.com/tak-bro/aicommit2/compare/v2.0.6...v2.0.7) (2024-08-26)

### Features

- add DeepSeekService for AI request management ([c88d1be](https://github.com/tak-bro/aicommit2/commit/c88d1be81d9d96914ad5936769d58a1b3dc12048))

## [2.0.6](https://github.com/tak-bro/aicommit2/compare/v2.0.5...v2.0.6) (2024-08-24)

### Features

- update supported models for groq. ([dd4488e](https://github.com/tak-bro/aicommit2/commit/dd4488ef8fadf21a9e6d49a23924bb14a5ffd057))

## [2.0.5](https://github.com/tak-bro/aicommit2/compare/v2.0.4...v2.0.5) (2024-08-22)

## [2.0.4](https://github.com/tak-bro/aicommit2/compare/v2.0.3...v2.0.4) (2024-08-19)

### Features

- update OpenAI model to gpt-4o-mini ([0b86a69](https://github.com/tak-bro/aicommit2/commit/0b86a6928ab26561ae7d6e5b6c63a0593ed94c57))

## [2.0.3](https://github.com/tak-bro/aicommit2/compare/v2.0.2...v2.0.3) (2024-08-16)

### Features

- add topP configuration for Mistral, Codestral, and Perplexity AI services ([e2e873a](https://github.com/tak-bro/aicommit2/commit/e2e873aad459b12a179bce7145ca755fc2405baf))

## [2.0.2](https://github.com/tak-bro/aicommit2/compare/v2.0.1...v2.0.2) (2024-08-16)

### Features

- add topP configuration for OPENAI model ([959687a](https://github.com/tak-bro/aicommit2/commit/959687a3b1b9ca4b08bb989ba52eb4e6602201c0))

## [2.0.1](https://github.com/tak-bro/aicommit2/compare/v2.0.0...v2.0.1) (2024-08-15)

### Features

- add exclude option ([ba7a73f](https://github.com/tak-bro/aicommit2/commit/ba7a73fb393960931ddfa4731228ce21a7172f5e))

# [2.0.0](https://github.com/tak-bro/aicommit2/compare/v1.13.0...v2.0.0) (2024-08-13)

### Bug Fixes

- add model name check to config command ([23a11df](https://github.com/tak-bro/aicommit2/commit/23a11df3045e2e2bca86d826137d4c65668f9fbc))
- fix ignoreBody config ([1faf9bd](https://github.com/tak-bro/aicommit2/commit/1faf9bdd6754a6390c294849e280f71f04a41057))
- fix typo ([e911583](https://github.com/tak-bro/aicommit2/commit/e9115835906e11bc7bae7dd5c6ecfc60483fbc6d))
- **mistral:** update model type check and error message ([2ea3c84](https://github.com/tak-bro/aicommit2/commit/2ea3c84237ab92d5cedc1772d57f1c44d7643abf))

### Features

- update configuration ([3ff61b8](https://github.com/tak-bro/aicommit2/commit/3ff61b8df8cbbc14c2e8e7d2aabdaa46db9578f9))
- update perplexity service ([ef423b3](https://github.com/tak-bro/aicommit2/commit/ef423b3e729593d31cf144ac59f83d98f33eae78))
- update template ([db1c82d](https://github.com/tak-bro/aicommit2/commit/db1c82d53305e1015800e69661bfd71934dc7df5))

# [1.13.0](https://github.com/tak-bro/aicommit2/compare/v1.12.6...v1.13.0) (2024-08-11)

## [1.12.6](https://github.com/tak-bro/aicommit2/compare/v1.12.5...v1.12.6) (2024-08-11)

### Features

- add support for Perplexity AI service ([cf76e77](https://github.com/tak-bro/aicommit2/commit/cf76e774f6d84755164386b0567a12d99bc3ec38))

## [1.12.5](https://github.com/tak-bro/aicommit2/compare/v1.12.4...v1.12.5) (2024-08-06)

### Bug Fixes

- **config:** update major models ([eabf16e](https://github.com/tak-bro/aicommit2/commit/eabf16ede721f8db2cc674bb5f29b56085f5e1a3))

## [1.12.4](https://github.com/tak-bro/aicommit2/compare/v1.12.3...v1.12.4) (2024-08-01)

## [1.12.3](https://github.com/tak-bro/aicommit2/compare/v1.12.2...v1.12.3) (2024-07-18)

### Bug Fixes

- remove unnecessary parameters from finalPrompt function ([fb1b652](https://github.com/tak-bro/aicommit2/commit/fb1b65247013fe41b7d51eb7afe0398d38888028))

## [1.12.2](https://github.com/tak-bro/aicommit2/compare/v1.12.1...v1.12.2) (2024-07-18)

### Features

- add language option to prompt generator ([0b3d110](https://github.com/tak-bro/aicommit2/commit/0b3d1100ef72fedd8565eed7b57f569b8b814a06))

## [1.12.1](https://github.com/tak-bro/aicommit2/compare/v1.12.0...v1.12.1) (2024-07-18)

# [1.12.0](https://github.com/tak-bro/aicommit2/compare/v1.11.1...v1.12.0) (2024-07-18)

### Bug Fixes

- handle stream errors ([0826464](https://github.com/tak-bro/aicommit2/commit/082646469bde184531528f10eeba8bcd83757d02))
- **prompt:** handle error reading user prompt file ([4173fad](https://github.com/tak-bro/aicommit2/commit/4173fadfb27da264d91dabbeeae730a7ab34e091))

### Features

- allow users to specify custom prompt templates ([3d68cfe](https://github.com/tak-bro/aicommit2/commit/3d68cfededa85a194f2e71b6c414c54baf8eb89f))

## [1.11.1](https://github.com/tak-bro/aicommit2/compare/v1.11.0...v1.11.1) (2024-07-17)

### Features

- update hugging face service ([e3bebb7](https://github.com/tak-bro/aicommit2/commit/e3bebb738df4e8c6b003be1b9bf30d85c1437d53))

# [1.11.0](https://github.com/tak-bro/aicommit2/compare/v1.10.1...v1.11.0) (2024-07-16)

### Bug Fixes

- **package:** upgrade inquirer-reactive-list-prompt version ([99d12be](https://github.com/tak-bro/aicommit2/commit/99d12be73049f3aea38ce1af8dd85df5d650780e))

### Features

- add ignoreBody configuration option ([825dafb](https://github.com/tak-bro/aicommit2/commit/825dafb3b64a7acc7e17529170b7fd6c53a9db68))
- add ignoreBody option ([b25c452](https://github.com/tak-bro/aicommit2/commit/b25c452dad9351f0b56eed049d91f0936bb4e474))
- improve message sanitization ([14b1ef5](https://github.com/tak-bro/aicommit2/commit/14b1ef5231660f8e364ac6fddaa91db008aa631d))
- remove clova x support ([af839bd](https://github.com/tak-bro/aicommit2/commit/af839bd2be473c6ceb1be95b4a425096450cd248))
- update prompt message for clarity ([b74a8c4](https://github.com/tak-bro/aicommit2/commit/b74a8c4cf54f13e0e143f44207f7f2d79d146cf5))

## [1.10.1](https://github.com/tak-bro/aicommit2/compare/v1.10.0...v1.10.1) (2024-07-01)

### Bug Fixes

- update dependencies to address compatibility issues ([1fcf318](https://github.com/tak-bro/aicommit2/commit/1fcf3189a4d461d9718d98616add58d5d41ed400))

# [1.10.0](https://github.com/tak-bro/aicommit2/compare/v1.9.10...v1.10.0) (2024-07-01)

### Bug Fixes

- **minor:** hotfix for inquirer error ([35e5556](https://github.com/tak-bro/aicommit2/commit/35e5556f221b1a7864c2ce126f305341e86b5477))

## [1.9.10](https://github.com/tak-bro/aicommit2/compare/v1.9.9...v1.9.10) (2024-06-30)

### Bug Fixes

- update selection logic based on CODESTRAL_MODEL ([27541b7](https://github.com/tak-bro/aicommit2/commit/27541b7232be91c55f6d316f5480270b0115b28e))

### Features

- implement Codestral service ([5f72689](https://github.com/tak-bro/aicommit2/commit/5f72689c2cf9391f9b62d201048c91b9efd6b64a))

## [1.9.9](https://github.com/tak-bro/aicommit2/compare/v1.9.8...v1.9.9) (2024-06-30)

### Bug Fixes

- **config:** update default Gemini model [#47](https://github.com/tak-bro/aicommit2/issues/47) ([63dfc40](https://github.com/tak-bro/aicommit2/commit/63dfc40e23172b0bb670b966b967bdf485485a17))

### Features

- add Codestral support in MistralService ([d54be92](https://github.com/tak-bro/aicommit2/commit/d54be9212490ece0d45b6d418a6c0e874f5bf392))

## [1.9.8](https://github.com/tak-bro/aicommit2/compare/v1.9.7...v1.9.8) (2024-06-28)

### Bug Fixes

- **config:** update default Gemini model ([db0ea19](https://github.com/tak-bro/aicommit2/commit/db0ea19c8fbd3dde46ea1634d756b889b9c42019))

## [1.9.7](https://github.com/tak-bro/aicommit2/compare/v1.9.6...v1.9.7) (2024-06-10)

### Features

- implement GroqService for Groq AI ([8c4ad8c](https://github.com/tak-bro/aicommit2/commit/8c4ad8cd7a0595c412e63e51cfd164dff1a0590b))

## [1.9.6](https://github.com/tak-bro/aicommit2/compare/v1.9.5...v1.9.6) (2024-06-09)

## [1.9.5](https://github.com/tak-bro/aicommit2/compare/v1.9.4...v1.9.5) (2024-06-04)

### Bug Fixes

- update logging in ParallelOllamaService to include model information ([2ad9f76](https://github.com/tak-bro/aicommit2/commit/2ad9f760988e8d60aab2c36cc80057cd08081432))

### Features

- add ParallelOllamaService ([5a13ce3](https://github.com/tak-bro/aicommit2/commit/5a13ce38d9eb83a5d410b04953e326c0981b53f6))
- support multiple Ollama models ([cb865d9](https://github.com/tak-bro/aicommit2/commit/cb865d93284034ee705a7601d3309d906e6466f8))
- update OllamaService to support multiple models ([7103f03](https://github.com/tak-bro/aicommit2/commit/7103f0338de726f7267d115acb95487e08ac884b))

## [1.9.4](https://github.com/tak-bro/aicommit2/compare/v1.9.3...v1.9.4) (2024-06-03)

### Bug Fixes

- update gitmoji regular expression ([e8a3d36](https://github.com/tak-bro/aicommit2/commit/e8a3d368fd0333870a15e7d6ce37b059d6e8e562))

## [1.9.3](https://github.com/tak-bro/aicommit2/compare/v1.9.2...v1.9.3) (2024-06-02)

### Features

- implement removeAll command to delete all log files ([20b7fa8](https://github.com/tak-bro/aicommit2/commit/20b7fa8c5f6d0ade5eb4d289908c638e253d388a))
- updated commit message format description ([15e6a38](https://github.com/tak-bro/aicommit2/commit/15e6a3844faea310d41af7d527da763f9f5f6ac1))

## [1.9.2](https://github.com/tak-bro/aicommit2/compare/v1.9.1...v1.9.2) (2024-05-31)

### ✨ Features

- add Cohere AI service ([34f2d7e](https://github.com/tak-bro/aicommit2/commit/34f2d7e56419e01d76a2ef5087631785b11cd6ed))

### 💫 CI/CD

- add no response issue workflow ([c017ec4](https://github.com/tak-bro/aicommit2/commit/c017ec41317516c820540a7755bc48a1c1e703ed))
- add no-response-issues workflow ([16aac67](https://github.com/tak-bro/aicommit2/commit/16aac675ad2b1e3d85819bd5d60ef20926a9cb3a))
- add stale_issues.yml workflow ([0b718e8](https://github.com/tak-bro/aicommit2/commit/0b718e85368702b5e5c3696bf1b3d84e0c1a8c3d))

### 📦 Chores

- add scheduled job for no response issues ([e2f0a74](https://github.com/tak-bro/aicommit2/commit/e2f0a74cf0835d244ba1ca4ea098632c7eb96a1c))

## [1.9.1](https://github.com/tak-bro/aicommit2/compare/v1.9.0...v1.9.1) (2024-05-27)

### ✨ Features

- **gemini:** update default Gemini model to 'gemini-1.5-flash-latest' ([9e50f5e](https://github.com/tak-bro/aicommit2/commit/9e50f5e15822e10f0bbdb052a8f71905c2e0bf13))

### 🐛 Bug Fixes

- validate against all config parsers ([193d68c](https://github.com/tak-bro/aicommit2/commit/193d68c34eea806b07f5c92ebc105f4ed6e36613))

### ♻️ Refactor

- add generalConfigParsers ([8ebb2fe](https://github.com/tak-bro/aicommit2/commit/8ebb2fe29f6cf871a5f89f9995451406754db468))

## [1.9.0](https://github.com/tak-bro/aicommit2/compare/v1.8.7...v1.9.0) (2024-05-24)

### ✨ Features

- add error logging to check ai response ([d050a81](https://github.com/tak-bro/aicommit2/commit/d050a81caf7ff3c708669df6418a3f2a1bedc698))
- update log file name and content format ([9777072](https://github.com/tak-bro/aicommit2/commit/9777072e9de5a03a2355a22439509bf8b8c74ce7))
- update log message to include prompt ([47f3c5f](https://github.com/tak-bro/aicommit2/commit/47f3c5fd2c7e0c2e7efb11500040e0f511d6d47d))

### 🐛 Bug Fixes

- correct the generateDefaultPrompt function ([fc0aa0c](https://github.com/tak-bro/aicommit2/commit/fc0aa0cfea918f1d96135cf82d87143218f190d0))

### ♻️ Refactor

- improve regular expression pattern to check message loosely ([d527fa4](https://github.com/tak-bro/aicommit2/commit/d527fa4198c6d64ae593e3717bceb4fd4f7b72a8))

### 💫 CI/CD

- **minor:** update release configuration ([461c0fd](https://github.com/tak-bro/aicommit2/commit/461c0fdcd92bef5f095850a2fadf209a5f48006a))

### 📦 Chores

- update logging logic for OllamaService ([7b346ec](https://github.com/tak-bro/aicommit2/commit/7b346ec8fe29c451e6ba2c11a5423418995b5e2a))
- update logging mechanism ([ad06ac1](https://github.com/tak-bro/aicommit2/commit/ad06ac1200f8670cdcdbb0fafc5ff7ecd040cf14))

## [1.8.7](https://github.com/tak-bro/aicommit2/compare/v1.8.6...v1.8.7) (2024-05-22)

### ✨ Features

- correct prompt message for generating commit messages ([2c4f854](https://github.com/tak-bro/aicommit2/commit/2c4f8545f3cc7aa307b82752b650aaa1ac8e4cd8))
- update prompt and commit type format messages ([447ce8a](https://github.com/tak-bro/aicommit2/commit/447ce8aa0879a130a7b02393842ec3e6841c6d6a))

### 📦 Chores

- remove keep_alive option from OllamaService ([4879337](https://github.com/tak-bro/aicommit2/commit/4879337a9c6076ca6352f1638e5b409e62ea1d21))
- update prompt for commit message guidelines ([4121875](https://github.com/tak-bro/aicommit2/commit/41218754896e0d2594a1ac0ddac57a2ead7d4d6b))

## [1.8.6](https://github.com/tak-bro/aicommit2/compare/v1.8.5...v1.8.6) (2024-05-16)

### ♻️ Refactor

- replace localhost url with default constant and add DEFAULT_OLLMA_HOST to config.ts ([76b9d00](https://github.com/tak-bro/aicommit2/commit/76b9d00fdebc2fbbabfc92d8976bf9b7bf5cc30a))

## [1.8.5](https://github.com/tak-bro/aicommit2/compare/v1.8.4...v1.8.5) (2024-05-08)

### ✨ Features

- improved OllamaService with configurable prompt and temperature ([c200906](https://github.com/tak-bro/aicommit2/commit/c20090638067e2309921658e69f9c00eae1041e0))
- simplify prompt generation and update buildPrompt method ([6c39016](https://github.com/tak-bro/aicommit2/commit/6c390168746c4e9e71c76fbe523d6b88826d91bb))

### 🐛 Bug Fixes

- correct prompt format ([2b258f1](https://github.com/tak-bro/aicommit2/commit/2b258f1d06a9c89795180031f103f205213369af))
- **prompt:** fix generatePrompt function to accept additionalPrompts ([d42507d](https://github.com/tak-bro/aicommit2/commit/d42507da601b474729ce457c5abd527dd2e55081))

### 📝 Docs

- update badges ([c765a64](https://github.com/tak-bro/aicommit2/commit/c765a64b187abd1e87f20c6694ffe77b3583bf3e))
- update documentation for Ollama model, host, and stream ([6750db1](https://github.com/tak-bro/aicommit2/commit/6750db18558ed55f3ea2f26fe33d6c9defd13956))
- update README ([fdb080b](https://github.com/tak-bro/aicommit2/commit/fdb080bbae2951ef280f87acd5cfb8f76191bacb))
- update README ([b9c2c73](https://github.com/tak-bro/aicommit2/commit/b9c2c73bb8edf8eb6dbdbb676f0cad7e1b2037f5))
- update README.md with new links and images ([3e9f87e](https://github.com/tak-bro/aicommit2/commit/3e9f87e1f1061566114ffd0d9f925db9491c7340))

### 📦 Chores

- rollback code for ollama service ([721710c](https://github.com/tak-bro/aicommit2/commit/721710cccb17154f9e7ad4df9d46b62ca296e339))

## [1.8.4](https://github.com/tak-bro/aicommit2/compare/v1.8.3...v1.8.4) (2024-05-04)

### ✨ Features

- **anthropic:** add temperature parameter to Anthropic API call ([ca32486](https://github.com/tak-bro/aicommit2/commit/ca32486357f9ace726419153a3ad8c7da3645995))
- support claude3 models ([c4985b8](https://github.com/tak-bro/aicommit2/commit/c4985b886461e793d370f9539ee1eb12072182b2))

### 📝 Docs

- update Anthropic model default in README ([09db772](https://github.com/tak-bro/aicommit2/commit/09db7726bd099b5e1178a6590276cab9ea551d17))

## [1.8.3](https://github.com/tak-bro/aicommit2/compare/v1.8.2...v1.8.3) (2024-04-30)

### ✨ Features

- update supported models in HuggingFace ([6ceb341](https://github.com/tak-bro/aicommit2/commit/6ceb3410716d5288852eae8ce1a51ab6842a0398))

### 📝 Docs

- clarify stream request option ([8cacb2a](https://github.com/tak-bro/aicommit2/commit/8cacb2a65048624a09edb61b7e37170dc1c9cd64))
- **README:** update introduction and features ([e0682dd](https://github.com/tak-bro/aicommit2/commit/e0682ddc7b4e2eba919a0dd2e767625d43caa9d5))

## [1.8.2](https://github.com/tak-bro/aicommit2/compare/v1.8.1...v1.8.2) (2024-04-21)

### 💫 CI/CD

- add semantic-release npm plugin to release config ([2b756c8](https://github.com/tak-bro/aicommit2/commit/2b756c8cf9ca5770a270d3d76ef0e072fa7846bb))

### 📦 Chores

- update prompt to include commit type ([fd5647a](https://github.com/tak-bro/aicommit2/commit/fd5647ab8490adadd43cc8ea13345f55c20fe0d0))

## [1.8.1](https://github.com/tak-bro/aicommit2/compare/v1.8.0...v1.8.1) (2024-04-20)

### 📝 Docs

- **README:** update README ([8bf9d4f](https://github.com/tak-bro/aicommit2/commit/8bf9d4f741a1169c35bd00b1bf5aaa36e88c056f))
- **README:** update README ([c617056](https://github.com/tak-bro/aicommit2/commit/c6170561c928074483d48247c3801a22afbd5c27))

### 💫 CI/CD

- **release:** update semantic release plugins and config ([9c4f7ee](https://github.com/tak-bro/aicommit2/commit/9c4f7ee07dd3400f018406e2a146a8346e40706a))
