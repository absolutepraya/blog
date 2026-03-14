#!/usr/bin/env bash
# Convert PNG/JPG images to WebP in static/images/compressed/
# Usage:
#   ./scripts/convert-images.sh              # convert all images
#   ./scripts/convert-images.sh file1 file2  # convert specific files

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/static/images"
DEST_DIR="$REPO_ROOT/static/images/compressed"
QUALITY=82
METHOD=6

if ! command -v cwebp &>/dev/null; then
  echo "WARNING: cwebp not found. Skipping WebP conversion." >&2
  echo "Install with: brew install webp" >&2
  exit 0
fi

convert_file() {
  local src="$1"
  local rel="${src#"$SRC_DIR"/}"
  local base="${rel%.*}"
  local dest="$DEST_DIR/${base}.webp"

  mkdir -p "$(dirname "$dest")"

  if cwebp -q "$QUALITY" -m "$METHOD" -quiet "$src" -o "$dest"; then
    echo "Converted: $rel -> compressed/${base}.webp"
  else
    echo "WARNING: cwebp failed on $src" >&2
  fi
}

if [[ $# -gt 0 ]]; then
  for f in "$@"; do
    convert_file "$f"
  done
else
  while IFS= read -r -d '' f; do
    [[ "$f" == *"/compressed/"* ]] && continue
    convert_file "$f"
  done < <(find "$SRC_DIR" \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -print0)
fi
