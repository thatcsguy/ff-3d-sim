#!/bin/bash
# ralph.sh
# Usage: ./ralph.sh <iterations>
# If iterations is 1, runs interactive mode with acceptEdits
# Otherwise runs batch mode for N iterations

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

if [ "$1" == "1" ]; then
  # Interactive mode
  issues=$(gh issue list --state open --json number,title,body,comments)
  claude --permission-mode acceptEdits "$issues @ralph-prompt.md"
else
  # Batch mode
  for ((i=1; i<=$1; i++)); do
    echo ""
    echo "════════════════════════════════════════════════════════════════"
    echo "                    ▶▶▶ ITERATION $i/$1 ◀◀◀"
    echo "════════════════════════════════════════════════════════════════"
    echo ""

    issues=$(gh issue list --state open --json number,title,body,comments)
    result=$(claude -p "$issues @ralph-prompt.md")

    echo "$result"

    if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
      echo "PRD complete, exiting."
      exit 0
    fi
  done
fi
