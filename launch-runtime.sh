#!/usr/bin/env bash
set -euo pipefail

APP_PATH="${1:-/Applications/Antigravity IDE.app}"
PORT="${AG_ENVI_DEBUG_PORT:-9333}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -d "$APP_PATH" ]]; then
  echo "Antigravity app not found:"
  echo "$APP_PATH"
  exit 1
fi

echo "Starting Antigravity with remote debugging on 127.0.0.1:$PORT"
echo "If Antigravity is already open, quit it first and run this again."

open -a "$APP_PATH" --args \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port="$PORT"

node "$SCRIPT_DIR/runtime-injector.mjs"
