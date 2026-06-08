#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_MONITOR="$SCRIPT_DIR/auto-relaunch-monitor.sh"
HELPER_DIR="$HOME/Library/Application Support/Smart Chat Hover Translate"
MONITOR="$HELPER_DIR/auto-relaunch-monitor.sh"
LABEL="dev.trantrandev.ag-envi-hover.auto-relaunch"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
UID_VALUE="$(id -u)"

mkdir -p "$HOME/Library/LaunchAgents" "$HELPER_DIR"
cp "$SOURCE_MONITOR" "$MONITOR"
chmod +x "$MONITOR"

cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$MONITOR</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>AG_ENVI_REQUIRE_EXTENSION</key>
    <string>1</string>
    <key>AG_ENVI_STARTUP_GRACE_SECONDS</key>
    <string>12</string>
  </dict>
  <key>StandardOutPath</key>
  <string>/tmp/ag-envi-hover-auto-relaunch.stdout.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/ag-envi-hover-auto-relaunch.stderr.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$UID_VALUE/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$UID_VALUE" "$PLIST"
launchctl enable "gui/$UID_VALUE/$LABEL"
launchctl kickstart -k "gui/$UID_VALUE/$LABEL"

echo "Installed EnVi Hover auto helper."
echo "From now on, you can open Antigravity normally; the helper will relaunch it with port 9333 when needed."
echo "Log: /tmp/ag-envi-hover-auto-relaunch.log"
