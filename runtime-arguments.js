const fs = require('fs');
const path = require('path');
const os = require('os');
const { applyEdits, modify, parse } = require('jsonc-parser');

const DEBUG_PORT = '9333';
const ARGV_FILE = path.join(os.homedir(), '.antigravity-ide', 'argv.json');

function isConfigured() {
  const document = readDocument();
  return document && String(document.value['remote-debugging-port']) === DEBUG_PORT;
}

function install() {
  if (isConfigured()) return;
  updateValue(DEBUG_PORT);
}

function uninstall() {
  const document = readDocument();
  if (!document || String(document.value['remote-debugging-port']) !== DEBUG_PORT) return;
  updateValue(undefined);
}

function updateValue(value) {
  fs.mkdirSync(path.dirname(ARGV_FILE), { recursive: true });
  const document = readDocument() || { text: '{}\n', value: {} };
  const edits = modify(document.text, ['remote-debugging-port'], value, {
    formattingOptions: {
      insertSpaces: false,
      tabSize: 2,
      eol: detectEol(document.text)
    }
  });
  fs.writeFileSync(ARGV_FILE, ensureTrailingNewline(applyEdits(document.text, edits)), 'utf8');
}

function readDocument() {
  try {
    const text = fs.readFileSync(ARGV_FILE, 'utf8');
    const errors = [];
    const value = parse(text, errors, { allowTrailingComma: true, disallowComments: false });
    if (errors.length || !value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`Cannot safely update invalid runtime arguments file: ${ARGV_FILE}`);
    }
    return { text, value };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function detectEol(text) {
  return text.includes('\r\n') ? '\r\n' : '\n';
}

function ensureTrailingNewline(text) {
  return text.endsWith('\n') ? text : `${text}\n`;
}

module.exports = {
  install,
  uninstall,
  isConfigured
};
