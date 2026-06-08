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
let automaticRelaunchStarted = false;
const AUTOMATIC_RELAUNCH_SECONDS = 10;
const HELPER_LABEL = 'dev.trantrandev.ag-envi-hover.auto-relaunch';
const HELPER_DIR = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Smart Chat Hover Translate');
const HELPER_MONITOR = path.join(HELPER_DIR, 'auto-relaunch-monitor.sh');
const HELPER_PLIST = path.join(process.env.HOME || '', 'Library', 'LaunchAgents', `${HELPER_LABEL}.plist`);
const RELAUNCH_REQUEST_FILE = '/tmp/ag-envi-hover-relaunch-request';

async function activate(context) {
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
      if (process.platform === 'darwin') {
        await ensureAutoHelper(context.extensionPath);
        scheduleAutomaticRelaunch();
      }
    }
  });
  context.subscriptions.push(clickDisposable);

  context.subscriptions.push(vscode.commands.registerCommand('smart-chat-hover-translate.installAutoHelper', async () => {
    try {
      await installAutoHelper(context.extensionPath);
      vscode.window.showInformationMessage('Smart Translate automatic startup was installed.');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to install automatic helper: ${err.message}`);
    }
  }));

  context.subscriptions.push(vscode.commands.registerCommand('smart-chat-hover-translate.uninstallAutoHelper', async () => {
    try {
      await uninstallAutoHelper();
      vscode.window.showInformationMessage('Smart Translate automatic startup helper was removed.');
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to remove automatic helper: ${err.message}`);
    }
  }));

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

  if (process.platform === 'darwin') {
    setTimeout(() => {
      installAutoHelper(context.extensionPath)
        .then(async () => {
          if (!await isDebugPortOpen()) {
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

async function ensureAutoHelper(extensionPath) {
  if (process.platform !== 'darwin') {
    return;
  }

  if (isAutoHelperInstalled()) {
    return;
  }

  await installAutoHelper(extensionPath);
}

function isAutoHelperInstalled() {
  return process.platform === 'darwin'
    && fs.existsSync(HELPER_MONITOR)
    && fs.existsSync(HELPER_PLIST);
}

async function installAutoHelper(extensionPath) {
  const bundledMonitor = path.join(extensionPath, 'auto-relaunch-monitor.sh');
  if (!fs.existsSync(bundledMonitor)) {
    throw new Error('The packaged automatic helper is missing.');
  }

  fs.mkdirSync(HELPER_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(HELPER_PLIST), { recursive: true });
  fs.copyFileSync(bundledMonitor, HELPER_MONITOR);
  fs.chmodSync(HELPER_MONITOR, 0o755);

  const plist = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"',
    '  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
    '<plist version="1.0">',
    '<dict>',
    '  <key>Label</key>',
    `  <string>${HELPER_LABEL}</string>`,
    '  <key>ProgramArguments</key>',
    '  <array>',
    `    <string>${escapeXml(HELPER_MONITOR)}</string>`,
    '  </array>',
    '  <key>RunAtLoad</key>',
    '  <true/>',
    '  <key>KeepAlive</key>',
    '  <true/>',
    '  <key>EnvironmentVariables</key>',
    '  <dict>',
    '    <key>AG_ENVI_REQUIRE_EXTENSION</key>',
    '    <string>1</string>',
    '    <key>AG_ENVI_STARTUP_GRACE_SECONDS</key>',
    '    <string>12</string>',
    '  </dict>',
    '  <key>StandardOutPath</key>',
    '  <string>/tmp/ag-envi-hover-auto-relaunch.stdout.log</string>',
    '  <key>StandardErrorPath</key>',
    '  <string>/tmp/ag-envi-hover-auto-relaunch.stderr.log</string>',
    '</dict>',
    '</plist>',
    ''
  ].join('\n');
  fs.writeFileSync(HELPER_PLIST, plist, 'utf8');

  const service = `gui/${process.getuid()}/${HELPER_LABEL}`;
  if (!await isLaunchServiceLoaded(service)) {
    await execFile('launchctl', ['bootstrap', `gui/${process.getuid()}`, HELPER_PLIST]);
    await execFile('launchctl', ['enable', service]);
    await execFile('launchctl', ['kickstart', '-k', service]);
  } else {
    await execFile('launchctl', ['kickstart', '-k', service]);
  }
}

async function uninstallAutoHelper() {
  if (process.platform !== 'darwin') return;
  const service = `gui/${process.getuid()}/${HELPER_LABEL}`;
  await execFileAllowFailure('launchctl', ['bootout', service]);
  fs.rmSync(HELPER_PLIST, { force: true });
  fs.rmSync(HELPER_DIR, { recursive: true, force: true });
}

function execFile(command, args) {
  return new Promise((resolve, reject) => {
    cp.execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || error.message).trim()));
        return;
      }
      resolve(stdout);
    });
  });
}

