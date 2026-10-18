import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveEdgeDriverPath } from './scripts/resolve-edge-driver.mjs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const repoRoot = path.resolve(__dirname, '..');
const tauriBinaryName = process.platform === 'win32' ? 'sigma-file-manager.exe' : 'sigma-file-manager';
const applicationPath = path.join(repoRoot, 'src-tauri', 'target', 'debug', tauriBinaryName);
const tauriDriverName = process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver';
const tauriDriverPath = path.join(os.homedir(), '.cargo', 'bin', tauriDriverName);
const failureArtifactsDirectory = path.resolve(
  process.env.SFM_E2E_ARTIFACTS_DIR || path.join(__dirname, 'artifacts'),
);

// Isolated app data
// -----------------
// Every run gets a fresh temporary folder (os.tmpdir()/sfm-e2e-<timestamp>-<random>)
// and the app under test receives it as SFM_E2E_DATA_DIR. Debug builds then keep
// all app data there (settings, workspaces, stats, extensions, thumbnails,
// global search index, window state, logs and the WebView2 profile), so local
// runs never read or write the data of an installed SFM. The suite refuses to
// launch the app unless the override is confirmed, and the folder is deleted
// when the run ends; set SFM_E2E_KEEP_DATA=1 to keep it for debugging.
// Tests may still browse the real file system read-only (e.g. the home folder).
const E2E_DATA_DIR_ENV = 'SFM_E2E_DATA_DIR';
const E2E_DATA_DIR_OWNER_ENV = 'SFM_E2E_DATA_DIR_OWNER_PID';
const E2E_DATA_DIR_PREFIX = 'sfm-e2e-';
const E2E_PRINT_DATA_DIRS_FLAG = '--sfm-e2e-print-data-dirs';
const E2E_MARKER_FILE_NAME = 'sfm-e2e-isolated-data-dir.json';
const E2E_ABORT_FILE_NAME = 'sfm-e2e-abort.txt';
const E2E_WEBVIEW_SUBDIR = 'webview';

const e2eDataDirectory = resolveRunDataDirectory();

let tauriDriverProcess;
let exitCleanly = false;

export const config = {
  hostname: '127.0.0.1',
  port: 4444,
  specs: ['./test/specs/**/*.js'],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: applicationPath,
      },
    },
  ],
  logLevel: 'warn',
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },

  // WebdriverIO logs errors thrown from hooks and carries on, so the isolation
  // guards exit the process instead of throwing.
  onPrepare: () => {
    buildApplicationIfNeeded();
    try {
      assertApplicationUsesIsolatedDataDirectory();
    }
    catch (guardError) {
      console.error(guardError.message);
      if (isRunDataDirectorySafe()) {
        fs.rmSync(e2eDataDirectory, { recursive: true, force: true });
      }
      process.exit(1);
    }
  },

  beforeSession: async (_config, capabilities) => {
    try {
      assertRunDataDirectoryIsSafe();
      const abortFilePath = path.join(e2eDataDirectory, E2E_ABORT_FILE_NAME);
      if (fs.existsSync(abortFilePath)) {
        throw new Error(`Not launching SFM: ${fs.readFileSync(abortFilePath, 'utf8')}`);
      }
    }
    catch (guardError) {
      console.error(guardError.message);
      process.exit(1);
    }
    fs.rmSync(path.join(e2eDataDirectory, E2E_MARKER_FILE_NAME), { force: true });

    const tauriOptions = capabilities['tauri:options'] ?? {};
    capabilities['tauri:options'] = {
      ...tauriOptions,
      webviewOptions: {
        ...tauriOptions.webviewOptions,
        userDataFolder: path.join(e2eDataDirectory, E2E_WEBVIEW_SUBDIR),
      },
    };

    const tauriDriverArguments = [];
    if (process.platform === 'win32') {
      const edgeDriverPath = await resolveEdgeDriverPath();
      tauriDriverArguments.push('--native-driver', edgeDriverPath);
    }
    tauriDriverProcess = spawn(
      tauriDriverPath,
      tauriDriverArguments,
      {
        stdio: [null, process.stdout, process.stderr],
        env: { ...process.env, [E2E_DATA_DIR_ENV]: e2eDataDirectory },
      },
    );

    tauriDriverProcess.on('error', (spawnError) => {
      console.error('tauri-driver error:', spawnError);
      process.exit(1);
    });
    tauriDriverProcess.on('exit', (exitCode) => {
      if (!exitCleanly) {
        console.error('tauri-driver exited with code:', exitCode);
        process.exit(1);
      }
    });
  },

  before: async () => {
    try {
      await assertRunningAppUsesIsolatedDataDirectory();
    }
    catch (guardError) {
      console.error(guardError.message);
      fs.writeFileSync(path.join(e2eDataDirectory, E2E_ABORT_FILE_NAME), String(guardError.message));
      await browser.deleteSession().catch(() => {});
      closeTauriDriver();
      process.exit(1);
    }
  },

  afterTest: async (test, _context, { passed }) => {
    if (passed) {
      return;
    }
    await saveFailureArtifacts(test);
  },

  afterHook: async (test, _context, { passed }) => {
    if (passed !== false) {
      return;
    }
    await saveFailureArtifacts(test);
  },

  afterSession: () => {
    closeTauriDriver();
  },

  onComplete: async (exitCode) => {
    if (exitCode !== 0) {
      copyAppLogsToFailureArtifacts();
    }

    if (process.env.SFM_E2E_KEEP_DATA === '1') {
      console.log(`Keeping isolated e2e data folder: ${e2eDataDirectory}`);
      return;
    }

    await removeRunDataDirectory();
  },
};

