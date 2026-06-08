# Antigravity Chat EnVi Hover - Handoff

## Goal

Build a runtime hover-translation tool for the Antigravity IDE chat / Agent Manager UI.

The behavior should feel like the Chrome EnVi dictionary extension:

- Hover English text in the Antigravity chat.
- Show a small Vietnamese tooltip.
- Do not affect the code editor hover.
- Do not modify Antigravity app files directly.

## Important Constraint

Do not patch files inside:

```text
/Applications/Antigravity IDE.app
```

Earlier direct HTML patching caused Antigravity to show a corrupt installation warning. The current approach uses runtime injection through Chrome DevTools Protocol instead.

## Project Path

```text
/Users/ttran/Documents/Codex/2026-06-08/b-n-bi-t-t-i/outputs/ag-chat-envi-hover
```

## Current Version

Current userscript version:

```text
0.24.0
```

Defined in:

```text
ag-envi-hover.js
```

## Files

```text
ag-envi-hover.js
```

Main runtime userscript injected into Antigravity. Handles hover detection, text extraction, translation, tooltip UI, cache, hotkey toggle, and click-to-expand behavior.

```text
runtime-injector.mjs
```

Connects to Antigravity through Chrome DevTools Protocol on port `9333` and injects `ag-envi-hover.js` into the Antigravity workbench pages.

```text
launch-runtime.sh
```

Launches Antigravity with remote debugging enabled and starts `runtime-injector.mjs`.

```text
Start Antigravity EnVi Hover.command
```

Double-click launcher for macOS. Runs `launch-runtime.sh`.

```text
README.md
```

User-facing instructions.

```text
install.sh
```

Old direct-patch installer. It is disabled by default because direct patching triggers Antigravity's corrupt installation warning. Do not use it unless intentionally debugging direct patch mode.

```text
uninstall.sh
```

Removes old direct-patch changes if they were applied.

## How To Run

Quit Antigravity first, then run:

```bash
cd /Users/ttran/Documents/Codex/2026-06-08/b-n-bi-t-t-i/outputs/ag-chat-envi-hover
./launch-runtime.sh
```

Alternative:

Double-click:

```text
Start Antigravity EnVi Hover.command
```

Keep the launcher terminal open while using Antigravity.

## Current Behavior

### Hover Translation

Hovering English text in the Antigravity chat shows a small Vietnamese tooltip.

The hover text extraction currently translates only the local clause up to a comma or sentence boundary. For example:

```text
Let's translate their request first, then translate our answer...
```

Hovering within the first clause translates only:

```text
Let's translate their request first
```

This was requested explicitly because translating the whole sentence was too long and covered too much of the chat.

### Vietnamese Text

If the hovered text is Vietnamese, it should not translate.

The script checks for Vietnamese marks such as:

```text
ă â đ ê ô ơ ư á à ả ã ạ ...
```

It also skips text with a high ratio of non-ASCII characters.

### Tooltip UI

Current tooltip design:

- Shows only the Vietnamese translation.
- Does not show the English source text.
- Font is small, dictionary-like.
- Max width is small.
- Tooltip prefers to appear above the hovered word.
- Tooltip has a small caret/arrow pointing toward the hovered word.
- Tooltip is anchored to the bounding box of the hovered word, not just raw mouse coordinates.
- If there is not enough room above, it appears below.
- Tooltip position is clamped so it should not spill into the sidebar.

### Long Translations

Long translations are collapsed by default.

If the translation is long:

- Hover shows a short preview.
- Click the tooltip to expand.
- Click again to collapse.

### Hotkey Toggle

Inside Antigravity:

```text
Option + T
```

toggles hover translation on/off.

A small status toast appears:

```text
Hover translate: on
Hover translate: off
```

The enabled/disabled state is stored in localStorage:

```text
ag-envi-hover:enabled
```

### Cache

Translations are cached in localStorage for 30 days.

Cache prefix:

```text
ag-envi-hover:
```

## Translation Backend

Current order:

1. Small local dictionary for common developer terms.
2. Google Translate public endpoint:

```text
https://translate.googleapis.com/translate_a/single
```

3. MyMemory fallback:

```text
https://api.mymemory.translated.net/get
```

Privacy note: hovered or selected English text may be sent to those services.

## Current UX Decisions

These decisions were made after testing screenshots and user feedback:

