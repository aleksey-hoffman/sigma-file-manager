#!/usr/bin/env node
// Runs `tauri dev|build|bundle` for Linux on the bundled Chromium (CEF) runtime instead of WebKitGTK.
//
//   npm run tauri:linux-cef -- build
//   npm run tauri:linux-cef -- build --bundles appimage
//   npm run tauri:linux-cef -- dev
//
// What it adds on top of the normal tauri command line:
//   - the tauri CLI from the Tauri `feat/cef` line (@tauri-apps/cli-cef), which bundles Chromium
//     with the app. Set TAURI_CEF_CLI to the path of an unpacked copy of its `tauri.js` to skip npx;
//   - `--config src-tauri/tauri.cef.conf.json`, which turns the main window's transparency off: Chromium's
//     child window cannot be embedded into the 32-bit ARGB window X11 gives a transparent window, so
//     the page would never be shown;
//   - `--features cef` and, on the cargo side, `--no-default-features` (drops the `wry` feature)
//     and `--config src-tauri/.cargo/cef.toml` (takes tauri and the plugins from the `feat/cef` branches).
//
// Cargo resolves that graph differently from the normal one and keeps one Cargo.lock, so for the
// duration of the command src-tauri/Cargo.cef.lock is swapped in as Cargo.lock and the original is
// put back afterwards. If a run is killed hard, restore with `mv Cargo.lock.wry Cargo.lock`.
//
// AppImage bundling (`bundle --bundles appimage`) runs quick-sharun, which traces the app under xvfb-run
// and needs a tty to stop it, so run it from a terminal (or under `script -qfec "<cmd>" /dev/null` in CI).
// If the default pkgforge-dev download URLs 404, point ANYLINUX_LIB_SOURCE and GTK_CLASS_FIX_SOURCE at the
// FabianLars/Anylinux-AppImages `useful-tools/lib/` files.
//
// Windows and macOS builds do not use this script and keep the system webview runtime.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CEF_CLI_PACKAGE = '@tauri-apps/cli-cef@3.0.0-alpha.27';
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tauriDir = path.join(repositoryRoot, 'src-tauri');
const cargoConfig = path.join(tauriDir, '.cargo', 'cef.toml');
const tauriConfig = path.join(tauriDir, 'tauri.cef.conf.json');
const lockPath = path.join(tauriDir, 'Cargo.lock');
const cefLockPath = path.join(tauriDir, 'Cargo.cef.lock');
const savedLockPath = path.join(tauriDir, 'Cargo.lock.wry');

if (process.platform !== 'linux') {
  console.error('The CEF runtime build is only used on Linux. Use `npm run tauri` on this platform.');
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);

if (!['dev', 'build', 'bundle'].includes(command)) {
  console.error('Usage: npm run tauri:linux-cef -- <dev|build|bundle> [tauri args] [-- cargo args]');
  process.exit(1);
}

const separatorIndex = rest.indexOf('--');
const tauriArgs = separatorIndex === -1 ? rest : rest.slice(0, separatorIndex);
const cargoArgs = separatorIndex === -1 ? [] : rest.slice(separatorIndex + 1);
// `tauri bundle` only packages an existing build, so it takes no cargo arguments.
const cargoPart = command === 'bundle'
  ? []
  : ['--', '--no-default-features', '--config', cargoConfig, ...cargoArgs];
const args = [
  command,
  '--features',
  'cef',
  '--config',
  tauriConfig,
  ...tauriArgs,
  ...cargoPart,
];

try {
  fs.writeFileSync(savedLockPath, fs.readFileSync(lockPath), { flag: 'wx' });
}
catch (error) {
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

function restoreLock() {
  if (!isLockSwapped) {
    return;
  }

  fs.copyFileSync(lockPath, cefLockPath);
  fs.renameSync(savedLockPath, lockPath);
  isLockSwapped = false;
}

// Ctrl-C reaches the child through the process group. Stay alive until it exits so the lock is restored.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {});
}

const localCli = process.env.TAURI_CEF_CLI;
const [file, fileArgs] = localCli
  ? ['node', [localCli, ...args]]
  : ['npx', ['--yes', CEF_CLI_PACKAGE, ...args]];

const child = spawn(file, fileArgs, { stdio: 'inherit', cwd: repositoryRoot });

child.on('exit', (code, signal) => {
  restoreLock();
  process.exit(code ?? (signal ? 1 : 0));
});

child.on('error', (error) => {
  restoreLock();
  console.error(error);
  process.exit(1);
});
