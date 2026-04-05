import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { download as downloadEdgeDriver } from 'edgedriver';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const vendoredEdgeDriverPath = path.join(__dirname, '.drivers', 'msedgedriver.exe');

const repoRoot = path.resolve(__dirname, '..');
const tauriBinaryName = process.platform === 'win32' ? 'sigma-file-manager.exe' : 'sigma-file-manager';
const applicationPath = path.join(repoRoot, 'src-tauri', 'target', 'debug', tauriBinaryName);
const tauriDriverName = process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver';
const tauriDriverPath = path.join(os.homedir(), '.cargo', 'bin', tauriDriverName);

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
  reporters: ['spec'],
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 120000,
  },

  onPrepare: () => {
    if (process.env.SFM_SKIP_TAURI_BUILD_FOR_WEBDRIVER === '1') {
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
  },

  beforeSession: async () => {
    const tauriDriverArguments = [];
    if (process.platform === 'win32') {
      const explicitEdgeDriverPath = process.env.SFM_MS_EDGE_DRIVER_PATH;
      if (explicitEdgeDriverPath) {
        tauriDriverArguments.push('--native-driver', explicitEdgeDriverPath);
      }
      else if (fs.existsSync(vendoredEdgeDriverPath)) {
        tauriDriverArguments.push('--native-driver', vendoredEdgeDriverPath);
      }
      else {
        try {
          const driversDirectory = path.join(__dirname, '.drivers');
          const downloadedEdgeDriverPath = await downloadEdgeDriver(undefined, driversDirectory);
          tauriDriverArguments.push('--native-driver', downloadedEdgeDriverPath);
        }
        catch (downloadError) {
          throw new Error(
            'Microsoft Edge WebDriver (msedgedriver.exe) is required. Add it to PATH, set SFM_MS_EDGE_DRIVER_PATH, '
            + 'or run: npm run install-edge-driver --prefix e2e-webdriver',
            { cause: downloadError },
          );
        }
      }
    }
    tauriDriverProcess = spawn(
      tauriDriverPath,
      tauriDriverArguments,
      { stdio: [null, process.stdout, process.stderr] },
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

  afterSession: () => {
    closeTauriDriver();
  },
};

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
