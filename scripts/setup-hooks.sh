#!/bin/sh

# Setup script to install git hooks
# Run this after cloning the repository

echo "Installing git hooks..."

# Copy pre-commit hook
cp scripts/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "Git hooks installed successfully!"
echo ""
echo "The following hooks are now active:"
echo "  - pre-commit: Runs TypeScript type checking before each commit"
