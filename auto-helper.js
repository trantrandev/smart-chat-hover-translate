const macHelper = require('./auto-helper-mac');
const windowsHelper = require('./auto-helper-windows');

function getPlatformHelper() {
  if (process.platform === 'darwin') return macHelper;
  if (process.platform === 'win32') return windowsHelper;
  return null;
}

function isSupported() {
  return Boolean(getPlatformHelper());
}

function isInstalled() {
  const helper = getPlatformHelper();
  return helper ? helper.isInstalled() : false;
}

function canAutoRelaunch() {
  const helper = getPlatformHelper();
  return helper && helper.canAutoRelaunch ? helper.canAutoRelaunch() : Boolean(helper);
}

async function ensure(extensionPath) {
  const helper = getPlatformHelper();
  if (!helper || helper.isInstalled()) return;
  await helper.install(extensionPath);
}

async function install(extensionPath) {
  const helper = getPlatformHelper();
  if (!helper) return;
  await helper.install(extensionPath);
}

async function uninstall() {
  const helper = getPlatformHelper();
  if (!helper) return;
  await helper.uninstall();
}

function requestRelaunch(options) {
  const helper = getPlatformHelper();
  if (!helper) return;
  helper.requestRelaunch(options);
}

module.exports = {
  canAutoRelaunch,
  ensure,
  install,
  uninstall,
  isInstalled,
  isSupported,
  requestRelaunch
};
