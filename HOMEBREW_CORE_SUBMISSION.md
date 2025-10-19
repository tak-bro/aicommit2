# Homebrew Core 제출 가이드

이 문서는 aicommit2를 homebrew-core (공식 저장소)에 제출하는 방법을 설명합니다.

## 🎯 목표

사용자가 tap 없이 설치할 수 있도록:
```bash
brew install aicommit2  # tap 없이!
```

## ⚠️ 제출 시기

**지금 당장 제출하지 마세요!** 다음 조건을 충족한 후 제출하는 것을 권장합니다:

- [ ] GitHub stars 100+ (또는 충분한 인지도)
- [ ] npm 주간 다운로드 1,000+
- [ ] third-party tap에서 충분히 테스트됨
- [ ] 안정적인 버전 (major version 1.0+)
- [ ] 활발한 개발 및 유지보수

**권장**: 먼저 `tak-bro/homebrew-aicommit2` tap으로 배포하고, 사용자 피드백을 받은 후 제출

---

## 📋 요구사항 체크리스트

### 필수 요구사항

- [x] **오픈소스 라이선스**: MIT ✅
- [x] **안정적인 릴리스**: Semantic versioning 사용 ✅
- [x] **크로스 플랫폼**: Node.js 기반 (macOS, Linux) ✅
- [x] **CLI 도구**: GUI 아님 ✅
- [ ] **Notable project**: GitHub stars, npm 다운로드 등
- [ ] **자체 업데이트 없음**: Homebrew가 관리

### 거부되는 경우

- ❌ Beta/alpha/RC 버전
- ❌ GUI 애플리케이션 (Cask로 제출해야 함)
- ❌ 자체 업데이트 기능 있음
- ❌ 잘 알려지지 않은 프로젝트
- ❌ 라이선스 문제

---

## 🔍 Step 1: 로컬 테스트

제출 전에 **반드시** 로컬에서 테스트해야 합니다.

### 1.1 Homebrew Core Tap 활성화

```bash
# API 사용 비활성화 (로컬 Formula 테스트용)
HOMEBREW_NO_INSTALL_FROM_API=1 brew tap --force homebrew/core

# Core 저장소 경로 확인
cd $(brew --repository homebrew/core)
pwd
# 출력: /opt/homebrew/Library/Taps/homebrew/homebrew-core
```

### 1.2 Formula 생성

```bash
# npm tarball URL로 Formula 자동 생성
brew create https://registry.npmjs.org/aicommit2/-/aicommit2-2.4.11.tgz

# 생성된 파일 경로
# /opt/homebrew/Library/Taps/homebrew/homebrew-core/Formula/aicommit2.rb
```

### 1.3 Formula 편집

```bash
brew edit aicommit2
```

다음 내용으로 수정:

```ruby
class Aicommit2 < Formula
  desc "Reactive CLI that generates commit messages for Git and Jujutsu with AI"
  homepage "https://github.com/tak-bro/aicommit2"
  url "https://registry.npmjs.org/aicommit2/-/aicommit2-2.4.11.tgz"
  sha256 "f70af3cebb289fbc83ef04adad59be45014e2c068de0a6b52328e831daaf330e"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink Dir["#{libexec}/bin/*"]
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/aicommit2 --version")
    assert_match "aicommit2", shell_output("#{bin}/aic2 --help")
  end
end
```

### 1.4 빌드 및 테스트

```bash
# 소스에서 빌드
brew install --build-from-source aicommit2

# 설치 확인
aicommit2 --version
aic2 --help

# 테스트 실행
brew test aicommit2

# Audit 실행 (엄격 모드)
brew audit --new --strict aicommit2

# 정리
brew uninstall aicommit2
```

**모든 테스트가 통과해야 PR 제출 가능!**

---

## 📤 Step 2: PR 제출

### 2.1 Homebrew Core Fork

1. https://github.com/Homebrew/homebrew-core
2. "Fork" 버튼 클릭
3. `YOUR_USERNAME/homebrew-core` 생성됨

### 2.2 로컬 설정

```bash
# Core 저장소로 이동
cd $(brew --repository homebrew/core)

# Fork 추가
git remote add YOUR_USERNAME https://github.com/YOUR_USERNAME/homebrew-core.git

# 최신 상태로 업데이트
git fetch origin
git checkout master
git pull origin master
```

### 2.3 브랜치 생성 및 Formula 추가

```bash
# 브랜치 생성
git checkout -b aicommit2

# Formula 추가 (이미 편집한 파일 사용)
git add Formula/aicommit2.rb

# Commit (명명 규칙 중요!)
git commit -m "aicommit2 2.4.11 (new formula)"

# Push
git push YOUR_USERNAME aicommit2
```

### 2.4 Pull Request 생성

1. GitHub에서 fork 저장소로 이동
2. "Compare & pull request" 클릭
3. Base repository: `Homebrew/homebrew-core`
4. Base branch: `master`
5. Head repository: `YOUR_USERNAME/homebrew-core`
6. Compare branch: `aicommit2`

---

## 📝 Step 3: PR 템플릿

### Title
```
aicommit2 2.4.11 (new formula)
```

### Description