function execFileAllowFailure(command, args) {
  return new Promise(resolve => {
    cp.execFile(command, args, () => resolve());
  });
}

function isLaunchServiceLoaded(service) {
  return new Promise(resolve => {
    cp.execFile('launchctl', ['print', service], error => resolve(!error));
  });
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function relaunchIDE() {
  const parentPid = process.ppid || process.pid;

  if (process.platform === 'win32') {
    try {
      // Run detached PowerShell cmd to wait until parent process PID exits before spawning the new instance
      cp.spawn('powershell', ['-Command', `while (Get-Process -Id ${parentPid} -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 100 }; Start-Process '${process.execPath}' -ArgumentList '--remote-debugging-port=9333'`], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to launch IDE on Windows: ${err.message}`);
    }
  } else {
    try {
      fs.writeFileSync(RELAUNCH_REQUEST_FILE, String(Date.now()), 'utf8');
    } catch {
      // The helper also watches the running app state; the request file is best effort.
    }

    // Detect the app bundle from execPath. Note: inside the extension host,
    // execPath points INTO the helper bundle, e.g.
    //   /Applications/Antigravity IDE.app/Contents/Frameworks/Antigravity IDE Helper (Plugin).app/Contents/MacOS/...
    // We must relaunch the OUTERMOST .app (the main IDE), not the nested helper
    // .app, otherwise `open` launches the helper which immediately exits and the
    // IDE never comes back. Cut at the FIRST ".app/" to get the outer bundle.
    let appPath = "";
    const execIdx = process.execPath.indexOf(".app/");
    if (execIdx !== -1) {
      appPath = process.execPath.slice(0, execIdx + 4);
    }

    // Validate the detected path; fall back to common install locations.
    if (!appPath || !appPath.toLowerCase().includes("antigravity") || !fs.existsSync(appPath)) {
      const candidates = [
        "/Applications/Antigravity IDE.app",
        "/Applications/Antigravity.app",
        `${process.env.HOME}/Applications/Antigravity IDE.app`,
        `${process.env.HOME}/Applications/Antigravity.app`,
      ];
      appPath = "";
      for (const c of candidates) {
        if (fs.existsSync(c)) { appPath = c; break; }
      }
    }

    if (!appPath) {
      vscode.window.showErrorMessage('Cannot find Antigravity IDE app. Please relaunch manually with --remote-debugging-port=9333.');
      return;
    }

    // The LaunchAgent helper performs the actual reopen. This is much more
    // reliable than trying to spawn a child while the Electron host is quitting.
    try {
      const tmpScript = `/tmp/ag-relaunch-${Date.now()}.sh`;
      const scriptContent = [
        '#!/bin/bash',
        `LOG=/tmp/ag-relaunch.log`,
        `echo "[$(date)] Relaunch requested for helper; appPath=${appPath}" >> $LOG`,
        `rm -f "$0"`,
        ''
      ].join('\n');
      fs.writeFileSync(tmpScript, scriptContent, { mode: 0o755 });
      cp.spawn('/bin/bash', [tmpScript], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to launch IDE on macOS: ${err.message}`);
    }
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
