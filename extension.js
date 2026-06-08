const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const cp = require('child_process');

let statusBarItem;
let pollTimer;
const injectedTargets = new Set();
let messageId = 0;
let isConnected = false;

function activate(context) {
  // Create status bar item
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'smart-chat-hover-translate.click';
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();
  updateStatusBar(false);

  // Register Click command
  const clickDisposable = vscode.commands.registerCommand('smart-chat-hover-translate.click', async () => {
    if (isConnected) {
      // Toggle translation instantly on all active targets
      try {
        const targets = await getTargets();
        for (const target of targets) {
          if (!isAgentTarget(target)) continue;
          await evalInTarget(target, "window.__agEnviHover?.toggleEnabled?.()");
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to toggle translation: ${err.message}`);
      }
    } else {
      // Relaunch prompt
      vscode.window.showInformationMessage('Antigravity debug port is not enabled. Relaunch IDE with translation support?', 'Yes', 'No')
        .then(selection => {
          if (selection === 'Yes') {
            relaunchIDE();
          }
        });
    }
  });
  context.subscriptions.push(clickDisposable);

  // Load the script content
  const scriptPath = path.join(context.extensionPath, 'ag-envi-hover.js');
  let script = '';
  try {
    script = fs.readFileSync(scriptPath, 'utf8');
  } catch (err) {
    vscode.window.showErrorMessage(`Failed to load translation script: ${err.message}`);
    return;
  }

  // Start polling
  startPolling(script);
}

function deactivate() {
  if (pollTimer) clearInterval(pollTimer);
  injectedTargets.clear();
}

function updateStatusBar(active) {
  isConnected = active;
  if (active) {
    statusBarItem.text = '$(translation) Smart Translate: Active';
    statusBarItem.tooltip = 'Hover translation is running. Click to toggle translate state.';
    statusBarItem.backgroundColor = undefined;
  } else {
    statusBarItem.text = '$(alert) Smart Translate: Relaunch';
    statusBarItem.tooltip = 'Click to relaunch Antigravity with debugging enabled.';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  }
}

function relaunchIDE() {
  if (process.platform === 'win32') {
    try {
      // Run detached cmd shell to wait 1 second before opening, allowing current instance to exit
      cp.spawn('cmd', ['/c', `timeout /t 1 /nobreak >nul && "${process.execPath}" --remote-debugging-port=9333`], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to launch IDE on Windows: ${err.message}`);
    }
  } else {
    let appPath = "/Applications/Antigravity IDE.app";
    const match = process.execPath.match(/(.*\/Antigravity IDE\.app)/);
    if (match && match[1]) {
      appPath = match[1];
    }

    // Run detached shell with sleep delay to allow current instance to fully exit
    cp.exec(`(sleep 1.2 && open -a "${appPath}" --args --remote-debugging-port=9333) &`, (err) => {
      if (err) {
        vscode.window.showErrorMessage(`Failed to launch IDE on macOS: ${err.message}`);
      }
    });
  }

  // Quit current session
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