```markdown
# aicommit2 2.4.11

A Reactive CLI that generates commit messages for Git and Jujutsu with AI.

## Package Information
- **License**: MIT
- **Homepage**: https://github.com/tak-bro/aicommit2
- **Source**: npm registry
- **Dependencies**: node

## Verification
- [x] Built from source on macOS (Intel)
- [x] Built from source on macOS (Apple Silicon)
- [x] Built from source on Linux (x86_64)
- [x] `brew test` passes
- [x] `brew audit --new --strict` passes with no errors
- [x] Binary works: `aicommit2 --version`
- [x] Alias works: `aic2 --help`

## Project Metrics
- npm: https://www.npmjs.com/package/aicommit2
- npm weekly downloads: [INSERT_NUMBER]
- GitHub stars: [INSERT_NUMBER]
- Active development: [link to recent commits]

## Additional Notes
- Supports multiple AI providers (OpenAI, Claude, Gemini, etc.)
- Works with both Git and Jujutsu VCS
- Well-documented and actively maintained
```

---

## 🔍 Step 4: 리뷰 과정

### 자동 검증

PR 생성 후 자동으로:
- ✅ CI/CD 테스트 실행
- ✅ 다양한 플랫폼에서 빌드
- ✅ Style 체크
- ✅ Audit 실행

### Maintainer 리뷰

Homebrew maintainer가 확인:
1. **Formula 품질**
   - Naming convention
   - Dependencies
   - Test coverage

2. **프로젝트 Notable 여부**
   - GitHub stars
   - npm 다운로드
   - 커뮤니티 활동

3. **라이선스 및 법적 이슈**

4. **크로스 플랫폼 지원**

### 일반적인 피드백

예상되는 피드백과 대응:

**"Test block needs improvement"**
→ 더 의미있는 테스트 추가

```ruby
test do
  # Better test
  system bin/"aicommit2", "config", "get"
  assert_match "aicommit2", shell_output("#{bin}/aic2 --help")
end
```

**"Not notable enough"**
→ npm 다운로드, GitHub stars 증거 제시

**"Description too long"**
→ 60자 이하로 축약

---

## ✅ Step 5: 승인 후

### 머지되면

1. **24시간 이내** 전 세계 사용자가 설치 가능:
   ```bash
   brew install aicommit2
   ```

2. **Bottle 빌드** 자동 시작:
   - macOS x86_64
   - macOS arm64
   - Linux x86_64

3. **Bottle 완료 후** 더 빠른 설치 (바이너리)

### 업데이트 프로세스

새 버전 릴리스 시:

```bash
# 1. Core 저장소 업데이트
cd $(brew --repository homebrew/core)
git checkout master
git pull origin master

# 2. 브랜치 생성
git checkout -b aicommit2-2.5.0

# 3. Formula 업데이트
brew bump-formula-pr aicommit2 \
  --url=https://registry.npmjs.org/aicommit2/-/aicommit2-2.5.0.tgz \
  --sha256=NEW_SHA256

# 4. 자동으로 PR 생성됨
```

**또는**: homebrew/core의 자동 업데이트 봇이 감지하여 PR 생성

---

## 📊 비교: Third-party Tap vs Core

| 항목 | Third-party Tap | Homebrew Core |
|------|-----------------|---------------|
| **설치 명령어** | `brew install tak-bro/aicommit2` | `brew install aicommit2` |
| **제출 시간** | 즉시 (push만) | 1-7일 (리뷰) |
| **업데이트** | 자동 (CI/CD) | PR 필요 |
| **제어권** | 완전 | 제한적 |
| **노출** | 낮음 | 높음 |
| **신뢰도** | 보통 | 높음 |
| **유지보수** | 쉬움 | 복잡 |

---

## 🎯 권장 전략

### Phase 1: Third-party Tap (지금!)

```bash
# homebrew-aicommit2 push
cd /Users/tak/workspace/tak-bro/homebrew-aicommit2
git push origin main
```

사용자에게 제공:
```bash
brew install tak-bro/aicommit2
```

### Phase 2: 성장 및 안정화 (6개월~1년)

- GitHub stars 증가
- npm 다운로드 증가
- 사용자 피드백 수집
- 버그 수정 및 안정화

### Phase 3: Homebrew Core 제출 (준비되면)

이 가이드를 따라 PR 제출

### Phase 4: 두 가지 동시 지원

- Third-party tap: 빠른 업데이트
- Homebrew core: 안정적인 버전

---

## 🔗 참고 자료

- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Homebrew Acceptable Formulae](https://docs.brew.sh/Acceptable-Formulae)
- [How to Open a PR](https://docs.brew.sh/How-To-Open-a-Homebrew-Pull-Request)
- [Node.js Formula Examples](https://github.com/Homebrew/homebrew-core/blob/master/Formula/)

---

## 💡 Tips

1. **Test block을 강화하세요**
   - 단순 `--version`보다 실제 기능 테스트

2. **Description은 간결하게**
   - 60자 이하 권장

3. **Notable 증거 준비**
   - npm stats 스크린샷
   - GitHub insights

4. **피드백에 빠르게 대응**
   - Maintainer의 요청을 24시간 내 처리

5. **인내심**
   - 리뷰는 며칠 걸릴 수 있음
   - 거부당해도 괜찮음 (개선 후 재제출)

---

**Note**: homebrew-core 제출은 선택사항입니다. third-party tap만으로도 충분히 사용자에게 서비스할 수 있습니다!
