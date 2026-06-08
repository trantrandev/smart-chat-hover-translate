const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const autoHelper = require('./auto-helper');

let statusBarItem;
let pollTimer;
const injectedTargets = new Set();
let messageId = 0;
let isConnected = false;
let automaticRelaunchStarted = false;
const AUTOMATIC_RELAUNCH_SECONDS = 10;

async function activate(context) {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'smart-chat-hover-translate.click';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();
  updateStatusBar(false);

  const clickDisposable = vscode.commands.registerCommand('smart-chat-hover-translate.click', async () => {
    if (isConnected) {
      try {
        const targets = await getTargets();
        for (const target of targets) {
          if (!isAgentTarget(target)) continue;
          await evalInTarget(target, "window.__agEnviHover?.toggleEnabled?.()");
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to toggle translation: ${err.message}`);
      }
      return;
    }

    if (autoHelper.isSupported()) {
      await autoHelper.ensure(context.extensionPath);
      scheduleAutomaticRelaunch();
    }
  });
  context.subscriptions.push(clickDisposable);

  context.subscriptions.push(vscode.commands.registerCommand('smart-chat-hover-translate.installAutoHelper', async () => {
    try {
      await autoHelper.install(context.extensionPath);
      vscode.window.showInformationMessage('Smart Translate automatic startup was installed.');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to install automatic helper: ${err.message}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('smart-chat-hover-translate.uninstallAutoHelper', async () => {
    try {
      await autoHelper.uninstall();
      vscode.window.showInformationMessage('Smart Translate automatic startup helper was removed.');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to remove automatic helper: ${err.message}`);
    }
  }));

  const scriptPath = path.join(context.extensionPath, 'ag-envi-hover.js');
  let script = '';
  try {
    script = fs.readFileSync(scriptPath, 'utf8');
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to load translation script: ${err.message}`);
    return;
  }

  startPolling(script);

  if (autoHelper.isSupported()) {
    setTimeout(() => {
      autoHelper.install(context.extensionPath)
        .then(async () => {
          if (!await isDebugPortOpen() && autoHelper.canAutoRelaunch()) {
            scheduleAutomaticRelaunch();
          }
        })
        .catch(err => {
          console.error(`Automatic startup setup failed: ${err.message}`);
          vscode.window.showErrorMessage(`Smart Translate could not configure automatic startup: ${err.message}`);
        });
    }, 1200);
  }
}

function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
  injectedTargets.clear();
}

function updateStatusBar(active) {
  isConnected = active;
  if (automaticRelaunchStarted) return;

  if (active) {
    statusBarItem.text = '$(translation) Smart Translate: Active';
    statusBarItem.tooltip = 'Hover translation is running. Click to toggle translate state.';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(alert) Smart Translate: Waiting';
    statusBarItem.tooltip = 'Translation port is not active yet. Automatic restart will be prepared.';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
}

function scheduleAutomaticRelaunch() {
  if (automaticRelaunchStarted) return;
  automaticRelaunchStarted = true;

  let secondsLeft = AUTOMATIC_RELAUNCH_SECONDS;
  vscode.window.showInformationMessage(
    `Smart Translate đã được cài đặt. Antigravity sẽ tự khởi động lại sau ${secondsLeft} giây để bật cổng dịch 9333.`
  );

  statusBarItem.text = `$(sync~spin) Smart Translate: Restart in ${secondsLeft}s`;
  statusBarItem.tooltip = 'Antigravity will restart automatically to enable translation port 9333.';
  statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');

  const countdown = setInterval(() => {
    if (!automaticRelaunchStarted) {
      clearInterval(countdown);
      return;
    }

    secondsLeft -= 1;

    if (secondsLeft <= 0) {
      clearInterval(countdown);
      if (!automaticRelaunchStarted) return;
      automaticRelaunchStarted = false;
      relaunchIDE();
      return;
    }

    statusBarItem.text = `$(sync~spin) Smart Translate: Restart in ${secondsLeft}s`;
  }, 1000);
}

function isDebugPortOpen() {
  return new Promise(resolve => {
    const req = http.get('http://127.0.0.1:9333/json/version', { timeout: 800 }, res => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.on('error', () => resolve(false));
  });
}

function relaunchIDE() {
  try {
    autoHelper.requestRelaunch({
      executablePath: process.env.VSCODE_EXEC_PATH || process.execPath,
      parentPid: process.pid
    });
  } catch {
    // The helper also watches the running app state; the request file is best effort.
  }

  vscode.commands.executeCommand('workbench.action.quit');
}

function startPolling(script) {
  pollTimer = setInterval(async () => {
    try {
      const targets = await getTargets();
      let activeInjection = false;

      for (const target of targets) {
        if (!isAgentTarget(target)) continue;
        activeInjection = true;

        if (injectedTargets.has(target.id)) continue;

        await inject(target, script);
        injectedTargets.add(target.id);
        console.log(`Injected translation tool into target: ${target.id}`);
      }

      updateStatusBar(activeInjection);
    } catch (err) {
      updateStatusBar(false);
    }
  }, 2000);
}

function getTargets() {
  return new Promise((resolve, reject) => {
    const req = http.get('http://127.0.0.1:9333/json/list', { timeout: 1000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to get targets: ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
  });
}

function isAgentTarget(target) {
  const text = `${target.title || ""} ${target.url || ""}`.toLowerCase();
  return target.type === "page"
    && (
      text.includes("workbench-jetski-agent")
      || text.includes("/workbench/workbench.html")
      || text.includes("agent manager")
      || text.includes("antigravity")
    )
    && target.webSocketDebuggerUrl;
}

function inject(target, script) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);

    const cleanup = () => {
      socket.close();
    };

    socket.on('open', async () => {
      try {
        await send(socket, "Runtime.enable");
        const result = await send(socket, "Runtime.evaluate", {
          expression: script,
          awaitPromise: false,
          includeCommandLineAPI: false,
        });
        if (result.exceptionDetails) {
          const message = result.exceptionDetails.exception?.description
            || result.exceptionDetails.text
            || "unknown Runtime.evaluate exception";
          throw new Error(message);
        }
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    });

    socket.on('error', (err) => {
      reject(err);
      cleanup();
    });
  });
}

function evalInTarget(target, expression) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(target.webSocketDebuggerUrl);
    const cleanup = () => {
      socket.close();
    };

    socket.on('open', async () => {
      try {
        await send(socket, "Runtime.enable");
        await send(socket, "Runtime.evaluate", {
          expression,
          awaitPromise: false,
          includeCommandLineAPI: false,
        });
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    });

    socket.on('error', (err) => {
      reject(err);
      cleanup();
    });
  });
}

function send(socket, method, params = {}) {
  const id = ++messageId;
  socket.send(JSON.stringify({ id, method, params }));

  return new Promise((resolve, reject) => {
    const onMessage = (data) => {
      try {
        const payload = JSON.parse(data.toString());
        if (payload.id !== id) return;
        socket.off('message', onMessage);
        if (payload.error) reject(new Error(payload.error.message));
        else resolve(payload.result);
      } catch (err) {
        reject(err);
      }
    };
    socket.on('message', onMessage);
  });
}

module.exports = {
  activate,
  deactivate
};
