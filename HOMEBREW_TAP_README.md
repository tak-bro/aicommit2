# Homebrew Tap for aicommit2

This is the official Homebrew tap for [aicommit2](https://github.com/tak-bro/aicommit2) - a Reactive CLI that generates commit messages for Git and Jujutsu with AI.

## Installation

```bash
# Install directly in one command
brew install tak-bro/aicommit2

# Or add tap first, then install
brew tap tak-bro/aicommit2
brew install aicommit2
```

## Verify Installation

```bash
# Check version
aicommit2 --version

# Both commands are available
aic2 --help
```

## Usage

After installation, you need to configure at least one AI provider:

```bash
# Set up API key (example with OpenAI)
aicommit2 config set OPENAI.key=<your-key>

# Use in your Git repository
cd your-project
git add .
aicommit2
```

## Documentation

For complete documentation, configuration options, and supported AI providers, visit:
- **Main Repository**: https://github.com/tak-bro/aicommit2
- **Documentation**: https://github.com/tak-bro/aicommit2#readme

## Updating

```bash
# Update the tap
brew update

# Upgrade aicommit2
brew upgrade aicommit2
```

## Troubleshooting

### Installation Issues

If you encounter installation issues:

```bash
# Uninstall and reinstall
brew uninstall aicommit2
brew untap tak-bro/aicommit2
brew tap tak-bro/aicommit2
brew install aicommit2
```

### Node.js Dependency

aicommit2 requires Node.js v18 or higher. If you get Node.js related errors:

```bash
# Check Node version
node --version

# Install/update Node via Homebrew
brew install node
```

## Alternative Installation Methods

If Homebrew doesn't work for you, aicommit2 is also available via:

- **npm**: `npm install -g aicommit2`
- **Nix**: `nix profile install github:tak-bro/aicommit2`
- **From Source**: See [main repository](https://github.com/tak-bro/aicommit2#from-source)

## Support

- **Issues**: https://github.com/tak-bro/aicommit2/issues
- **Discussions**: https://github.com/tak-bro/aicommit2/discussions

## License

MIT - See [LICENSE](https://github.com/tak-bro/aicommit2/blob/main/LICENSE)

---

**Note**: This tap is automatically updated when new versions of aicommit2 are released.



📝 요약

🎯 Homebrew Core PR 제출 프로세스

1단계: 준비 (지금은 건너뛰기 권장!)
- GitHub stars 100+
- npm 주간 다운로드 1,000+
- 안정적인 버전

2단계: 로컬 테스트 (필수!)
brew create https://registry.npmjs.org/aicommit2/-/aicommit2-2.4.11.tgz
brew install --build-from-source aicommit2
brew test aicommit2
brew audit --new --strict aicommit2

3단계: PR 제출
# Homebrew/homebrew-core fork
cd $(brew --repository homebrew/core)
git checkout -b aicommit2
git add Formula/aicommit2.rb
git commit -m "aicommit2 2.4.11 (new formula)"
git push YOUR_USERNAME aicommit2
# PR 생성

4단계: 리뷰 (1-7일)
- CI 자동 테스트
- Maintainer 리뷰
- 피드백 대응

5단계: 승인 후
- 사용자가 brew install aicommit2 가능!

📋 제출 전 체크리스트

- brew audit --new --strict 통과
- brew test 통과
- macOS (Intel + Apple Silicon) 빌드 성공
- Linux x86_64 빌드 성공
- GitHub stars 충분
- npm 다운로드 충분
- 활발한 개발

💡 권장 전략

지금: Third-party tap 사용
brew install tak-bro/aicommit2

나중: 인기 얻은 후 homebrew-core 제출
brew install aicommit2

상세 가이드: HOMEBREW_CORE_SUBMISSION.md 파일 참조
