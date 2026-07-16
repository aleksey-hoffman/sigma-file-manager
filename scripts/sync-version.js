import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFilePath = fileURLToPath(import.meta.url);
const scriptsDirectory = path.dirname(currentFilePath);
const rootDirectory = path.resolve(scriptsDirectory, '..');
const packageJsonPath = path.join(rootDirectory, 'package.json');
const cargoTomlPaths = [
  path.join(rootDirectory, 'src-tauri', 'Cargo.toml'),
  path.join(rootDirectory, 'src-tauri', 'default-file-manager-common', 'Cargo.toml'),
  path.join(rootDirectory, 'src-tauri', 'default-file-manager-launcher', 'Cargo.toml'),
];

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const packageVersion = packageJson.version;

if (typeof packageVersion !== 'string' || packageVersion.trim().length === 0) {
  throw new Error('package.json version is missing or invalid');
}

let updatedManifestCount = 0;

for (const cargoTomlPath of cargoTomlPaths) {
  const cargoTomlContent = fs.readFileSync(cargoTomlPath, 'utf8');
  const updatedCargoTomlContent = cargoTomlContent.replace(
    /^version\s*=\s*"[^"]+"$/m,
    `version = "${packageVersion}"`,
  );

  if (cargoTomlContent !== updatedCargoTomlContent) {
    fs.writeFileSync(cargoTomlPath, updatedCargoTomlContent);
    updatedManifestCount += 1;
  }
}

if (updatedManifestCount === 0) {
  console.log(`Cargo manifests are already synced to ${packageVersion}`);
}
else {
  console.log(`Synced ${updatedManifestCount} Cargo manifests to ${packageVersion}`);
}
