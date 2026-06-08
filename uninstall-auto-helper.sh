#!/usr/bin/env bash
set -euo pipefail

LABEL="dev.trantrandev.ag-envi-hover.auto-relaunch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HELPER_DIR="$HOME/Library/Application Support/Smart Chat Hover Translate"
UID_VALUE="$(id -u)"

launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
rm -f "$PLIST"
rm -rf "$HELPER_DIR"

echo "Removed EnVi Hover auto helper."