- Do not show the tooltip below by default because it blocks the next lines of chat.
- Do not use a blue background because it looks too much like a separate component.
- Use a neutral graphite/dark tooltip that blends with Antigravity's dark UI but remains readable.
- Do not show the English source line because it makes the tooltip feel bulky.
- Keep font small like EnVi dictionary.
- Do not translate Vietnamese text.
- Do not translate entire sentences when the user expects only up to comma.
- Do not make tooltip follow the mouse continuously. It should appear after hover delay.

## Bugs Already Fixed

### Antigravity Corrupt Warning

Directly patching `workbench-jetski-agent.html` caused Antigravity to warn that the install was corrupt.

Fix: runtime injection through CDP instead of modifying app files.

### Trusted Types Error

Using `innerHTML` failed because Antigravity requires TrustedHTML assignment.

Fix: build tooltip DOM using `createElement` and `textContent`.

### Wrong Target Window

Initial injector only targeted `workbench-jetski-agent.html`.

Fix: also inject into `workbench.html`, while ignoring code editor areas.

### Tooltip Jumping

Tooltip used to follow the cursor too aggressively.

Fix: increased hover delay and removed continuous repositioning behavior.

### Tooltip Anchored To Wrong Word

Tooltip sometimes appeared near a previous word because of sticky radius logic.

Fix: removed sticky radius and anchor tooltip using the hovered word's bounding box.

### Tooltip Too Large

Tooltip used to become a large translation block.

Fix: smaller max width, smaller font, preview text, and click-to-expand.

### Tooltip Blocking Text Below

Tooltip below the cursor blocked the next lines of chat.

Fix: prefer displaying above the hovered word.

## Verification Commands

Run from:

```bash
cd /Users/ttran/Documents/Codex/2026-06-08/b-n-bi-t-t-i/outputs/ag-chat-envi-hover
```

Then:

```bash
node --check ag-envi-hover.js
node --check runtime-injector.mjs
bash -n launch-runtime.sh
bash -n "Start Antigravity EnVi Hover.command"
```

## Current Implementation Notes

### Important Functions In `ag-envi-hover.js`

```text
install()
```

Creates tooltip, installs listeners, stores version.

```text
onMouseMove(event)
```

Starts delayed hover detection.

```text
translateAtPoint(clientX, clientY)
```

Gets selected text or hovered clause, validates whether to translate, calls translation backend, then shows tooltip.

```text
getHoverRequestAtPoint(clientX, clientY)
```

Finds the text node under the cursor, extracts the hover clause, and calculates the anchor point from the hovered word's bounding box.

```text
extractHoverClause(rawText, rawOffset)
```

Extracts clause up to comma, punctuation, newline, or dash boundary.

```text
shouldTranslate(text)
```

Skips non-English/Vietnamese-looking text.

```text
showTooltip(...)
```

Stores tooltip state and renders it.

```text
renderTooltip()
```

Displays preview or expanded text.

```text
positionTooltip(clientX, clientY)
```

Positions tooltip, preferring above the anchor point.

```text
toggleEnabled()
```

Toggles hover translation with `Option + T`.

## Suggested Next Work

### Best Next Improvement

Improve translation naturalness without translating past the comma.

Current Google Translate output can still feel machine-like. But the user explicitly wants only up to comma, not whole sentence. Possible improvement:

- Keep `sourceText` as the comma-limited clause.
- Add optional nearby context only as hidden context if using an AI/local translation backend.
- Return translation only for the clause.

This is hard with raw Google Translate because it does not support "context but only translate this span" cleanly.

### Possible Better Backend

Use a local or API translation endpoint that supports instructions:

```text
Translate only TARGET into natural Vietnamese.
Use CONTEXT only to understand meaning.
Do not translate CONTEXT.
```

For example:

```text
CONTEXT: ... full sentence ...
TARGET: Let's translate their request first
```

Return only Vietnamese for TARGET.

### UI Tuning Still Possible

If the tooltip still feels slightly off:

- Tune `hoverDelayMs`.
- Tune `gap` in `positionTooltip()`.
- Tune `max-width`.
- Tune font size.
- Tune background opacity.

Current values are intentionally conservative and dictionary-like.

### Packaging

The current setup works but is still a local runtime injector. Future packaging ideas:

- Make a small menu-bar app.
- Make a persistent background launcher.
- Add a config JSON file.
- Add a simple enable/disable UI.

## Do Not Forget

Never use direct patch mode unless explicitly debugging. Runtime injection is the safe path.

