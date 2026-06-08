#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/Applications/Antigravity IDE.app}"
APP_RESOURCES="$APP_PATH/Contents/Resources/app/out"
HTML_PATH="$APP_RESOURCES/vs/code/electron-browser/workbench/workbench-jetski-agent.html"
TARGET_DIR="$(dirname "$HTML_PATH")"
SCRIPT_TARGET="$TARGET_DIR/ag-envi-hover.js"

if [[ ! -f "$HTML_PATH" ]]; then
  echo "Could not find Antigravity Agent HTML:"
  echo "$HTML_PATH"
  exit 1
fi

if [[ ! -w "$HTML_PATH" || ! -w "$TARGET_DIR" ]]; then
  echo "No write permission for Antigravity app files."
  echo "Run again with sudo:"
  echo "sudo \"$0\" \"$APP_PATH\""
  exit 1
fi

tmp_file="$(mktemp)"
awk '
  /AG-ENVI-HOVER-START/ { skip = 1; next }
  /AG-ENVI-HOVER-END/ { skip = 0; next }
  !skip { print }
' "$HTML_PATH" > "$tmp_file"
mv "$tmp_file" "$HTML_PATH"
rm -f "$SCRIPT_TARGET"

echo "Removed ag-envi-hover."
echo "Restart Antigravity IDE to finish uninstalling."
