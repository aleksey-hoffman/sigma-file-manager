import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(currentFilePath);
const rootDirectory = path.resolve(scriptsDirectory, '..');
const packageJsonPath = path.join(rootDirectory, 'package.json');
const cargoTomlPath = path.join(rootDirectory, 'src-tauri', 'Cargo.toml');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;

if (typeof packageVersion !== 'string' || packageVersion.trim().length === 0) {
  throw new Error('package.json version is missing or invalid');
}

const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
const updatedCargoTomlContent = cargoTomlContent.replace(
  /^version\s*=\s*"[^"]+"$/m,
  `version = "${packageVersion}"`,
);

if (cargoTomlContent === updatedCargoTomlContent) {
  console.log(`Cargo.toml is already synced to ${packageVersion}`);
  process.exit(0);
}

fs.writeFileSync(cargoTomlPath, updatedCargoTomlContent);
console.log(`Synced Cargo.toml version to ${packageVersion}`);
