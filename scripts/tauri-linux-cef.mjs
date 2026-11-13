#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const ANYLINUX_COMMIT = '3e280d1b2270fecfcb2c2c823b490c782ecf1277';
const APPIMAGETOOL_VERSION = '0.5.6';
const VENDOR_URL_PREFIX = `/vendor/anylinux-appimages-pin/${ANYLINUX_COMMIT}/`;
const BUNDLER_SCRIPT_URL
  = 'https://raw.githubusercontent.com/FabianLars/Anylinux-AppImages/refs/heads/main/useful-tools/quick-sharun.sh';
const BUNDLER_HOOKS_URL
  = 'https://raw.githubusercontent.com/FabianLars/Anylinux-AppImages/refs/heads/main/useful-tools/hooks';
const FIRST_VENDOR_PORT = 8731;
const LAST_VENDOR_PORT = 8799;

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tauriDir = path.join(repositoryRoot, 'src-tauri');
const vendorRoot = path.join(tauriDir, 'appimage', 'anylinux');
const cargoConfig = path.join(tauriDir, '.cargo', 'cef.toml');
const tauriConfig = path.join(tauriDir, 'tauri.cef.conf.json');
const baseTauriConfig = path.join(tauriDir, 'tauri.conf.json');
const lockPath = path.join(tauriDir, 'Cargo.lock');
const cefLockPath = path.join(tauriDir, 'Cargo.cef.lock');
const savedLockPath = path.join(tauriDir, 'Cargo.lock.wry');

if (process.platform !== 'linux') {
  console.error('The CEF runtime build is only used on Linux. Use `npm run tauri` on this platform.');
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);

if (!['dev', 'build'].includes(command)) {
  console.error(
    'Usage: npm run tauri:linux-cef -- <dev|build> [tauri args] [-- cargo args]\n'
    + '`bundle` is refused: it would package target/ without the CEF feature or lockfile.',
  );
  process.exit(1);
}

const separatorIndex = rest.indexOf('--');
const tauriArgs = separatorIndex === -1 ? rest : rest.slice(0, separatorIndex);
const cargoArgs = separatorIndex === -1 ? [] : rest.slice(separatorIndex + 1);
const versionMismatchArgs = command === 'build'
  ? ['--ignore-version-mismatches']
  : [];

const generatedConfigPath = path.join(os.tmpdir(), `sfm-tauri-cef-${process.pid}.json`);

function writeCefConfig() {
  const base = JSON.parse(fs.readFileSync(baseTauriConfig, 'utf8'));
  const overlay = JSON.parse(fs.readFileSync(tauriConfig, 'utf8'));
  const windows = base.app?.windows;
  if (!Array.isArray(windows) || windows.length === 0) {
    throw new Error('tauri.conf.json has no app.windows to copy into the CEF config');
  }

  const cefWindows = structuredClone(windows);
  const mainWindow = cefWindows.find(window => window.label === 'main');
  if (!mainWindow) {
    throw new Error('tauri.conf.json has no main window');
  }
  mainWindow.transparent = false;
  overlay.app = { ...overlay.app, windows: cefWindows };
  fs.writeFileSync(generatedConfigPath, `${JSON.stringify(overlay, null, 2)}\n`);
}

function vendorUrl(port, relativePath) {
  return `http://127.0.0.1:${port}${VENDOR_URL_PREFIX}${relativePath}`;
}

function appimageArch() {
  if (process.arch === 'x64') {
    return 'x86_64';
  }
  if (process.arch === 'arm64') {
    return 'aarch64';
  }
  throw new Error(`Unsupported architecture for the CEF AppImage bundler: ${process.arch}`);
}

function cliNativePackageName() {
  if (process.arch === 'x64') {
    return '@tauri-apps/cli-cef-linux-x64-gnu';
  }
  if (process.arch === 'arm64') {
    return '@tauri-apps/cli-cef-linux-arm64-gnu';
  }
  throw new Error(`Unsupported architecture for the CEF CLI: ${process.arch}`);
}

function cliNativeBinaryPath() {
  const packageName = cliNativePackageName();
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageDir = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  if (typeof packageJson.main !== 'string' || packageJson.main.length === 0) {
    throw new Error(`${packageName} has no main entry`);
  }
  return path.join(packageDir, packageJson.main);
}

function replaceUnique(buffer, from, to) {
  if (Buffer.byteLength(from) !== Buffer.byteLength(to)) {
    throw new Error(`Bundler URL replacement lengths differ for ${from}`);
  }
  const source = Buffer.from(from);
  const target = Buffer.from(to);
  const index = buffer.indexOf(source);
  if (index < 0) {
    throw new Error(`The CEF CLI no longer contains ${from}. Refusing to let it download that file.`);
  }
  if (buffer.indexOf(source, index + source.length) >= 0) {
    throw new Error(`The CEF CLI contains more than one copy of ${from}.`);
  }
  target.copy(buffer, index);
}

