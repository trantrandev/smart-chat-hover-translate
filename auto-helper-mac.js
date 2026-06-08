const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const HELPER_LABEL = 'dev.trantrandev.ag-envi-hover.auto-relaunch';
const HELPER_DIR = path.join(process.env.HOME || '', 'Library', 'Application Support', 'Smart Chat Hover Translate');
const HELPER_MONITOR = path.join(HELPER_DIR, 'auto-relaunch-monitor.sh');
const HELPER_PLIST = path.join(process.env.HOME || '', 'Library', 'LaunchAgents', `${HELPER_LABEL}.plist`);
const RELAUNCH_REQUEST_FILE = '/tmp/ag-envi-hover-relaunch-request';

function isInstalled() {
  return fs.existsSync(HELPER_MONITOR) && fs.existsSync(HELPER_PLIST);
}

async function install(extensionPath) {
  const bundledMonitor = path.join(extensionPath, 'auto-relaunch-monitor.sh');
  if (!fs.existsSync(bundledMonitor)) {
    throw new Error('The packaged macOS automatic helper is missing.');
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

async function uninstall() {
  const service = `gui/${process.getuid()}/${HELPER_LABEL}`;
  await execFileAllowFailure('launchctl', ['bootout', service]);
  fs.rmSync(HELPER_PLIST, { force: true });
  fs.rmSync(HELPER_DIR, { recursive: true, force: true });
}

function requestRelaunch() {
  fs.writeFileSync(RELAUNCH_REQUEST_FILE, String(Date.now()), 'utf8');
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

module.exports = {
  install,
  uninstall,
  isInstalled,
  requestRelaunch
};