function buildApplicationIfNeeded() {
  if (process.env.SFM_SKIP_TAURI_BUILD_FOR_WEBDRIVER === '1') {
    const distIndexPath = path.join(repoRoot, 'dist', 'index.html');
    if (!fs.existsSync(applicationPath)) {
      throw new Error(
        'Missing debug SFM binary for WebDriver e2e. Run: npm run tauri -- build --debug --no-bundle',
      );
    }
    if (!fs.existsSync(distIndexPath)) {
      throw new Error(
        'Missing frontend dist for WebDriver e2e. Run: npm run tauri -- build --debug --no-bundle',
      );
    }
    return;
  }
  const buildResult = spawnSync(
    'npm',
    ['run', 'tauri', '--', 'build', '--debug', '--no-bundle'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
    },
  );
  if (buildResult.error) {
    throw buildResult.error;
  }
  if (buildResult.status !== 0) {
    process.exit(buildResult.status ?? 1);
  }
}

// The launcher creates the folder once; spec workers are forked from it and
// inherit both variables, so every app launch in a run shares the folder.
function resolveRunDataDirectory() {
  if (process.env.WDIO_WORKER_ID) {
    const inheritedDirectory = process.env[E2E_DATA_DIR_ENV];
    if (!inheritedDirectory || !process.env[E2E_DATA_DIR_OWNER_ENV]) {
      throw new Error(`Spec worker did not inherit ${E2E_DATA_DIR_ENV} from the WebdriverIO launcher`);
    }
    return inheritedDirectory;
  }

  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const directory = path.join(os.tmpdir(), `${E2E_DATA_DIR_PREFIX}${timestamp}-${randomSuffix}`);
  fs.mkdirSync(directory);

  process.env[E2E_DATA_DIR_ENV] = directory;
  process.env[E2E_DATA_DIR_OWNER_ENV] = String(process.pid);
  return directory;
}

