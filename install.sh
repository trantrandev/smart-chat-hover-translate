#!/usr/bin/env bash
set -euo pipefail

if [[ "${AG_ENVI_ALLOW_DIRECT_PATCH:-}" != "1" ]]; then
  echo "Direct patch install is disabled because Antigravity marks modified app files as corrupt."
  echo "Use the runtime injector instead:"
  echo "./launch-runtime.sh"
  echo
  echo "If you still want the old direct patch, run:"
  echo "AG_ENVI_ALLOW_DIRECT_PATCH=1 ./install.sh"
  exit 1
fi

APP_PATH="${1:-/Applications/Antigravity IDE.app}"
APP_RESOURCES="$APP_PATH/Contents/Resources/app/out"
HTML_PATH="$APP_RESOURCES/vs/code/electron-browser/workbench/workbench-jetski-agent.html"
TARGET_DIR="$(dirname "$HTML_PATH")"
SCRIPT_NAME="ag-envi-hover.js"
SCRIPT_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$SCRIPT_NAME"
SCRIPT_TARGET="$TARGET_DIR/$SCRIPT_NAME"
BACKUP_ROOT="${HOME}/.ag-chat-envi-hover/backups"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d-%H%M%S)"
MARKER_START="<!-- AG-ENVI-HOVER-START -->"
MARKER_END="<!-- AG-ENVI-HOVER-END -->"

if [[ ! -f "$HTML_PATH" ]]; then
  echo "Could not find Antigravity Agent HTML:"
  echo "$HTML_PATH"
  exit 1
fi

if [[ ! -f "$SCRIPT_SOURCE" ]]; then
  echo "Could not find $SCRIPT_NAME next to install.sh"
  exit 1
fi

if [[ ! -w "$HTML_PATH" || ! -w "$TARGET_DIR" ]]; then
  echo "No write permission for Antigravity app files."
  echo "Run again with sudo:"
  echo "sudo \"$0\" \"$APP_PATH\""
  exit 1
fi

mkdir -p "$BACKUP_DIR"
cp "$HTML_PATH" "$BACKUP_DIR/workbench-jetski-agent.html"
cp "$SCRIPT_SOURCE" "$SCRIPT_TARGET"

if grep -q "AG-ENVI-HOVER-START" "$HTML_PATH"; then
  echo "ag-envi-hover is already installed. Updated script only."
  echo "Backup: $BACKUP_DIR"
  exit 0
fi

tmp_file="$(mktemp)"
awk -v start="$MARKER_START" -v end="$MARKER_END" -v script="$SCRIPT_NAME" '
  /<\/html>/ && !done {
    print start
    print "<script src=\"./" script "\"></script>"
    print end
    done = 1
  }
  { print }
' "$HTML_PATH" > "$tmp_file"
mv "$tmp_file" "$HTML_PATH"

echo "Installed ag-envi-hover into:"
echo "$HTML_PATH"
echo "Backup: $BACKUP_DIR"
echo "Restart Antigravity IDE to load it."
