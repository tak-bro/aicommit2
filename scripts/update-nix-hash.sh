#!/usr/bin/env bash
# Script to update flake.nix version and per-system pnpm deps hash
# Usage: ./scripts/update-nix-hash.sh [version]
# Example: ./scripts/update-nix-hash.sh v2.4.9
#
# Detects the current system (x86_64-linux or aarch64-darwin) and updates
# only that system's hash in the pnpmDepsHash map.

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if nix is installed
if ! command -v nix &>/dev/null; then
    echo -e "${RED}✗ Error: nix is not installed${NC}"
    echo "Please install nix from https://nixos.org/download.html"
    exit 1
fi

# Detect current system
SYSTEM=$(nix eval --impure --raw --expr 'builtins.currentSystem')
echo -e "${GREEN}✓ Detected system: ${SYSTEM}${NC}"

# Validate supported system
if [[ "$SYSTEM" != "x86_64-linux" && "$SYSTEM" != "aarch64-darwin" ]]; then
    echo -e "${RED}✗ Unsupported system: ${SYSTEM}${NC}"
    echo "Supported systems: x86_64-linux, aarch64-darwin"
    exit 1
fi

# Get version from argument or from latest git tag
if [ -n "$1" ]; then
    VERSION="$1"
else
    VERSION=$(git tag --sort=-v:refname | head -1)
    echo -e "${YELLOW}No version specified, using latest tag: ${VERSION}${NC}"
fi

# Validate version format
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}✗ Invalid version format: ${VERSION}${NC}"
    echo "Expected format: v2.4.9"
    exit 1
fi

echo "Updating flake.nix to version ${VERSION} (hash for ${SYSTEM})..."

# Backup original file
cp flake.nix flake.nix.backup
echo -e "${GREEN}✓ Created backup: flake.nix.backup${NC}"

# Update version in flake.nix
sed -i.tmp "s/version = \"v[0-9.]*\";/version = \"${VERSION}\";/" flake.nix
rm -f flake.nix.tmp
echo -e "${GREEN}✓ Updated version to ${VERSION}${NC}"

# Set invalid hash for current system to trigger mismatch
sed -i.tmp "s|\"${SYSTEM}\" = \"sha256-[^\"]*\";|\"${SYSTEM}\" = \"sha256-INVALIDHASHPLACEHOLDER000000000000000000000=\";|" flake.nix
rm -f flake.nix.tmp

# Build and capture the correct hash
echo "Building to calculate correct hash for ${SYSTEM} (this will fail, that's expected)..."
BUILD_OUTPUT=$(nix build .#packages.${SYSTEM}.default 2>&1 || true)

# Extract the correct hash from error message
CORRECT_HASH=$(echo "$BUILD_OUTPUT" | grep 'got:' | grep -oE 'sha256-[A-Za-z0-9+/=]{44}' | head -n1)

if [ -z "$CORRECT_HASH" ]; then
    echo -e "${RED}✗ Failed to extract hash from build output${NC}"
    echo "Build output:"
    echo "$BUILD_OUTPUT"

    # Restore backup
    mv flake.nix.backup flake.nix
    echo -e "${YELLOW}Restored original flake.nix from backup${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Calculated hash for ${SYSTEM}: ${CORRECT_HASH}${NC}"

# Update hash for current system in flake.nix
sed -i.tmp "s|\"${SYSTEM}\" = \"sha256-[^\"]*\";|\"${SYSTEM}\" = \"${CORRECT_HASH}\";|" flake.nix
rm -f flake.nix.tmp
echo -e "${GREEN}✓ Updated ${SYSTEM} hash in flake.nix${NC}"

# Verify the build works
echo "Verifying build with new hash..."
if nix build .#packages.${SYSTEM}.default --print-out-paths >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Build successful!${NC}"

    # Remove backup
    rm -f flake.nix.backup

    echo ""
    echo -e "${GREEN}==================================${NC}"
    echo -e "${GREEN}Successfully updated flake.nix:${NC}"
    echo -e "  Version: ${VERSION}"
    echo -e "  System:  ${SYSTEM}"
    echo -e "  Hash:    ${CORRECT_HASH}"
    echo -e "${GREEN}==================================${NC}"
    echo ""
    echo "You can now commit these changes:"
    echo "  git add flake.nix"
    echo "  git commit -m \"chore(nix): update to ${VERSION}\""
else
    echo -e "${RED}✗ Build verification failed${NC}"

    # Restore backup
    mv flake.nix.backup flake.nix
    echo -e "${YELLOW}Restored original flake.nix from backup${NC}"
    exit 1
fi
