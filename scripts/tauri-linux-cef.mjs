#!/usr/bin/env node
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CEF_CLI_PACKAGE = '@tauri-apps/cli-cef@3.0.0-alpha.27';
const DEFAULT_ANYLINUX_LIB_SOURCE
  = 'https://raw.githubusercontent.com/FabianLars/Anylinux-AppImages/refs/heads/main/useful-tools/lib/anylinux.c';
const DEFAULT_GTK_CLASS_FIX_SOURCE
  = 'https://raw.githubusercontent.com/FabianLars/Anylinux-AppImages/refs/heads/main/useful-tools/lib/gtk-class-fix.c';

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
const cargoPart = command === 'bundle'
  ? []
  : ['--', '--no-default-features', '--config', cargoConfig, ...cargoArgs];
const versionMismatchArgs = command === 'build'
  ? ['--ignore-version-mismatches']
  : [];
const args = [
  command,
  '--features',
  'cef',
  '--config',
  tauriConfig,
  ...versionMismatchArgs,
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

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {});
}

const localCli = process.env.TAURI_CEF_CLI;
const cargoCefCli = process.env.TAURI_CEF_CARGO === '1';
const [file, fileArgs] = cargoCefCli
  ? ['cargo', ['tauri', ...args]]
  : localCli
    ? ['node', [localCli, ...args]]
    : ['npx', ['--yes', CEF_CLI_PACKAGE, ...args]];

const childEnv = {
  ...process.env,
  ANYLINUX_LIB_SOURCE: process.env.ANYLINUX_LIB_SOURCE ?? DEFAULT_ANYLINUX_LIB_SOURCE,
  GTK_CLASS_FIX_SOURCE: process.env.GTK_CLASS_FIX_SOURCE ?? DEFAULT_GTK_CLASS_FIX_SOURCE,
};

const child = spawn(file, fileArgs, {
  stdio: 'inherit',
  cwd: repositoryRoot,
  env: childEnv,
});

child.on('exit', (code, signal) => {
  restoreLock();
  process.exit(code ?? (signal ? 1 : 0));
});

child.on('error', (error) => {
  restoreLock();
  console.error(error);
  process.exit(1);
});