function isPathInside(childPath, parentPath) {
  if (typeof childPath !== 'string' || !path.isAbsolute(childPath)) {
    return false;
  }
  const relativePath = path.relative(path.resolve(parentPath), path.resolve(childPath));
  return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

function isSamePath(firstPath, secondPath) {
  return typeof firstPath === 'string' && path.relative(path.resolve(firstPath), path.resolve(secondPath)) === '';
}

function isRunDataDirectorySafe() {
  return path.isAbsolute(e2eDataDirectory)
    && path.basename(e2eDataDirectory).startsWith(E2E_DATA_DIR_PREFIX)
    && isSamePath(path.dirname(e2eDataDirectory), os.tmpdir())
    && fs.existsSync(e2eDataDirectory);
}

function assertRunDataDirectoryIsSafe() {
  if (!isRunDataDirectorySafe()) {
    throw new Error(`Unexpected isolated e2e data folder: ${e2eDataDirectory}`);
  }
}

function fileContainsText(filePath, text) {
  const needle = Buffer.from(text);
  const chunkSize = 8 * 1024 * 1024;
  const buffer = Buffer.alloc(chunkSize + needle.length);
  const fileDescriptor = fs.openSync(filePath, 'r');
  try {
    let carriedBytes = 0;
    for (;;) {
      const bytesRead = fs.readSync(fileDescriptor, buffer, carriedBytes, chunkSize, null);
      if (bytesRead === 0) {
        return false;
      }
      const filledBytes = carriedBytes + bytesRead;
      if (buffer.subarray(0, filledBytes).includes(needle)) {
        return true;
      }
      carriedBytes = Math.min(needle.length - 1, filledBytes);
      buffer.copy(buffer, 0, filledBytes - carriedBytes, filledBytes);
    }
  }
  finally {
    fs.closeSync(fileDescriptor);
  }
}

// Runs in the launcher before any session. A binary built without the
// override would start with the real app data, so it is checked statically
// first and only then asked to report its data folders (the probe flag exits
// before the app initializes anything).
function assertApplicationUsesIsolatedDataDirectory() {
  assertRunDataDirectoryIsSafe();

  if (!fileContainsText(applicationPath, E2E_PRINT_DATA_DIRS_FLAG)) {
    throw new Error(
      `${applicationPath} does not support ${E2E_DATA_DIR_ENV}; rebuild it as a debug build. `
      + 'Not launching it, because it would use the real app data.',
    );
  }

  const probeResult = spawnSync(applicationPath, [E2E_PRINT_DATA_DIRS_FLAG], {
    env: { ...process.env, [E2E_DATA_DIR_ENV]: e2eDataDirectory },
    encoding: 'utf8',
    timeout: 60000,
  });
  const probeOutput = (probeResult.stdout ?? '').trim().split(/\r?\n/).pop() ?? '';
  let probe = null;
  try {
    probe = JSON.parse(probeOutput);
  }
  catch {
    probe = null;
  }

  if (probeResult.status !== 0 || !isSamePath(probe?.isolatedRoot, e2eDataDirectory)) {
    throw new Error(
      `SFM did not confirm the isolated e2e data folder (exit ${probeResult.status}, `
      + `output ${JSON.stringify(probeOutput)}, stderr ${JSON.stringify((probeResult.stderr ?? '').trim())}). `
      + 'Aborting before any test launches the app.',
    );
  }

  console.log(`Isolated e2e data folder: ${e2eDataDirectory}`);
}

// Runs in each spec worker right after the app starts: the running process
// must report every app folder inside the run folder, and the marker it writes
// at startup proves SFM_E2E_DATA_DIR reached it through tauri-driver.
async function assertRunningAppUsesIsolatedDataDirectory() {
  let appDirs = null;
  await browser.waitUntil(async () => {
    appDirs = await browser.execute(async () => {
      try {
        return await window.__TAURI_INTERNALS__.invoke('get_app_dirs');
      }
      catch {
        return null;
      }
    }).catch(() => null);
    return appDirs !== null;
  }, {
    timeout: 30000,
    interval: 250,
    timeoutMsg: 'The app did not report its data folders',
  });
  const appDirNames = ['appDataDir', 'appConfigDir', 'appLocalDataDir', 'appCacheDir', 'appLogDir'];
  const leakedDirNames = appDirNames.filter(name => !isPathInside(appDirs?.[name], e2eDataDirectory));

  if (!isSamePath(appDirs?.isolatedRoot, e2eDataDirectory) || leakedDirNames.length > 0) {
    throw new Error(
      `The app is not using the isolated e2e data folder ${e2eDataDirectory}: ${JSON.stringify(appDirs)}`,
    );
  }

  const markerPath = path.join(e2eDataDirectory, E2E_MARKER_FILE_NAME);
  const marker = fs.existsSync(markerPath) ? JSON.parse(fs.readFileSync(markerPath, 'utf8')) : null;
  if (!isSamePath(marker?.isolatedRoot, e2eDataDirectory) || !isPathInside(marker?.webviewDataDir, e2eDataDirectory)) {
    throw new Error(`Missing or unexpected isolation marker from the app: ${JSON.stringify(marker)}`);
  }
}

function copyAppLogsToFailureArtifacts() {
  const logsDirectory = path.join(e2eDataDirectory, 'logs');
  if (!fs.existsSync(logsDirectory)) {
    return;
  }
  try {
    fs.cpSync(logsDirectory, path.join(failureArtifactsDirectory, 'app-logs'), { recursive: true });
  }
  catch (copyError) {
    console.error('Failed to copy app logs to the e2e artifacts:', copyError);
  }
}

// The app and its WebView2 processes can take a few seconds to release their
// files after the last session ends, so removal is retried for a while.
async function removeRunDataDirectory() {
  if (!isRunDataDirectorySafe()) {
    console.warn(`Not removing unexpected isolated e2e data folder: ${e2eDataDirectory}`);
    return;
  }

  const maxAttempts = 30;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      fs.rmSync(e2eDataDirectory, { recursive: true, force: true });
      return;
    }
    catch (removeError) {
      if (attempt === maxAttempts) {
        const remainingEntries = fs.existsSync(e2eDataDirectory) ? fs.readdirSync(e2eDataDirectory) : [];
        console.warn(
          `Failed to remove isolated e2e data folder ${e2eDataDirectory} `
          + `(remaining: ${remainingEntries.join(', ') || 'none'}):`,
          removeError,
        );
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function saveFailureArtifacts(test) {
  const baseName = `${test.parent ?? ''} ${test.title ?? 'hook'}`
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);

  try {
    fs.mkdirSync(failureArtifactsDirectory, { recursive: true });
    await browser.saveScreenshot(path.join(failureArtifactsDirectory, `${baseName}.png`));
    const pageSource = await browser.getPageSource();
    fs.writeFileSync(path.join(failureArtifactsDirectory, `${baseName}.html`), pageSource);
  }
  catch (artifactError) {
    console.error('Failed to save e2e failure artifacts:', artifactError);
  }
}

function closeTauriDriver() {
  exitCleanly = true;
  tauriDriverProcess?.kill();
}

function onShutdown(handler) {
  const cleanup = () => {
    try {
      handler();
    }
    finally {
      process.exit();
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);
  process.on('SIGBREAK', cleanup);
}

onShutdown(() => {
  closeTauriDriver();
});
