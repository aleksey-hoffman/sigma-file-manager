import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packagePath = require.resolve('@choochmeque/tauri-windows-bundle/package.json');
const cliPath = packagePath.replace(/package\.json$/, 'dist/cli.js');

let cliSource = readFileSync(cliPath, 'utf8');

const originalExecutableName = `function executableName(config) {
    return \`\${config.displayName.replace(/\\s+/g, '')}.exe\`;
}`;
const patchedExecutableName = `function executableName(config) {
    return config.executable || \`\${config.displayName.replace(/\\s+/g, '')}.exe\`;
}`;

if (!cliSource.includes(patchedExecutableName)) {
  if (!cliSource.includes(originalExecutableName)) {
    throw new Error('Could not patch tauri-windows-bundle executableName().');
  }

  cliSource = cliSource.replace(originalExecutableName, patchedExecutableName);
}

writeFileSync(cliPath, cliSource);
