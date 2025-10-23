# CI/CD Automation Documentation

This document describes the automated release and distribution workflows for aicommit2.

## Release Workflow Overview

When code is pushed to the `main` branch, the following automation pipeline runs:

```
npm publish (semantic-release)
    ├─> Update Nix Flake
    └─> Update Personal Homebrew Tap
```

> **Note**: Homebrew-Core PR automation is currently disabled. See [Homebrew-Core PR Automation](#4-homebrew-core-pr-automation-disabled) section for details.

## Workflows

### 1. Semantic Release & NPM Publish

**Trigger**: Push to `main` branch
**Job**: `release`
**Actions**:
- Analyzes commits using semantic-release
- Determines new version number
- Publishes to npm registry
- Creates GitHub release with notes

**Outputs**:
- `new_release_published`: Boolean indicating if a new version was released
- `new_release_version`: The new version number (e.g., "2.4.12")

### 2. Nix Flake Update

**Trigger**: After successful release
**Job**: `update-nix`
**Dependencies**: `release` job

**Actions**:
1. Checks out repository
2. Installs Nix
3. **Waits for NPM package availability** (up to 2 minutes with retries)
4. Updates `flake.nix`:
   - Creates backup of current flake.nix
   - Updates version string
   - Forces invalid hash to trigger rebuild
   - Builds package to get correct hash (with 3 retry attempts)
   - Updates with correct hash
   - Validates flake with `nix flake check`
   - Restores backup on any failure
5. Commits and pushes changes to `main` with `[skip ci]`

**Improvements**:
- ✅ NPM package availability check (prevents premature builds)
- ✅ Retry logic for hash calculation (3 attempts with 5s delay)
- ✅ Automatic backup and rollback on failure
- ✅ Flake validation before commit
- ✅ Detailed logging for debugging

**Requirements**:
- `PAT_TOKEN` secret with repo write permissions

### 3. Personal Homebrew Tap Update

**Trigger**: After successful release
**Job**: `update-homebrew`
**Dependencies**: `release` job
**Repository**: `tak-bro/homebrew-aicommit2`

**Actions**:
1. Checks out tap repository
2. Downloads npm tarball
3. Calculates SHA256 hash
4. Updates `Formula/aicommit2.rb`:
   - Updates download URL
   - Updates SHA256 hash
5. Commits and pushes to tap repository

**Requirements**:
- `PAT_TOKEN` secret with repo write permissions
- Fork of `tak-bro/homebrew-aicommit2` must exist

### 4. Homebrew-Core PR Automation (DISABLED)

**Status**: Currently disabled
**Job**: `update-homebrew-core` (commented out)

**Why Disabled**:
- Initial formula must be manually submitted and merged first
- Homebrew maintainers prefer to review initial submissions
- Will be enabled after first formula merge

**Planned Actions** (when enabled):
1. Checks out forked repository (`tak-bro/homebrew-core`)
2. Configures git and adds upstream remote
3. **Validation Checks**:
   - Verifies formula exists in homebrew-core
   - Checks for existing PR with same version
   - Skips if formula doesn't exist or PR already open
4. **Formula Update**:
   - Creates new branch from upstream/master
   - Downloads npm tarball and calculates SHA256
   - Updates `Formula/a/aicommit2.rb`
   - Verifies changes were made
5. **PR Creation**:
   - Pushes branch to fork
   - Creates PR to Homebrew/homebrew-core
   - Includes checklist from Homebrew contribution guidelines
   - Links to release notes

**To Enable**:
1. Wait for initial formula merge to homebrew-core
2. Uncomment `update-homebrew-core` job in `.github/workflows/release.yml`
3. Change `if: false` to `if: needs.release.outputs.new_release_published == 'true'`

**Safeguards**:
- Skips if formula doesn't exist yet
- Prevents duplicate PRs for same version
- Validates SHA256 calculation
- Verifies formula changes before committing
- Uses force push to handle branch updates

## Required Secrets

### `PAT_TOKEN`
Personal Access Token with the following scopes:
- `repo` - Full repository access
- `workflow` - Update GitHub Actions workflows
- `write:packages` - Publish packages

**Setup**:
1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with required scopes
3. Add as repository secret named `PAT_TOKEN`

### `NPM_TOKEN`
NPM authentication token for publishing packages.

**Setup**:
1. Login to npmjs.com
2. Generate access token (Automation type)
3. Add as repository secret named `NPM_TOKEN`

## Prerequisites

### One-Time Setup

#### 1. Fork Homebrew-Core
```bash
# Via GitHub UI or CLI
gh repo fork Homebrew/homebrew-core --clone=false
```

#### 2. Initial Formula Submission
The first time a formula is added to homebrew-core, it must be done manually:

1. Create formula in your fork
2. Test locally:
   ```bash
   HOMEBREW_NO_INSTALL_FROM_API=1 brew install --build-from-source ./Formula/a/aicommit2.rb
   brew test aicommit2
   brew audit --strict aicommit2
   ```
3. Submit PR manually
4. Wait for merge

After the initial formula is merged, this automation will handle version bumps.

## Workflow Behavior

### Successful Release Flow
```
1. Push to main (with conventional commit)
   └─> Triggers release.yml workflow

2. Release Job [2-3 minutes]
   ├─> Semantic-release analyzes commits
   ├─> Determines new version (e.g., 2.4.12)
   ├─> Publishes to npm registry
   ├─> Creates GitHub release
   └─> Commits: "chore(release): 2.4.12 [skip ci]"

3. Parallel Jobs [3-5 minutes]
   ├─> update-nix
   │   ├─> Wait for npm package (up to 2 min)
   │   ├─> Update flake.nix (with retries)
   │   ├─> Validate flake
   │   └─> Commit: "chore(nix): update flake.nix to v2.4.12 [skip ci]"
   │
   └─> update-homebrew
       ├─> Download npm tarball
       ├─> Calculate SHA256
       └─> Update personal tap formula

4. All commits have [skip ci] → No infinite loop ✅
```

### Edge Cases

#### NPM Package Not Available
**Scenario**: npm publish succeeded but package not yet available in registry
**Behavior**:
- Waits up to 2 minutes (12 attempts × 10 seconds)
- Logs: "⏳ Waiting for npm package aicommit2@X.Y.Z..."
- Fails if package unavailable after timeout
**Resolution**: Re-run workflow manually after npm propagation

#### Hash Calculation Fails
**Scenario**: Nix build fails or hash extraction fails
**Behavior**:
- Retries up to 3 times with 5-second delays
- Logs full nix build output on failure
- Restores backup flake.nix automatically
- Workflow fails (prevents bad commits)
**Resolution**: Check nix build logs, fix flake.nix manually if needed

#### Flake Validation Fails
**Scenario**: `nix flake check` fails after update
**Behavior**:
- Automatically restores backup flake.nix
- Workflow fails (prevents bad commits)
- No changes committed to repository
**Resolution**: Manual flake.nix fix required

#### No Changes Detected
**Scenario**: Version and hash unchanged
**Behavior**:
- Logs: "No changes to commit"
- Skips commit and push
- Workflow succeeds
**Resolution**: Normal behavior, no action needed

## Monitoring

### Check Workflow Status
```bash
# View latest workflow runs
gh run list --workflow=release.yml

# View specific run details
gh run view <run-id>

# View logs for specific job
gh run view <run-id> --job=<job-id> --log
```

### Check Created PRs
```bash
# List open PRs to homebrew-core
gh pr list --repo Homebrew/homebrew-core --search "author:tak-bro aicommit2"

# View specific PR
gh pr view <pr-number> --repo Homebrew/homebrew-core
```

## Troubleshooting

### Workflow Fails at "Check if formula exists"
**Problem**: Formula not yet in homebrew-core
**Solution**: Submit initial PR manually, then automation will work for updates

### Workflow Fails at "Calculate SHA256"
**Problem**: NPM package not available yet
**Solution**: Wait a few minutes for npm registry to sync, then re-run job

### PR Creation Fails with "Validation Failed"
**Problem**: Branch already exists or PR limit reached
**Solution**:
- Delete branch from fork: `gh api repos/tak-bro/homebrew-core/git/refs/heads/aicommit2-X.Y.Z -X DELETE`
- Re-run workflow

### Formula Update Has No Changes
**Problem**: Version number didn't change
**Solution**: Check semantic-release commit messages, ensure proper conventional commits

## Maintenance

### Updating the Workflow

When modifying the automation:

1. Test changes in a feature branch
2. Use workflow dispatch or push with `[skip ci]` to prevent auto-run
3. Validate YAML:
   ```bash
   npx yaml-lint .github/workflows/release.yml
   ```
4. Test with a dry run if possible

### Homebrew Guidelines Compliance

This automation follows Homebrew's contribution guidelines:
- Uses proper commit message format: `aicommit2 X.Y.Z`
- Creates PR from fork branch to upstream master
- Includes required checklist in PR body
- Links to release notes
- Avoids unnecessary churn (checks for existing PRs)

### Rate Limiting

GitHub API has rate limits. If you release frequently:
- Monitor rate limit: `gh api rate_limit`
- Consider adding delays between jobs
- Use conditional runs to avoid unnecessary API calls

## Future Enhancements

Potential improvements:

1. **Local Testing Integration**
   - Add optional job to test formula build before PR
   - Requires macOS runner or Docker setup

2. **Automated PR Merge**
   - Monitor homebrew-core CI status
   - Auto-merge if all checks pass
   - Requires additional permissions and review

3. **Version Monitoring**
   - Notify if PR sits open too long
   - Check for conflicts with other PRs
   - Alert if homebrew-core formula version falls behind

4. **Alternative: Official Bump Formula**
   - Consider using `dawidd6/action-homebrew-bump-formula@v3`
   - More community-standard approach
   - Less control over PR format

## References

- [Homebrew Contribution Guidelines](https://github.com/Homebrew/homebrew-core/blob/HEAD/CONTRIBUTING.md)
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Semantic Release Documentation](https://semantic-release.gitbook.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
