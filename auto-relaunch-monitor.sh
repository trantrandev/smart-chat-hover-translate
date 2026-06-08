#!/usr/bin/env bash
set -euo pipefail

PORT="${AG_ENVI_DEBUG_PORT:-9333}"
APP_PATH="${AG_ENVI_APP_PATH:-}"
MODE="${AG_ENVI_AUTO_RELAUNCH_MODE:-silent}"
LOG_FILE="/tmp/ag-envi-hover-auto-relaunch.log"
COOLDOWN_SECONDS=45
REQUIRE_EXTENSION="${AG_ENVI_REQUIRE_EXTENSION:-0}"
STARTUP_GRACE_SECONDS="${AG_ENVI_STARTUP_GRACE_SECONDS:-0}"
RELAUNCH_REQUEST_FILE="${AG_ENVI_RELAUNCH_REQUEST_FILE:-/tmp/ag-envi-hover-relaunch-request}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG_FILE"
}

find_app_path() {
  if [[ -n "$APP_PATH" && -d "$APP_PATH" ]]; then
    printf '%s\n' "$APP_PATH"
    return 0
  fi

  local candidate
  for candidate in \
    "/Applications/Antigravity IDE.app" \
    "/Applications/Antigravity.app" \
    "$HOME/Applications/Antigravity IDE.app" \
    "$HOME/Applications/Antigravity.app"; do
    if [[ -d "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  return 1
}

debug_port_is_up() {
  curl -sS --max-time 0.7 "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1
}

main_antigravity_pids() {
  {
    pgrep -f '^/Applications/Antigravity IDE\.app/Contents/MacOS/' 2>/dev/null || true
    pgrep -f '^/Applications/Antigravity\.app/Contents/MacOS/' 2>/dev/null || true
    pgrep -f "^$HOME/Applications/Antigravity IDE\\.app/Contents/MacOS/" 2>/dev/null || true
    pgrep -f "^$HOME/Applications/Antigravity\\.app/Contents/MacOS/" 2>/dev/null || true
  } | sort -u
}

antigravity_is_running() {
  [[ -n "$(main_antigravity_pids)" ]]
}

extension_is_installed() {
  local manifest="$HOME/.antigravity-ide/extensions/extensions.json"
  [[ -f "$manifest" ]] && grep -q '"id":"trantrandev.smart-chat-hover-translate"' "$manifest"
}

ask_or_continue() {
  if [[ "$MODE" != "prompt" ]]; then
    return 0
  fi

  local answer
  answer="$(osascript <<'APPLESCRIPT' 2>/dev/null || true
set dialogResult to display dialog "Antigravity dang mo nhung chua co cong dich 9333. Quit va mo lai de hover translate hoat dong?" buttons {"Cancel", "Relaunch"} default button "Relaunch" cancel button "Cancel"
button returned of dialogResult
APPLESCRIPT
)"
  [[ "$answer" == "Relaunch" ]]
}

notify_user() {
  osascript -e 'display notification "Dang mo lai Antigravity voi cong dich 9333" with title "EnVi Hover Translate"' >/dev/null 2>&1 || true
}

quit_antigravity() {
  osascript -e 'tell application "Antigravity IDE" to quit' >/dev/null 2>&1 || true
  osascript -e 'tell application "Antigravity" to quit' >/dev/null 2>&1 || true

  local i
  for i in $(seq 1 100); do
    if ! antigravity_is_running; then
      return 0
    fi
    sleep 0.2
  done
}

launch_with_debug() {
  local app_path="$1"
  local bundle_id=""

  if [[ -f "$app_path/Contents/Info.plist" ]]; then
    bundle_id="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Contents/Info.plist" 2>/dev/null || true)"
  fi

  if [[ -n "$bundle_id" ]]; then
    open -n -b "$bundle_id" --args \
      --remote-debugging-address=127.0.0.1 \
      --remote-debugging-port="$PORT"
    log "Launched Antigravity via bundle id $bundle_id"
  else
    open -n -a "$app_path" --args \
      --remote-debugging-address=127.0.0.1 \
      --remote-debugging-port="$PORT"
    log "Launched Antigravity via app path $app_path"
  fi
}

verify_port_after_launch() {
  local i
  for i in $(seq 1 30); do
    if debug_port_is_up; then
      log "Debug port $PORT is up after launch"
      return 0
    fi
    sleep 1
  done

  log "Debug port $PORT did not come up after launch"
  return 1
}

process_relaunch_request() {
  local app_path="$1"
  [[ -f "$RELAUNCH_REQUEST_FILE" ]] || return 1

  rm -f "$RELAUNCH_REQUEST_FILE"
  log "Processing explicit relaunch request"

  if antigravity_is_running; then
    quit_antigravity
  fi

  sleep 2
  launch_with_debug "$app_path"
  verify_port_after_launch || true
  return 0
}

main() {
  local app_path
  if ! app_path="$(find_app_path)"; then
    log "Cannot find Antigravity app; monitor idle"
    sleep 60
    return 0
  fi

  log "Auto relaunch monitor started; app=$app_path port=$PORT mode=$MODE"

  if [[ "$STARTUP_GRACE_SECONDS" -gt 0 ]]; then
    log "Waiting ${STARTUP_GRACE_SECONDS}s so the extension can show its restart notice"
    sleep "$STARTUP_GRACE_SECONDS"
  fi

  local last_relaunch_at=0

  while true; do
    if [[ "$REQUIRE_EXTENSION" == "1" ]] && ! extension_is_installed; then
      sleep 30
      continue
    fi

    if debug_port_is_up; then
      rm -f "$RELAUNCH_REQUEST_FILE"
      sleep 4
      continue
    fi

    if process_relaunch_request "$app_path"; then
      sleep 4
      continue
    fi

    local pids
    pids="$(main_antigravity_pids | tr '\n' ' ' | sed 's/[[:space:]]*$//')"
    if [[ -z "$pids" ]]; then
      sleep 2
      continue
    fi

    # Give a freshly opened IDE a short chance to expose the port before acting.
    sleep 3
    if debug_port_is_up; then
      continue
    fi

    local now
    now="$(date +%s)"
    if [[ $((now - last_relaunch_at)) -lt "$COOLDOWN_SECONDS" ]]; then
      sleep 5
      continue
    fi

    last_relaunch_at="$now"

    if ! ask_or_continue; then
      log "Relaunch skipped by user"
      sleep 10
      continue
    fi

    log "Detected Antigravity without debug port; relaunching. pids=$pids"
    notify_user
    quit_antigravity
    sleep 1
    launch_with_debug "$app_path"
  done
}

if [[ "${BASH_SOURCE[0]:-}" == "$0" ]]; then
  main "$@"
fi
