#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-$SCRIPT_DIR}"
ORIGINAL="$TARGET_DIR/.verification/original-index.html"

if [[ ! -f "$ORIGINAL" ]]; then
  printf 'ROLLBACK FAIL: original snapshot missing at %s\n' "$ORIGINAL" >&2
  exit 1
fi

cp "$ORIGINAL" "$TARGET_DIR/index.html"
printf 'ROLLBACK PASS: index.html restored to original static portfolio; web editor=absent\n'