function retargetCliBinary(binaryPath, port) {
  const backupPath = `${binaryPath}.unpatched`;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, binaryPath);
  }
  else {
    fs.copyFileSync(binaryPath, backupPath);
  }

  const patched = fs.readFileSync(binaryPath);
  replaceUnique(patched, BUNDLER_SCRIPT_URL, vendorUrl(port, 'quick-sharun.sh'));
  replaceUnique(patched, BUNDLER_HOOKS_URL, vendorUrl(port, 'hooks'));
  fs.writeFileSync(binaryPath, patched);
  return backupPath;
}

function restoreCliBinary(binaryPath, backupPath) {
  if (backupPath && fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, binaryPath);
    fs.rmSync(backupPath);
  }
}

function startVendorServer(port) {
  const root = path.resolve(vendorRoot);
  const server = http.createServer((request, response) => {
    let pathname = '/';
    try {
      pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname;
    }
    catch {
      response.writeHead(400).end();
      return;
    }

    if (!pathname.startsWith(VENDOR_URL_PREFIX)) {
      response.writeHead(404).end();
      return;
    }

    const relative = decodeURIComponent(pathname.slice(VENDOR_URL_PREFIX.length));
    const parts = relative.split('/');
    if (parts.some(part => part === '' || part === '.' || part === '..')) {
      response.writeHead(400).end();
      return;
    }

    const filePath = path.resolve(root, ...parts);
    if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
      response.writeHead(400).end();
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200).end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function listenVendorServer() {
  for (let port = FIRST_VENDOR_PORT; port <= LAST_VENDOR_PORT; port += 1) {
    try {
      const server = await startVendorServer(port);
      return { server, port };
    }
    catch (error) {
      if (error.code !== 'EADDRINUSE') {
        throw error;
      }
    }
  }
  throw new Error(`No free port in ${FIRST_VENDOR_PORT}-${LAST_VENDOR_PORT} for the vendored bundler files.`);
}

writeCefConfig();

try {
  fs.writeFileSync(savedLockPath, fs.readFileSync(lockPath), { flag: 'wx' });
}
catch (error) {
  fs.rmSync(generatedConfigPath, { force: true });
  if (error.code !== 'EEXIST') {
    throw error;
  }

  console.error(
    `${savedLockPath} exists: another CEF build is running, or an earlier one was killed before it `
    + 'restored Cargo.lock. Wait for it, or run `mv Cargo.lock.wry Cargo.lock` in src-tauri.',
  );
  process.exit(1);
}

if (fs.existsSync(cefLockPath)) {
  fs.copyFileSync(cefLockPath, lockPath);
}

let isLockSwapped = true;
let commandSucceeded = false;

function restoreLock() {
  if (!isLockSwapped) {
    return;
  }

  if (commandSucceeded) {
    const updatedLockPath = `${cefLockPath}.updated`;
    fs.copyFileSync(lockPath, updatedLockPath);
    fs.renameSync(updatedLockPath, cefLockPath);
  }
  fs.renameSync(savedLockPath, lockPath);
  isLockSwapped = false;
}

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {});
}

const args = [
  command,
  '--features',
  'cef',
  '--config',
  generatedConfigPath,
  ...versionMismatchArgs,
  ...tauriArgs,
  '--',
  '--locked',
  '--no-default-features',
  '--config',
  cargoConfig,
  ...cargoArgs,
];

let server;
let port;
let binaryPath;
let backupPath;

try {
  ({ server, port } = await listenVendorServer());
  binaryPath = cliNativeBinaryPath();
  backupPath = retargetCliBinary(binaryPath, port);
}
catch (error) {
  restoreLock();
  fs.rmSync(generatedConfigPath, { force: true });
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const arch = appimageArch();
const childEnv = {
  ...process.env,
  ANYLINUX_LIB_SOURCE: vendorUrl(port, 'lib/anylinux.c'),
  GTK_CLASS_FIX_SOURCE: vendorUrl(port, 'lib/gtk-class-fix.c'),
  APPIMAGETOOL_LINK: `https://github.com/pkgforge-dev/appimagetool/releases/download/${APPIMAGETOOL_VERSION}/appimagetool-${arch}-linux`,
};

const cliScript = require.resolve('@tauri-apps/cli-cef/tauri.js');
const child = spawn(process.execPath, [cliScript, ...args], {
  stdio: 'inherit',
  cwd: repositoryRoot,
  env: childEnv,
});

let finished = false;

function finish(code) {
  if (finished) {
    return;
  }
  finished = true;
  restoreLock();
  restoreCliBinary(binaryPath, backupPath);
  fs.rmSync(generatedConfigPath, { force: true });
  server.close();
  process.exit(code);
}

child.on('exit', (code, signal) => {
  commandSucceeded = code === 0 && !signal;
  finish(code ?? 1);
});

child.on('error', (error) => {
  console.error(error);
  finish(1);
});
