# Smart Chat Hover Translate - Handoff

## Goal

Build and continue a hover-translation tool for the Antigravity IDE chat / Agent Manager UI.

The UX target is similar to EnVi Dictionary:

- Hover English text in Antigravity chat.
- Show a compact Vietnamese tooltip.
- Do not affect code editor hovers.
- Avoid modifying Antigravity app files directly.

## Current State

Current version:

```text
0.31.10
```

This version is used by:

```text
package.json
ag-envi-hover.js
smart-chat-hover-translate-0.31.10.vsix
```

## Main Files

```text
package.json
```

VS Code / Antigravity extension manifest. Package name:

```text
smart-chat-hover-translate
```

```text
extension.js
```

VSIX extension entrypoint. It:

- Creates a status bar item.
- Polls CDP targets on `127.0.0.1:9333`.
- Injects `ag-envi-hover.js` into Antigravity workbench pages.
- Requests a relaunch through the platform helper when remote debugging is not enabled.
- Clicks status bar item to call `window.__agEnviHover.toggleEnabled()` in active targets.
- Automatically installs or refreshes startup support after VSIX activation.
- Provides commands to install or remove automatic startup.

```text
auto-helper.js
```

Small platform switcher. It calls the macOS helper on macOS and the Windows
helper on Windows.

```text
auto-helper-mac.js
auto-relaunch-monitor.sh
```

macOS-only automatic startup path. It installs a LaunchAgent, copies
`auto-relaunch-monitor.sh` to:

```text
~/Library/Application Support/Smart Chat Hover Translate
```

The helper watches `/tmp/ag-envi-hover-relaunch-request` and opens Antigravity
with:

```bash
--remote-debugging-address=127.0.0.1 --remote-debugging-port=9333
```

```text
auto-helper-windows.js
auto-relaunch-monitor.ps1
```

Windows-only automatic startup path. It creates a hidden `.vbs` launcher in:

