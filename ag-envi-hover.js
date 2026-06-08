(() => {
  "use strict";

  const VERSION = "1.2.1";
  const existing = window.__agEnviHover;
  if (existing?.version === VERSION) {
    return;
  }
  existing?.dispose?.();

  const CONFIG = {
    hoverDelayMs: 460,
    maxSelectionLength: 900,
    maxClauseLength: 130,
    maxWordLength: 48,
    previewChars: 96,
    cacheTtlMs: 1000 * 60 * 60 * 24 * 30,
    cachePrefix: "ag-envi-hover:",
    enabledStorageKey: "ag-envi-hover:enabled",
  };

  const LOCAL_DICTIONARY = new Map(Object.entries({
    agent: "tac nhan, agent",
    artifact: "tao tac pham, ket qua/phu pham",
    branch: "nhanh",
    build: "bien dich, xay dung",
    cache: "bo nho dem",
    chat: "tro chuyen",
    checkout: "chuyen nhanh / lay phien ban",
    command: "lenh",
    commit: "ban ghi commit",
    config: "cau hinh",
    context: "ngu canh",
    database: "co so du lieu",
    deploy: "trien khai",
    diff: "khac biet",
    error: "loi",
    extension: "tien ich mo rong",
    file: "tep",
    folder: "thu muc",
    generate: "tao ra",
    hover: "di chuot len",
    implement: "trien khai, cai dat",
    input: "dau vao",
    issue: "van de",
    log: "nhat ky",
    merge: "hop nhat",
    message: "tin nhan",
    output: "dau ra",
    patch: "ban va / sua doi",
    prompt: "loi nhac",
    request: "yeu cau",
    response: "phan hoi",
    review: "danh gia, xem lai",
    run: "chay",
    script: "tap lenh",
    selection: "phan duoc chon",
    setting: "cai dat",
    status: "trang thai",
    task: "nhiem vu",
    terminal: "thiet bi dau cuoi, terminal",
    test: "kiem thu",
    thread: "luong hoi thoai",
    token: "ma / token",
    tool: "cong cu",
    update: "cap nhat",
    user: "nguoi dung",
    workspace: "khong gian lam viec",
  }));

  let tooltip;
  let styleElement;
  let hoverTimer = 0;
  let statusTimer = 0;
  let lastRequestKey = "";
  let abortController = null;
  let lastPoint = { x: 0, y: 0 };
  let tooltipAnchor = { x: 0, y: 0 };
  let enabled = readEnabled();
  let tooltipState = {
    source: "",
    result: "",
    expanded: false,
  };

  function install() {
    createTooltip();
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown, true);
    document.documentElement.dataset.agEnviHover = VERSION;
    window.__agEnviHover = {
      version: VERSION,
      dispose,
      toggleEnabled,
      setEnabled,
      get enabled() {
        return enabled;
      },
    };
  }

  function dispose() {
    clearTimeout(hoverTimer);
    clearTimeout(statusTimer);
    abortController?.abort();
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.querySelectorAll("#ag-envi-hover-tooltip, #ag-envi-hover-style")
      .forEach(element => element.remove());
    if (window.__agEnviHover?.version === VERSION) {
      delete window.__agEnviHover;
    }
  }

  function onScroll() {
    hideTooltip();
  }

  function onKeyDown(event) {
    if (event.altKey && !event.metaKey && !event.ctrlKey && (event.key.toLowerCase() === "t" || event.code === "KeyT" || event.key === "†")) {
      event.preventDefault();
      toggleEnabled();
      return;
    }

    if (event.key === "Escape") hideTooltip();
  }

  function createTooltip() {
    if (tooltip) return;

    document.querySelectorAll("#ag-envi-hover-tooltip, #ag-envi-hover-style")
      .forEach(element => element.remove());

    styleElement = document.createElement("style");
    styleElement.id = "ag-envi-hover-style";
    styleElement.textContent = `
      #ag-envi-hover-tooltip {
        position: fixed;
        z-index: 2147483647;
        width: max-content;
        max-width: min(230px, calc(100vw - 28px));
        padding: 6px 8px 7px;
        border: 1px solid rgba(226, 232, 240, 0.18);
        border-radius: 6px;
        background: rgba(58, 63, 78, 0.96);
        color: rgba(255, 255, 255, 0.98);
        box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08);
        font: 11.5px/1.34 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        text-align: center;
        pointer-events: none;
        white-space: normal;
        overflow-wrap: anywhere;
        opacity: 0;
        transform: translate3d(0, 3px, 0);
        transform-origin: top left;
        transition: opacity 90ms ease, transform 90ms ease;
        backdrop-filter: blur(10px) saturate(1.12);
      }
      #ag-envi-hover-tooltip[data-visible="true"] {
        opacity: 1;
        transform: translate3d(0, 0, 0);
        pointer-events: auto;
      }
      #ag-envi-hover-tooltip[data-expandable="true"] {
        cursor: zoom-in;
      }
      #ag-envi-hover-tooltip[data-expandable="true"][data-expanded="true"] {
        cursor: zoom-out;
        max-width: min(360px, calc(100vw - 28px));
      }
      #ag-envi-hover-tooltip::before {
        content: "";
        position: absolute;
        width: 9px;
        height: 9px;
        background: rgba(58, 63, 78, 0.96);
        border: 1px solid rgba(226, 232, 240, 0.18);
        transform: rotate(45deg);
        left: var(--ag-envi-arrow-left, 14px);
        pointer-events: none;
      }
      #ag-envi-hover-tooltip[data-placement="below"]::before {
        top: -6px;
        border-right: 0;
        border-bottom: 0;
      }
      #ag-envi-hover-tooltip[data-placement="above"]::before {
        bottom: -6px;
        border-left: 0;
        border-top: 0;
      }
      #ag-envi-hover-tooltip .ag-envi-source {
        display: none;
      }
      #ag-envi-hover-tooltip .ag-envi-result {
        color: rgba(255, 255, 255, 0.98);
        font-size: 11px !important;
        font-weight: 500;
        line-height: 1.34;
        max-height: 47px;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 3;
        -webkit-box-orient: vertical;
      }
      #ag-envi-hover-tooltip[data-expanded="true"] .ag-envi-source {
        display: none;
      }
      #ag-envi-hover-tooltip[data-expanded="true"] .ag-envi-result {
        display: block;
        max-height: min(260px, calc(100vh - 140px));
        overflow: auto;
        -webkit-line-clamp: unset;
      }
      #ag-envi-hover-tooltip[data-loading="true"] .ag-envi-result {
        color: #475569;
      }
      #ag-envi-hover-tooltip[data-loading="true"] .ag-envi-result::after {
        content: "";
        display: inline-block;
        width: 6px;
        height: 6px;
        margin-left: 8px;
        border-radius: 50%;
        background: #38bdf8;
        animation: ag-envi-pulse 900ms ease-in-out infinite;
        vertical-align: 1px;
      }
      @keyframes ag-envi-pulse {
        0%, 100% { opacity: 0.35; transform: scale(0.8); }
        50% { opacity: 1; transform: scale(1.15); }
      }
      #ag-envi-hover-status {
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 2147483647;
        padding: 6px 9px;
        border: 1px solid rgba(226, 232, 240, 0.16);
        border-radius: 6px;
        background: rgba(42, 46, 58, 0.94);
        color: rgba(255, 255, 255, 0.94);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
        font: 11px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
        pointer-events: none;
        opacity: 0;
        transform: translateY(4px);
        transition: opacity 120ms ease, transform 120ms ease;
      }
      #ag-envi-hover-status[data-visible="true"] {
        opacity: 1;
        transform: translateY(0);
      }
    `;
    document.head.appendChild(styleElement);

    tooltip = document.createElement("div");
    tooltip.id = "ag-envi-hover-tooltip";
    tooltip.setAttribute("role", "tooltip");

    const source = document.createElement("div");
    source.className = "ag-envi-source";
    const result = document.createElement("div");
    result.className = "ag-envi-result";
    tooltip.append(source, result);
    tooltip.addEventListener("click", onTooltipClick);
    tooltip.addEventListener("mousedown", event => event.preventDefault());

    document.body.appendChild(tooltip);

    const status = document.createElement("div");
    status.id = "ag-envi-hover-status";
    document.body.appendChild(status);
  }

  function onMouseMove(event) {
    lastPoint = { x: event.clientX, y: event.clientY };
    if (!enabled) {
      hideTooltip();
      return;
    }

    const target = event.target;
    if (!(target instanceof Element) && !(target instanceof Text)) return;
    const element = target instanceof Element ? target : target.parentElement;
    if (element?.closest("#ag-envi-hover-tooltip")) return;
    if (isIgnoredTarget(target)) {
      hideTooltip();
      return;
    }

    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      translateAtPoint(event.clientX, event.clientY);
    }, CONFIG.hoverDelayMs);
  }

  async function translateAtPoint(clientX, clientY) {
    const request = getSelectedTextRequest() || getHoverRequestAtPoint(clientX, clientY);
    if (!request) {
      hideTooltip();
      return;
    }
    if (!shouldTranslate(request.textToTranslate)) {
      hideTooltip();
      return;
    }

    const requestKey = request.textToTranslate.toLowerCase();
    if (requestKey === lastRequestKey && tooltip?.dataset.visible === "true") {
      return;
    }

    lastRequestKey = requestKey;
    abortController?.abort();
    abortController = new AbortController();
    const anchorPoint = request.anchorPoint ?? { x: clientX, y: clientY };

    const instant = getInstantTranslation(request.textToTranslate);
    if (instant) {
      showTooltip(anchorPoint.x, anchorPoint.y, request.sourceText, instant, false);
      return;
    }

    try {
      const translated = await translate(request.textToTranslate, request.contextText, abortController.signal);
      if (!translated || translated.toLowerCase() === request.textToTranslate.toLowerCase()) {
        hideTooltip();
        return;
      }
      showTooltip(anchorPoint.x, anchorPoint.y, request.sourceText, translated, false);
    } catch (error) {
      if (error?.name !== "AbortError") {
        const fallback = LOCAL_DICTIONARY.get(request.textToTranslate.toLowerCase());
        if (fallback) showTooltip(anchorPoint.x, anchorPoint.y, request.sourceText, fallback, false);
        else hideTooltip();
      }
    }
  }

  function getSelectedTextRequest() {
    const selection = window.getSelection();
    const text = selection?.toString().trim().replace(/\s+/g, " ");
    if (!text || text.length > CONFIG.maxSelectionLength) return null;
    if (!/[A-Za-z]/.test(text)) return null;
    return {
      sourceText: text,
      textToTranslate: text,
    };
  }

  function shouldTranslate(text) {
    const normalized = text.trim();
    if (!/[A-Za-z]/.test(normalized)) return false;
    if (hasVietnameseMarks(normalized)) return false;

    const latinWords = normalized.match(/[A-Za-z][A-Za-z'-]*/g) ?? [];
    if (!latinWords.length) return false;

    const asciiLetters = (normalized.match(/[A-Za-z]/g) ?? []).length;
    const nonAsciiLetters = (normalized.match(/[^\x00-\x7F]/g) ?? []).length;
    if (nonAsciiLetters > 0 && nonAsciiLetters / Math.max(1, asciiLetters + nonAsciiLetters) > 0.08) {
      return false;
    }

    return true;
  }

  function hasVietnameseMarks(text) {
    return /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i
      .test(text);
  }

  function getHoverRequestAtPoint(clientX, clientY) {
    const range = getCaretRange(clientX, clientY);
    if (!range) return null;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;
    if (!node.textContent || !/[A-Za-z]/.test(node.textContent)) return null;
    if (isIgnoredTarget(node.parentElement)) return null;

    const container = findReadableContainer(node);
    const textInfo = getContainerTextAndOffset(container, node, range.startOffset);
    const wordRect = getWordRectAtPoint(node, range.startOffset);
    const anchorPoint = getAnchorPoint(wordRect, clientX, clientY);
    const sourceText = extractHoverClause(textInfo.text, textInfo.offset);
    if (sourceText) {
      return {
        sourceText,
        textToTranslate: sourceText,
        contextText: textInfo.text,
        anchorPoint,
      };
    }

    const word = getWordFromText(node.textContent, range.startOffset);
    return word
      ? { sourceText: word, textToTranslate: word, contextText: node.textContent, anchorPoint }
      : null;
  }

  function findReadableContainer(textNode) {
    let element = textNode.parentElement;
    let best = element;

    while (element && element !== document.body) {
      if (isIgnoredTarget(element)) break;

      const text = element.textContent?.trim().replace(/\s+/g, " ") ?? "";
      if (text.length >= 8 && text.length <= 1200) {
        best = element;
      }

      const display = getComputedStyle(element).display;
      const looksBlock = display.includes("block")
        || display.includes("flex")
        || element.matches("p, li, blockquote, article, section");

      if (looksBlock && text.length >= 24) break;
      element = element.parentElement;
    }

    return best ?? textNode.parentElement;
  }

  function getContainerTextAndOffset(container, targetNode, targetOffset) {
    if (!container) {
      return { text: targetNode.textContent ?? "", offset: targetOffset };
    }

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let text = "";
    let offset = 0;
    let found = false;
    let current;

    while ((current = walker.nextNode())) {
      if (current === targetNode) {
        offset = text.length + Math.min(targetOffset, current.textContent?.length ?? 0);
        found = true;
      }
      text += current.textContent ?? "";
    }

    return { text, offset: found ? offset : targetOffset };
  }

  function extractHoverClause(rawText, rawOffset) {
    const compact = compactWithOffset(rawText, rawOffset);
    const text = compact.text;
    const offset = compact.offset;

    if (!text || !/[A-Za-z]/.test(text)) return "";

    const clause = extractClause(text, offset);
    const cleaned = cleanupCandidate(clause.text);
    if (
      cleaned
      && cleaned.length <= CONFIG.maxClauseLength
      && countEnglishWords(cleaned) >= 2
    ) {
      return cleaned;
    }

    return getWordFromText(text, offset);
  }

  function compactWithOffset(rawText, rawOffset) {
    let text = "";
    let offset = 0;
    let previousWasSpace = false;

    for (let index = 0; index < rawText.length; index++) {
      if (index === rawOffset) offset = text.length;
      const char = rawText[index];
      const isSpace = /\s/.test(char);

      if (isSpace) {
        if (!previousWasSpace) {
          text += " ";
          previousWasSpace = true;
        }
      } else {
        text += char;
        previousWasSpace = false;
      }
    }

    if (rawOffset >= rawText.length) offset = text.length;
    return { text: text.trim(), offset: Math.min(offset, text.trim().length) };
  }

  function extractClause(text, offset) {
    const start = findClauseStart(text, offset);
    const end = findClauseEnd(text, offset);
    return { start, text: text.slice(start, end) };
  }

  function findClauseStart(text, offset) {
    const left = text.slice(0, offset);
    const matches = [...left.matchAll(/[.!?,;:][)"'\]]?\s+|\n+|[-–—]\s+/g)];
    if (!matches.length) return 0;
    const match = matches[matches.length - 1];
    return (match.index ?? 0) + match[0].length;
  }

  function findClauseEnd(text, offset) {
    const right = text.slice(offset);
    const match = right.match(/[.!?,;:][)"'\]]?(?=\s|$)|\n+|\s[-–—]\s+/);
    if (!match) return text.length;
    return offset + (match.index ?? 0) + match[0].length;
  }

  function cleanupCandidate(text) {
    return text
      .replace(/\s+/g, " ")
      .replace(/^[\s"'([{<:;,-]+|[\s"'>\])}:;,-]+$/g, "")
      .trim();
  }

  function countEnglishWords(text) {
    return (text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length;
  }

  function getWordFromText(text, offset) {
    const matches = text.matchAll(/[A-Za-z][A-Za-z'-]{0,47}/g);
    for (const match of matches) {
      const word = match[0].replace(/^[-']+|[-']+$/g, "");
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (offset >= start && offset <= end && word.length <= CONFIG.maxWordLength) {
        return word;
      }
    }
    return "";
  }

  function getWordRectAtPoint(textNode, offset) {
    const text = textNode.textContent ?? "";
    const matches = text.matchAll(/[A-Za-z][A-Za-z'-]{0,47}/g);
    for (const match of matches) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (offset < start || offset > end) continue;

      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const rect = range.getBoundingClientRect();
      range.detach?.();

      if (rect.width > 0 && rect.height > 0) return rect;
    }
    return null;
  }

  function getAnchorPoint(rect, fallbackX, fallbackY) {
    if (!rect) return { x: fallbackX, y: fallbackY };
    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  }

  function getCaretRange(clientX, clientY) {
    if (document.caretRangeFromPoint) {
      return document.caretRangeFromPoint(clientX, clientY);
    }

    const position = document.caretPositionFromPoint?.(clientX, clientY);
    if (!position) return null;

    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  function isIgnoredTarget(target) {
    const element = target instanceof Element ? target : target?.parentElement;
    if (!element) return true;

    return Boolean(element.closest([
      "#ag-envi-hover-tooltip",
      "input",
      "textarea",
      "select",
      "button",
      "a",
      "code",
      "pre",
      "[contenteditable='true']",
      "[role='textbox']",
      ".monaco-editor",
      ".xterm",
    ].join(",")));
  }

  async function translate(text, context, signal) {
    const normalized = text.trim().replace(/\s+/g, " ");
    const lower = normalized.toLowerCase();
    const dictionaryHit = LOCAL_DICTIONARY.get(lower);
    if (dictionaryHit) return dictionaryHit;

    const cached = readCache(lower);
    if (cached) return cached;

    let translated = "";
    if (context && typeof context === "string") {
      const trimmedContext = context.replace(/\s+/g, " ").trim();
      const index = trimmedContext.toLowerCase().indexOf(normalized.toLowerCase());
      if (index !== -1) {
        const wrappedContext = trimmedContext.slice(0, index)
          + `[${trimmedContext.slice(index, index + normalized.length)}]`
          + trimmedContext.slice(index + normalized.length);
        
        const fullTranslation = await translateWithGoogle(wrappedContext, signal)
          || await translateWithMyMemory(wrappedContext, signal);
        
        if (fullTranslation) {
          let match = fullTranslation.match(/\[([^\]]+)\]/);
          if (!match) match = fullTranslation.match(/\(([^)]+)\)/);
          if (!match) match = fullTranslation.match(/（([^）]+)）/);
          if (match && match[1]) {
            translated = match[1].trim();
          }
        }
      }
    }

    if (!translated) {
      translated = await translateWithGoogle(normalized, signal)
        || await translateWithMyMemory(normalized, signal);
    }

    if (translated) writeCache(lower, translated);
    return translated;
  }

  function getInstantTranslation(text) {
    const normalized = text.trim().replace(/\s+/g, " ");
    const lower = normalized.toLowerCase();
    return LOCAL_DICTIONARY.get(lower) || readCache(lower);
  }

  async function translateWithGoogle(text, signal) {
    const url = "https://translate.googleapis.com/translate_a/single"
      + `?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, { signal });
    if (!response.ok) return "";
    const payload = await response.json();
    return (payload?.[0] ?? [])
      .map(part => part?.[0])
      .filter(Boolean)
      .join("")
      .trim();
  }

  async function translateWithMyMemory(text, signal) {
    const url = "https://api.mymemory.translated.net/get"
      + `?q=${encodeURIComponent(text)}&langpair=en|vi`;
    const response = await fetch(url, { signal });
    if (!response.ok) return "";
    const payload = await response.json();
    return payload?.responseData?.translatedText?.trim() ?? "";
  }

  function readCache(key) {
    try {
      const raw = localStorage.getItem(CONFIG.cachePrefix + key);
      if (!raw) return "";
      const entry = JSON.parse(raw);
      if (!entry?.value || Date.now() - entry.createdAt > CONFIG.cacheTtlMs) return "";
      return entry.value;
    } catch {
      return "";
    }
  }

  function writeCache(key, value) {
    try {
      localStorage.setItem(CONFIG.cachePrefix + key, JSON.stringify({
        value,
        createdAt: Date.now(),
      }));
    } catch {
      // Cache failures should not break hovering.
    }
  }

  function showTooltip(clientX, clientY, source, result, loading) {
    if (!tooltip) return;
    tooltipState = {
      source,
      result,
      expanded: false,
    };
    tooltip.dataset.loading = loading ? "true" : "false";
    tooltipAnchor = { x: clientX, y: clientY };
    renderTooltip();
    tooltip.dataset.visible = "true";
    positionTooltip(clientX, clientY);
  }

  function onTooltipClick() {
    if (!tooltip || tooltip.dataset.expandable !== "true") return;
    tooltipState.expanded = !tooltipState.expanded;
    renderTooltip();
    positionTooltip(tooltipAnchor.x, tooltipAnchor.y);
  }

  function renderTooltip() {
    if (!tooltip) return;
    const expandable = isExpandable(tooltipState.result);
    tooltip.querySelector(".ag-envi-source").textContent = tooltipState.source;
    tooltip.querySelector(".ag-envi-result").textContent = tooltipState.expanded
      ? tooltipState.result
      : getPreviewText(tooltipState.result);
    tooltip.dataset.expandable = expandable ? "true" : "false";
    tooltip.dataset.expanded = tooltipState.expanded ? "true" : "false";
    tooltip.title = expandable
      ? "Click to expand/collapse"
      : tooltipState.source;
  }

  function isExpandable(text) {
    return text.length > CONFIG.previewChars || text.split(/\s+/).length > 16;
  }

  function getPreviewText(text) {
    if (!isExpandable(text)) return text;

    const sliced = text.slice(0, CONFIG.previewChars);
    const lastSpace = sliced.lastIndexOf(" ");
    const cutAt = lastSpace > CONFIG.previewChars * 0.62 ? lastSpace : CONFIG.previewChars;
    return `${sliced.slice(0, cutAt).trim()}...`;
  }

  function positionTooltip(clientX, clientY) {
    if (!tooltip) return;

    const margin = 10;
    const gap = 22;
    const width = tooltip.offsetWidth;
    const height = tooltip.offsetHeight;
    const safeLeft = getContentSafeLeft(clientX, clientY);
    const safeRight = window.innerWidth - margin;
    const centeredX = clientX - width / 2;
    const x = Math.min(
      Math.max(safeLeft, centeredX),
      safeRight - width,
    );
    let y = clientY - height - gap;
    let placement = "above";
    if (y < margin) {
      y = Math.min(clientY + gap, window.innerHeight - height - margin);
      placement = "below";
    }

    const arrowLeft = Math.min(
      Math.max(12, clientX - x - 5),
      Math.max(12, width - 18),
    );
    tooltip.dataset.placement = placement;
    tooltip.style.setProperty("--ag-envi-arrow-left", `${arrowLeft}px`);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${Math.max(margin, y)}px`;
  }

  function getContentSafeLeft(clientX, clientY) {
    const margin = 10;
    let element = document.elementFromPoint(clientX, clientY);
    let safeLeft = margin;

    while (element && element !== document.body) {
      const rect = element.getBoundingClientRect();
      const containsPoint = rect.left <= clientX
        && rect.right >= clientX
        && rect.top <= clientY
        && rect.bottom >= clientY;
      const contentLike = containsPoint
        && rect.width >= 360
        && rect.left > 0
        && rect.left < clientX;

      if (contentLike) {
        safeLeft = Math.max(margin, Math.floor(rect.left + 8));
      }

      element = element.parentElement;
    }

    return safeLeft;
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.dataset.visible = "false";
    lastRequestKey = "";
    clearTimeout(hoverTimer);
  }

  function readEnabled() {
    try {
      return localStorage.getItem(CONFIG.enabledStorageKey) !== "false";
    } catch {
      return true;
    }
  }

  function setEnabled(nextEnabled) {
    enabled = nextEnabled;
    try {
      localStorage.setItem(CONFIG.enabledStorageKey, enabled ? "true" : "false");
    } catch {
      // Persisting toggle state is best effort.
    }

    if (!enabled) {
      hideTooltip();
      abortController?.abort();
    }

    showStatus(`Hover translate: ${enabled ? "on" : "off"}`);
  }

  function toggleEnabled() {
    setEnabled(!enabled);
  }

  function showStatus(message) {
    const status = document.querySelector("#ag-envi-hover-status");
    if (!status) return;

    clearTimeout(statusTimer);
    status.textContent = message;
    status.dataset.visible = "true";
    statusTimer = window.setTimeout(() => {
      status.dataset.visible = "false";
    }, 1200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
