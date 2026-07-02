import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { download as downloadEdgeDriver } from 'edgedriver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const driversDirectory = path.join(__dirname, '..', '.drivers');
const edgeDriverPath = path.join(driversDirectory, 'msedgedriver.exe');
const versionMarkerPath = path.join(driversDirectory, 'webview-version.txt');

function compareVersionStrings(left, right) {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);

  for (let index = 0; index < 4; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return 0;
}

function readVersionMarker() {
  if (!fs.existsSync(versionMarkerPath)) {
    return null;
  }

  return fs.readFileSync(versionMarkerPath, 'utf8').trim() || null;
}

function writeVersionMarker(webViewVersion) {
  fs.mkdirSync(driversDirectory, { recursive: true });
  fs.writeFileSync(versionMarkerPath, `${webViewVersion}\n`);
}

function getInstalledDriverVersion(driverPath) {
  if (!fs.existsSync(driverPath)) {
    return null;
  }

  const result = spawnSync(driverPath, ['--version'], { encoding: 'utf8' });
  const output = `${result.stdout}\n${result.stderr}`;
  const match = output.match(/(\d+\.\d+\.\d+\.\d+)/);
  return match?.[1] ?? null;
}

function getWebView2VersionOnWindows() {
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const webViewRoot = path.join(programFilesX86, 'Microsoft', 'EdgeWebView', 'Application');

  if (!fs.existsSync(webViewRoot)) {
    return null;
  }

  const versionDirectories = fs.readdirSync(webViewRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .filter(name => /^\d+\.\d+\.\d+\.\d+$/.test(name))
    .sort(compareVersionStrings);

  return versionDirectories.at(-1) ?? null;
}

function removeInstalledDriver() {
  if (fs.existsSync(edgeDriverPath)) {
    fs.unlinkSync(edgeDriverPath);
  }

  const driverNotesDirectory = path.join(driversDirectory, 'Driver_Notes');
  if (fs.existsSync(driverNotesDirectory)) {
    fs.rmSync(driverNotesDirectory, { recursive: true, force: true });
  }

  if (fs.existsSync(versionMarkerPath)) {
    fs.unlinkSync(versionMarkerPath);
  }
}

function driverMatchesWebViewVersion(driverVersion, webViewVersion) {
  if (!driverVersion || !webViewVersion) {
    return false;
  }

  return compareVersionStrings(driverVersion, webViewVersion) === 0;
}

export async function resolveEdgeDriverPath(options = {}) {
  const { forceRefresh = false } = options;

  if (process.platform !== 'win32') {
    return null;
  }

  const explicitDriverPath = process.env.SFM_MS_EDGE_DRIVER_PATH;
  if (explicitDriverPath) {
    return explicitDriverPath;
  }

  const webViewVersion = getWebView2VersionOnWindows();
  if (!webViewVersion) {
    throw new Error(
      'Could not detect Microsoft Edge WebView2 runtime version. Install WebView2 or set SFM_MS_EDGE_DRIVER_PATH.',
    );
  }

  const markerVersion = readVersionMarker();
  const installedDriverVersion = getInstalledDriverVersion(edgeDriverPath);
  const hasMatchingDriver = fs.existsSync(edgeDriverPath)
    && markerVersion === webViewVersion
    && driverMatchesWebViewVersion(installedDriverVersion, webViewVersion);

  if (!forceRefresh && hasMatchingDriver) {
    return edgeDriverPath;
  }

  removeInstalledDriver();
  fs.mkdirSync(driversDirectory, { recursive: true });

  const downloadedDriverPath = await downloadEdgeDriver(webViewVersion, driversDirectory);
  const downloadedDriverVersion = getInstalledDriverVersion(downloadedDriverPath);

  if (!driverMatchesWebViewVersion(downloadedDriverVersion, webViewVersion)) {
    throw new Error(
      `Downloaded msedgedriver ${downloadedDriverVersion ?? 'unknown'} does not match WebView2 ${webViewVersion}.`,
    );
  }

  writeVersionMarker(webViewVersion);
  return downloadedDriverPath;
}
