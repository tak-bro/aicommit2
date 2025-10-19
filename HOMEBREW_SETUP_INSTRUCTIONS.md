# Homebrew Setup Instructions

This document provides step-by-step instructions for completing the Homebrew integration for aicommit2.

## ✅ Completed Tasks

The following files have been created in this repository:

1. **Formula/aicommit2.rb** - The Homebrew formula for aicommit2
2. **.github/workflows/update_homebrew.yml** - Automated workflow to update the formula on releases
3. **README.md** - Updated with Homebrew installation instructions and badge
4. **HOMEBREW_TAP_README.md** - README content for the tap repository

## 📋 Next Steps

### Step 1: Set Up the Tap Repository

You've already created https://github.com/tak-bro/homebrew-aicommit2. Now:

1. **Copy the formula file:**
   ```bash
   # From this repository
   cp Formula/aicommit2.rb /path/to/homebrew-aicommit2/Formula/
   ```

2. **Copy the README:**
   ```bash
   # Use HOMEBREW_TAP_README.md as the tap's README
   cp HOMEBREW_TAP_README.md /path/to/homebrew-aicommit2/README.md
   ```

3. **Initialize the tap structure:**
   ```bash
   cd /path/to/homebrew-aicommit2
   mkdir -p Formula
   # Move/copy files as needed
   git add .
   git commit -m "feat: initial Homebrew formula for aicommit2"
   git push origin main
   ```

### Step 2: Verify GitHub Token

**✅ Already configured!**

This project already uses the `PAT_TOKEN` secret for:
- Nix update workflow
- Release workflow
- **Homebrew workflow (reuses the same token)**

No additional token creation or secret configuration needed! 🎉

### Step 3: Test the Setup

#### Option A: Manual Workflow Trigger (Recommended)

1. **Go to:** https://github.com/tak-bro/aicommit2/actions/workflows/update_homebrew.yml
2. **Click:** "Run workflow"
3. **Select:** main branch
4. **Run workflow**
5. **Monitor:** Check if the workflow completes successfully
6. **Verify:** A PR should be created in the tap repository

#### Option B: Wait for Next Release

The workflow will automatically trigger when semantic-release creates a new release.

### Step 4: Test Local Installation

Once the formula is in the tap repository:

```bash
# Add the tap
brew tap tak-bro/aicommit2

# Install aicommit2
brew install --build-from-source aicommit2

# Test the installation
aicommit2 --version
aic2 --help

# Run audit
brew audit --strict aicommit2

# Run tests
brew test aicommit2

# Cleanup test
brew uninstall aicommit2
brew untap tak-bro/aicommit2
```

## 🔍 Verification Checklist

- [ ] Formula file exists in `homebrew-aicommit2/Formula/aicommit2.rb`
- [ ] README exists in `homebrew-aicommit2/README.md`
- [x] `PAT_TOKEN` secret already configured (reused from Nix workflow)
- [ ] Workflow completes successfully (manual or automatic)
- [ ] PR is created in tap repository with correct version and SHA256
- [ ] Local installation works: `brew install tak-bro/aicommit2`
- [ ] Both `aicommit2` and `aic2` commands are available
- [ ] `brew test aicommit2` passes
- [ ] `brew audit --strict aicommit2` passes with no errors

## 📊 File Reference

### Main Repository Files

**Formula/aicommit2.rb** (temporary, will be moved to tap):
- Version: 2.4.11
- SHA256: `f70af3cebb289fbc83ef04adad59be45014e2c068de0a6b52328e831daaf330e`
- Dependencies: node
- Binaries: aicommit2, aic2

**.github/workflows/update_homebrew.yml**:
- Trigger: `release.published` and `workflow_dispatch`
- Action: `mislav/bump-homebrew-formula-action@v3`
- Formula: `aicommit2`
- Tap: `tak-bro/homebrew-aicommit2`

**README.md** additions:
- Homebrew badge in header
- Installation section after Nix section
- Link from badge to installation section

## 🚀 Automation Flow

Once everything is set up, the automatic update flow will be:

1. **Developer pushes to main** → Triggers `release.yml`
2. **semantic-release analyzes commits** → Determines new version
3. **semantic-release publishes to npm** → Creates GitHub release
4. **GitHub release published event** → Triggers `update_homebrew.yml`
5. **update_homebrew.yml runs** → Downloads tarball, calculates SHA256
6. **mislav/bump-homebrew-formula-action** → Creates PR in tap repository
7. **Manual review/merge** → Formula updated in tap
8. **Users run `brew upgrade`** → Get latest version

## 🐛 Troubleshooting

### Workflow fails with "COMMITTER_TOKEN not found"
- Ensure the `PAT_TOKEN` secret exists in the repository
- Verify the token has `public_repo` and `workflow` scopes

### Formula audit fails
- Check that the SHA256 matches the npm tarball
- Verify the URL follows the pattern: `https://registry.npmjs.org/aicommit2/-/aicommit2-{VERSION}.tgz`

### Installation fails with node error
- Ensure `depends_on "node"` is in the formula
- Users may need to `brew install node` first

### Binaries not found
- Check that `bin.install_symlink Dir["#{libexec}/bin/*"]` is in the install block
- Verify package.json has correct bin entries

## 📝 Notes

- The formula file in this repository (Formula/aicommit2.rb) is temporary
- Once copied to the tap repository, you can delete it from the main repository
- The HOMEBREW_TAP_README.md file is also temporary and should be deleted after copying
- Keep the workflow file (.github/workflows/update_homebrew.yml) in the main repository

## 🎉 Success Criteria

The integration is complete when:

1. ✅ Users can install via `brew install tak-bro/aicommit2`
2. ✅ Both `aicommit2` and `aic2` commands work
3. ✅ New releases automatically create PRs in the tap repository
4. ✅ Formula passes `brew audit` and `brew test`
5. ✅ Documentation clearly explains Homebrew installation

---

For questions or issues, refer to:
- Homebrew documentation: https://docs.brew.sh/
- mislav/bump-homebrew-formula-action: https://github.com/mislav/bump-homebrew-formula-action