```text
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

It copies `auto-relaunch-monitor.ps1` to:

```text
%APPDATA%\Smart Chat Hover Translate
```

The PowerShell helper watches `%TEMP%\ag-envi-hover-relaunch-request`, starts
hidden, and relaunches Antigravity with port `9333`. This path does not require
administrator permission. Uninstall also removes the legacy Scheduled Task if
one exists from version `0.31.0`.

```text
ag-envi-hover.js
```

Runtime userscript injected into Antigravity pages. It handles:

- Hover detection.
- Text extraction.
- Vietnamese-skip filtering.
- Translation backend calls.
- Tooltip UI.
- Click-to-expand.
- `Option + T` toggle.
- localStorage cache.

```text
smart-chat-hover-translate-0.31.10.vsix
```

Packaged extension artifact.

```text
runtime-injector.mjs
launch-runtime.sh
Start Antigravity EnVi Hover.command
Antigravity EnVi Hover.app
auto-relaunch-monitor.sh
auto-relaunch-monitor.ps1
install-auto-helper.sh
uninstall-auto-helper.sh
```

Standalone runtime-injection path, useful without installing VSIX.

`Antigravity EnVi Hover.app` is a macOS launcher wrapper. It opens Antigravity
with the required CDP debug port and can be dragged into the Dock for daily use.
If Antigravity is already open without the debug port, it prompts the user to
quit and relaunch.

The auto helper path installs a LaunchAgent that watches for Antigravity opened
without CDP port `9333`. In silent mode it relaunches Antigravity with:

```bash
--remote-debugging-address=127.0.0.1 --remote-debugging-port=9333
```

Install/uninstall:

```bash
./install-auto-helper.sh
./uninstall-auto-helper.sh
```

```text
install.sh
```

Old direct-patch installer. Do not use for normal operation because modifying Antigravity app files can trigger a corrupt installation warning.

## Safe Runtime Constraint

Do not patch files inside:

```text
/Applications/Antigravity IDE.app
```

Earlier direct patching caused a corrupt installation warning. Use either:

- VSIX extension + debug port, or
- standalone runtime injector + debug port.

## How To Run - VSIX Path

Install:

```text
smart-chat-hover-translate-0.31.10.vsix
```

On activation, the extension installs the platform helper automatically.
On macOS this is a LaunchAgent. On Windows this is a current-user Startup
launcher plus a hidden PowerShell monitor. If port `9333` is not active, the extension displays a notification and a
10-second status bar countdown before restarting Antigravity automatically. No
button, confirmation, launcher, or shell command is required.

For the actual reopen, the extension writes:

```text
/tmp/ag-envi-hover-relaunch-request on macOS
%TEMP%\ag-envi-hover-relaunch-request on Windows
```

Then the platform helper handles opening Antigravity with port `9333`. This
is important because after `workbench.action.quit`, the extension host is gone
and cannot reliably spawn the next IDE process itself.

Antigravity does not necessarily activate a newly installed VSIX in the current
running session. If it does not, automatic setup begins on the next normal IDE
launch; no manual setup action is required.

Then make sure Antigravity is launched with:

```bash
--remote-debugging-address=127.0.0.1 --remote-debugging-port=9333
```

Best daily workflow:

```text
Antigravity EnVi Hover.app
```

Drag that launcher app to the Dock and use it instead of the original
Antigravity icon. If the status bar says relaunch is needed, click it and accept
the relaunch prompt.

Most automatic workflow:

```bash
./install-auto-helper.sh
```

After this, the user can open Antigravity from the original icon. The helper will
relaunch it with port `9333` when needed.

## How To Run - Standalone Path

Quit Antigravity first, then:

```bash
cd /path/to/ag-chat-envi-hover
./launch-runtime.sh
```

Or double-click:

```text
Start Antigravity EnVi Hover.command
```

For a Finder/Dock-friendly launcher, double-click:

```text
Antigravity EnVi Hover.app
```

Keep the terminal open while using the standalone injector.

## Current Hover Behavior

Hover translates English text in chat.

The current extraction behavior translates only the local clause up to a comma, punctuation boundary, newline, or dash boundary.

Example:

```text
Let's translate their request first, then translate our answer...
```

Hovering in the first clause should translate only:

```text
Let's translate their request first
```

This was explicitly requested. Do not change it back to translating whole sentences unless asked.

## Vietnamese Skip Behavior

The script should not translate Vietnamese text.

It checks Vietnamese marks such as:

```text
ă â đ ê ô ơ ư á à ả ã ạ ...
```

It also skips text with too many non-ASCII characters.

## Tooltip UX

Current tooltip:

- Shows only Vietnamese translation.
- Does not show the English source line.
- Small EnVi-like font.
- Neutral dark/graphite background.
- Has a caret/arrow.
- Prefers to appear above the hovered word.
- Falls below only when there is not enough room above.
- Anchors to the hovered word bounding box.
- Is clamped so it does not spill into sidebar/margins.
- Long translations show a preview first.
- Click tooltip to expand.
- Click again to collapse.

## Hotkeys And Runtime API

Inside Antigravity:

```text
Option + T
```

toggles hover translation on/off.

The userscript exposes:

```js
window.__agEnviHover.version
window.__agEnviHover.dispose()
window.__agEnviHover.toggleEnabled()
window.__agEnviHover.setEnabled(boolean)
window.__agEnviHover.enabled
```

This is important because `extension.js` calls:

```js
window.__agEnviHover?.toggleEnabled?.()
```

## Storage

Toggle state:

```text
localStorage["ag-envi-hover:enabled"]
```

Translation cache prefix:

```text
ag-envi-hover:
```

Cache TTL:

```text
30 days
```

## Translation Backend

Current order:

1. Local developer dictionary for a small set of terms.
2. Context-aware Google Translate call:
   - Finds the target clause inside surrounding context.
   - Wraps target as `[target]`.
   - Sends the wrapped context to translation.
   - Extracts translated content from brackets/parentheses.
3. Plain Google Translate fallback.
4. MyMemory fallback.

Important: bracket extraction can fail if Google Translate removes or moves brackets. In that case the code falls back to plain target translation.

## Known Risk / Next Work

The biggest technical risk is bracket-wrapping extraction reliability.

Possible improvements:

- Use stronger marker tokens that translation engines preserve better.
- Try multiple marker styles.
- Detect failed extraction more carefully.
- Add a local/AI backend that can translate only `TARGET` using `CONTEXT`.

Prompt idea for a better AI backend:

```text
Translate only TARGET into natural Vietnamese.
Use CONTEXT only to understand meaning.
Do not translate CONTEXT.

CONTEXT: ...
TARGET: ...
```

## Verification Commands

Run from:

```bash
cd /path/to/ag-chat-envi-hover
```

Then:

```bash
node --check ag-envi-hover.js
node --check extension.js
node --check runtime-injector.mjs
bash -n launch-runtime.sh
bash -n "Start Antigravity EnVi Hover.command"
npm ls --depth=0
```

Inspect VSIX contents:

```bash
unzip -l smart-chat-hover-translate-0.31.10.vsix
```

Check whether Antigravity debug port is open:

```bash
curl http://127.0.0.1:9333/json/list
```

## Packaging

The `.vscodeignore` excludes standalone runtime scripts except
`auto-relaunch-monitor.sh`, which the VSIX needs for automatic startup setup.

Current VSIX includes:

- `package.json`
- `extension.js`
- `ag-envi-hover.js`
- `README.md`
- `HUONG_DAN.md`
- `auto-relaunch-monitor.sh`
- `node_modules/ws`

## Notes From Latest Audit

Latest audit found and fixed one issue:

- `extension.js` tried to call `window.__agEnviHover.toggleEnabled()`.
- `ag-envi-hover.js` previously did not expose `toggleEnabled`.
- Fixed by exposing `toggleEnabled`, `setEnabled`, and `enabled` in `window.__agEnviHover`.

Current debug port was not open during audit, so runtime injection could not be verified live.
