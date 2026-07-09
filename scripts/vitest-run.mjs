import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function normalizeWindowsPath(directoryPath) {
  if (process.platform !== 'win32') {
    return directoryPath;
  }

  return directoryPath.replace(/^([a-z]):/, (_match, driveLetter) => `${driveLetter.toUpperCase()}:`);
}

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = normalizeWindowsPath(path.resolve(scriptDirectory, '..'));
const vitestExecutable = path.join(projectRoot, 'node_modules', 'vitest', 'vitest.mjs');
const vitestArguments = process.argv.slice(2);

const result = spawnSync(
  process.execPath,
  [vitestExecutable, ...vitestArguments],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  },
);

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
