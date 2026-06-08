const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const LEGACY_WINDOWS_TASK_NAME = 'Smart Chat Hover Translate Auto Relaunch';
const HELPER_DIR = path.join(process.env.APPDATA || process.env.LOCALAPPDATA || os.homedir(), 'Smart Chat Hover Translate');
const HELPER_MONITOR = path.join(HELPER_DIR, 'auto-relaunch-monitor.ps1');
const STARTUP_DIR = path.join(
  process.env.APPDATA || os.homedir(),
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup'
);
const STARTUP_LAUNCHER = path.join(STARTUP_DIR, 'Smart Chat Hover Translate.vbs');
const RELAUNCH_REQUEST_FILE = path.join(os.tmpdir(), 'ag-envi-hover-relaunch-request');
const LAST_RELAUNCH_ATTEMPT_FILE = path.join(os.tmpdir(), 'ag-envi-hover-last-relaunch-attempt-0.31.10');
const RELAUNCH_RETRY_COOLDOWN_MS = 5 * 60 * 1000;

function isInstalled() {
  return fs.existsSync(HELPER_MONITOR) && fs.existsSync(STARTUP_LAUNCHER);
}

function canAutoRelaunch() {
  try {
    const lastAttempt = Number(fs.readFileSync(LAST_RELAUNCH_ATTEMPT_FILE, 'utf8'));
    return !Number.isFinite(lastAttempt) || Date.now() - lastAttempt > RELAUNCH_RETRY_COOLDOWN_MS;
  } catch {
    return true;
  }
}

function removeOldRelaunchAttemptFiles() {
  try {
    for (const name of fs.readdirSync(os.tmpdir())) {
      if (name.startsWith('ag-envi-hover-last-relaunch-attempt-') && name !== path.basename(LAST_RELAUNCH_ATTEMPT_FILE)) {
        fs.rmSync(path.join(os.tmpdir(), name), { force: true });
      }
    }
  } catch {
    // Cleanup is best effort.
  }
}

async function install(extensionPath) {
  const bundledMonitor = path.join(extensionPath, 'auto-relaunch-monitor.ps1');
  if (!fs.existsSync(bundledMonitor)) {
    throw new Error('The packaged Windows automatic helper is missing.');
  }

  fs.mkdirSync(HELPER_DIR, { recursive: true });
  fs.mkdirSync(STARTUP_DIR, { recursive: true });
  removeOldRelaunchAttemptFiles();
  await stopHelperProcess();
  fs.copyFileSync(bundledMonitor, HELPER_MONITOR);

  const powerShellCommand = [
    'powershell.exe',
    '-NoProfile',
    '-ExecutionPolicy Bypass',
    '-WindowStyle Hidden',
    `-File "${HELPER_MONITOR.replace(/"/g, '""')}"`
  ].join(' ');
  const launcher = [
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run "${powerShellCommand.replace(/"/g, '""')}", 0, False`,
    ''
  ].join('\r\n');
  fs.writeFileSync(STARTUP_LAUNCHER, launcher, 'utf8');

  await spawnDetached('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-WindowStyle', 'Hidden',
    '-File', HELPER_MONITOR
  ]);
}

async function uninstall() {
  await execFileAllowFailure('schtasks.exe', ['/Delete', '/TN', LEGACY_WINDOWS_TASK_NAME, '/F']);
  await stopHelperProcess();
  fs.rmSync(STARTUP_LAUNCHER, { force: true });
  fs.rmSync(HELPER_DIR, { recursive: true, force: true });
}

function requestRelaunch(options = {}) {
  const executablePath = options.executablePath || process.execPath;
  fs.writeFileSync(LAST_RELAUNCH_ATTEMPT_FILE, String(Date.now()), 'utf8');
  fs.rmSync(RELAUNCH_REQUEST_FILE, { force: true });
  startFallbackRelauncher(executablePath);
}

function stopHelperProcess() {
  const script = HELPER_MONITOR.replace(/'/g, "''");
  const command = [
    `$script = '${script}'`,
    "Get-CimInstance Win32_Process |",
    "Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains($script) } |",
    "ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
  ].join(' ');

  return execFileAllowFailure('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-Command', command
  ]);
}

function execFileAllowFailure(command, args) {
  return new Promise(resolve => {
    cp.execFile(command, args, () => resolve());
  });
}

function spawnDetached(command, args) {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: sanitizedWindowsEnvironment()
    });
    child.once('error', reject);
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
  });
}

