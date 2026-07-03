import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const packagePath = require.resolve('@choochmeque/tauri-windows-bundle/package.json');
const cliPath = packagePath.replace(/package\.json$/, 'dist/cli.js');

let cliSource = readFileSync(cliPath, 'utf8');

const replacements = [
  {
    from: 'EXECUTABLE: `${config.displayName.replace(/\\s+/g, \'\')}.exe`,',
    to: 'EXECUTABLE: config.executable || `${config.displayName.replace(/\\s+/g, \'\')}.exe`,',
  },
  {
    from: 'const exeName = `${config.displayName.replace(/\\s+/g, \'\')}.exe`;',
    to: 'const exeName = config.executable || `${config.displayName.replace(/\\s+/g, \'\')}.exe`;',
  },
  {
    from: 'const executable = `${config.displayName.replace(/\\s+/g, \'\')}.exe`;',
    to: 'const executable = config.executable || `${config.displayName.replace(/\\s+/g, \'\')}.exe`;',
  },
];

for (const replacement of replacements) {
  if (!cliSource.includes(replacement.to)) {
    if (!cliSource.includes(replacement.from)) {
      throw new Error(`Could not patch tauri-windows-bundle. Missing pattern: ${replacement.from}`);
    }

    cliSource = cliSource.replace(replacement.from, replacement.to);
  }
}

writeFileSync(cliPath, cliSource);
