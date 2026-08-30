#!/usr/bin/env bash
# Re-apply every local patch in this directory after an upstream sync.
# Idempotent: patches already present in the working tree are skipped.
set -euo pipefail
dir="$(cd "$(dirname "$0")" && pwd)"
cd "$dir/.."
shopt -s nullglob
patches=("$dir"/*.patch)
[ ${#patches[@]} -gt 0 ] || { echo "no patches in local-patches/"; exit 0; }
status=0
for p in "${patches[@]}"; do
  if git apply --check "$p" 2>/dev/null; then
    git apply "$p" && echo "applied:         $(basename "$p")"
  elif git apply --check --reverse "$p" 2>/dev/null; then
    echo "already applied: $(basename "$p")"
  else
    echo "CONFLICT, apply by hand: $(basename "$p") (upstream likely touched the same lines)" >&2
    status=1
  fi
done
exit $status