function startFallbackRelauncher(executablePath) {
  const timestamp = Date.now();
  const fallbackPowerShell = path.join(os.tmpdir(), `ag-envi-hover-relaunch-${timestamp}.ps1`);
  const fallbackLauncher = path.join(os.tmpdir(), `ag-envi-hover-relaunch-${timestamp}.vbs`);
  const fallbackLog = path.join(os.tmpdir(), 'ag-envi-hover-fallback-relaunch.log');
  const safeExecutablePath = escapePowerShellString(String(executablePath || ''));
  const safeLogPath = escapePowerShellString(fallbackLog);
  const safeAttemptFile = escapePowerShellString(LAST_RELAUNCH_ATTEMPT_FILE);
  const safeImageName = escapePowerShellString(path.win32.basename(String(executablePath || 'Antigravity IDE.exe')));
  const safePowerShellPath = escapeVbsString(fallbackPowerShell);
  fs.appendFileSync(
    fallbackLog,
    `[${new Date().toISOString()}] Node started PowerShell relaunch via VBS; suppliedExe=${executablePath || '(empty)'}\r\n`,
    'utf8'
  );

  const powerShellScript = [
    '$ErrorActionPreference = "Continue"',
    `$exePath = '${safeExecutablePath}'`,
    `$logPath = '${safeLogPath}'`,
    `$attemptFile = '${safeAttemptFile}'`,
    `$imageName = '${safeImageName}'`,
    'Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] PowerShell relaunch started; exe=$exePath"',
    'Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] inherited ELECTRON_RUN_AS_NODE=$env:ELECTRON_RUN_AS_NODE"',
    'Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue',
    'Remove-Item Env:ELECTRON_NO_ASAR -ErrorAction SilentlyContinue',
    'Remove-Item Env:VSCODE_CLI -ErrorAction SilentlyContinue',
    'Remove-Item Env:VSCODE_IPC_HOOK_CLI -ErrorAction SilentlyContinue',
    'Start-Sleep -Seconds 2',
    'try {',
    '  $killOutput = & taskkill.exe /F /T /IM $imageName 2>&1',
    '  Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] taskkill exit=$LASTEXITCODE output=$killOutput"',
    '} catch {',
    '  Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] taskkill failed: $($_.Exception.Message)"',
    '}',
    'Start-Sleep -Seconds 3',
    'try {',
    '  Start-Process -FilePath $exePath -ArgumentList "--remote-debugging-address=127.0.0.1","--remote-debugging-port=9333"',
    '  Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] PowerShell Start-Process completed"',
    '} catch {',
    '  Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] PowerShell Start-Process failed: $($_.Exception.Message)"',
    '}',
    'Start-Sleep -Seconds 10',
    'try {',
    '  $response = Invoke-WebRequest "http://127.0.0.1:9333/json/version" -UseBasicParsing -TimeoutSec 2',
    '  Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] Port verification status=$($response.StatusCode)"',
    '  if ($response.StatusCode -eq 200) { Remove-Item $attemptFile -Force -ErrorAction SilentlyContinue }',
    '} catch {',
    '  Add-Content -Path $logPath -Value "[$(Get-Date -Format s)] Port verification failed: $($_.Exception.Message)"',
    '}',
    'Remove-Item $PSCommandPath -Force',
    ''
  ].join('\r\n');
  fs.writeFileSync(fallbackPowerShell, powerShellScript, 'utf8');

  const powerShellCommand = escapeVbsString(
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${fallbackPowerShell}"`
  );
  const launcherScript = [
    'On Error Resume Next',
    'Set shell = CreateObject("WScript.Shell")',
    `shell.Run "${powerShellCommand}", 0, False`,
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'fso.DeleteFile WScript.ScriptFullName, True',
    ''
  ].join('\r\n');
  fs.writeFileSync(fallbackLauncher, launcherScript, 'utf8');

  const wscriptPath = path.join(
    process.env.SystemRoot || 'C:\\Windows',
    'System32',
    'wscript.exe'
  );
  const child = cp.spawn(wscriptPath, [fallbackLauncher], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: sanitizedWindowsEnvironment()
  });
  child.once('error', err => {
    fs.appendFileSync(
      fallbackLog,
      `[${new Date().toISOString()}] Failed to spawn fallback WScript: ${err.message}\r\n`,
      'utf8'
    );
  });
  child.unref();
}

function escapeVbsString(value) {
  return value.replace(/"/g, '""');
}

function escapePowerShellString(value) {
  return value.replace(/'/g, "''");
}

function sanitizedWindowsEnvironment() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.ELECTRON_NO_ASAR;
  delete env.VSCODE_CLI;
  delete env.VSCODE_IPC_HOOK_CLI;
  return env;
}

module.exports = {
  canAutoRelaunch,
  install,
  uninstall,
  isInstalled,
  requestRelaunch
};
