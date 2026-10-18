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

  onPrepare: () => {
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
  },

  beforeSession: async () => {
    const tauriDriverArguments = [];
    if (process.platform === 'win32') {
      const edgeDriverPath = await resolveEdgeDriverPath();
      tauriDriverArguments.push('--native-driver', edgeDriverPath);
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
};

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
