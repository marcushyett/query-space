#!/usr/bin/env bash
set -euo pipefail

# Claude Code PreToolUse hook that blocks git commit if TypeScript errors exist
# This ensures type-safe commits by running tsc --noEmit before any commit

# Read the tool input from stdin
INPUT=$(cat)

# Extract the command that's being run
COMMAND=$(echo "$INPUT" | jq -r '.input.command // empty')

# Only check if this is a git commit command
if [[ "$COMMAND" == *"git commit"* ]] || [[ "$COMMAND" == *"git"*"commit"* ]]; then
  echo "Running TypeScript type check before commit..." >&2

  # Run TypeScript check, filtering out node_modules errors (in case skipLibCheck fails)
  # We use a subshell to capture the output and check for errors
  if ! npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -E "error TS[0-9]+:" > /tmp/ts-errors.txt; then
    # No errors found in our source files
    echo "TypeScript check passed!" >&2
    rm -f /tmp/ts-errors.txt
    exit 0
  fi

  # Check if there are actual errors (not just grep finding nothing)
  if [ -s /tmp/ts-errors.txt ]; then
    echo "" >&2
    echo "BLOCKED: TypeScript type errors detected!" >&2
    echo "Please fix the following errors before committing:" >&2
    echo "" >&2
    cat /tmp/ts-errors.txt >&2
    echo "" >&2
    rm -f /tmp/ts-errors.txt
    exit 2  # Exit code 2 blocks the tool execution
  fi

  rm -f /tmp/ts-errors.txt
fi

# Allow the command to proceed
exit 0
