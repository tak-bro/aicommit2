# Nix Update Workflow Improvements

## Summary

Enhanced the `update-nix` job in `.github/workflows/release.yml` to be more robust and reliable with better error handling, retry logic, and validation.

## Changes Made

### 1. NPM Package Availability Check (NEW)
**Problem**: Nix build was sometimes failing because npm package wasn't immediately available after publish.

**Solution**:
```yaml
- name: Wait for NPM package availability
  run: |
    # Waits up to 2 minutes (12 attempts × 10s)
    # Verifies package exists before proceeding with nix build
```

**Benefits**:
- Prevents premature nix builds
- Reduces build failures due to timing issues
- Clear logging of wait status

---

### 2. Hash Calculation with Retry Logic (IMPROVED)
**Problem**: Hash calculation could fail transiently, causing workflow to fail.

**Solution**:
```yaml
# Retry up to 3 times with 5-second delays
for attempt in $(seq 1 $MAX_ATTEMPTS); do
  # Build and extract hash
  if [[ valid hash ]]; then
    break
  fi
  sleep 5
done
```

**Benefits**:
- Handles transient network/build issues
- Reduces manual re-runs
- Better success rate

---

### 3. Automatic Backup & Rollback (NEW)
**Problem**: Failed updates could leave flake.nix in broken state.

**Solution**:
```yaml
# Before any changes
cp flake.nix flake.nix.backup

# On any failure
mv flake.nix.backup flake.nix
exit 1
```

**Benefits**:
- Never commits broken flake.nix
- Automatic recovery from failures
- Repository stays in valid state

---

### 4. Flake Validation (NEW)
**Problem**: No verification that updated flake.nix is valid.

**Solution**:
```yaml
# After hash update
nix flake check --no-build

# Rollback if validation fails
if ! validation; then
  mv flake.nix.backup flake.nix
  exit 1
fi
```

**Benefits**:
- Catches syntax errors
- Verifies flake structure
- Prevents invalid commits

---

### 5. Enhanced Logging (IMPROVED)
**Problem**: Hard to debug failures with minimal logs.

**Solution**:
- Emoji-prefixed status messages (📦 🔨 ✅ ❌)
- Step-by-step progress logging
- Full nix build output on failure
- Git diff display for verification

**Benefits**:
- Easy to understand workflow status
- Quick debugging of failures
- Clear audit trail

---

## Infinite Loop Prevention

### 3-Layer Defense

1. **Release Job Guard**
   ```yaml
   if: "!contains(github.event.head_commit.message, '[skip ci]')"
   ```
   → Ignores commits with `[skip ci]`

2. **Semantic-release Commit**
   ```
   chore(release): 2.4.12 [skip ci]
   ```
   → Release workflow not triggered

3. **Nix Update Commit**
   ```
   chore(nix): update flake.nix to v2.4.12 [skip ci]
   ```
   → Release workflow not triggered

**Result**: ✅ No infinite loops possible

---

## Workflow Comparison

### Before
```
1. Checkout
2. Install Nix
3. Update flake.nix
   - Set version
   - Set invalid hash
   - Build once (no retry)
   - Extract hash (could fail)
   - Update hash
4. Commit and push
```

**Issues**:
- ❌ No npm availability check
- ❌ Single-attempt hash calculation
- ❌ No validation
- ❌ No rollback on failure
- ❌ Minimal logging

### After
```
1. Checkout
2. Install Nix
3. Wait for NPM (up to 2 min, 12 retries)
4. Update flake.nix
   - Backup current file
   - Set version
   - Set invalid hash
   - Build with retry (3 attempts)
   - Extract hash with validation
   - Update hash
   - Validate flake
   - Show diff
   - Cleanup backup
5. Commit and push
```

**Improvements**:
- ✅ NPM availability check
- ✅ 3-attempt retry logic
- ✅ Flake validation
- ✅ Automatic rollback
- ✅ Detailed logging
- ✅ Git diff display

---

## Error Handling Matrix

| Failure Scenario | Old Behavior | New Behavior |
|------------------|--------------|--------------|
| NPM not available | Build fails immediately | Wait up to 2 min, then fail with clear message |
| Hash extraction fails | Workflow fails | Retry 3 times, rollback on failure |
| Nix build fails | Commits invalid flake | Rollback to backup, fail workflow |
| Flake validation fails | N/A (no validation) | Rollback to backup, fail workflow |
| Transient network issue | Fails immediately | Retry with delays |

---

## Testing Recommendations

### Manual Testing
```bash
# Test npm availability check
npm unpublish aicommit2@test-version  # Simulate unavailable package
# Workflow should wait and retry

# Test hash retry logic
# Temporarily break network during build
# Should retry 3 times

# Test validation
# Manually introduce flake syntax error
# Should rollback automatically
```

### Monitoring First Release
After next release, monitor:
1. NPM wait time (should be < 30 seconds normally)
2. Hash calculation attempts (should succeed on first try normally)
3. Total workflow duration (should be 3-5 minutes)
4. Log clarity and usefulness

---

## Configuration

All retry/timeout values are configurable via variables:

```yaml
# NPM availability
MAX_ATTEMPTS=12        # Total attempts
WAIT_SECONDS=10        # Delay between attempts
# Total wait: 120 seconds (2 minutes)

# Hash calculation
MAX_ATTEMPTS=3         # Retry attempts
# Delay: 5 seconds between retries
```

Adjust these if needed based on observed behavior.

---

## Rollback Instructions

If automatic rollback fails or you need to manually fix flake.nix:

```bash
# 1. Check recent commits
git log --oneline -5

# 2. If bad nix commit exists
git revert <commit-hash>

# 3. Or manually fix flake.nix
# Edit version and hash
git add flake.nix
git commit -m "fix(nix): correct flake.nix [skip ci]"
git push
```

---

## Future Enhancements

Potential improvements:

1. **Multi-platform hash calculation**
   - Currently: x86_64-linux only
   - Future: Calculate for all platforms

2. **Parallel nix builds**
   - Build multiple platforms simultaneously
   - Faster total execution

3. **Hash caching**
   - Cache successful hashes
   - Skip rebuild if source unchanged

4. **Slack/Discord notifications**
   - Alert on workflow failures
   - Summary of each release

5. **Automated testing**
   - `nix build` verification
   - Run basic tests before commit

---

## References

- [Nix Flake Reference](https://nixos.org/manual/nix/stable/command-ref/new-cli/nix3-flake.html)
- [GitHub Actions Workflow Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Semantic Release](https://semantic-release.gitbook.io/)
