// SPDX-License-Identifier: GPL-3.0-or-later
// Local stand-in for `winget validate`.
//
// The winget CLI is not installed on this machine, so the upstream pipeline
// stays the authority. This script exists to catch the mistakes that would
// otherwise cost a 30-minute validation round trip.
//
// It checks the four manifest files of one version against the constraints
// taken from the 1.12.0 JSON schemas and the upstream rules recorded in
// docs/winget/README.md.
//
// Usage:
//   node docs/winget/check-manifest.cjs [version]
//
// A YAML parse is attempted only when the `yaml` package happens to be
// resolvable; it is not a declared dependency of this project, so the script
// degrades to structural checks instead of failing when it is absent.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const PACKAGE_ID = 'kizemo.AlphaFileManager';
const PUBLISHER = 'kizemo';
const MANIFEST_VERSION = '1.12.0';
const PRODUCT_CODE = 'Alpha File Manager';
const INSTALL_LOCATION = '%ProgramFiles%\\Alpha File Manager';
const TAG_LIMIT = 16;

const version = process.argv[2] || readCurrentVersion();
const dir = path.join(REPO, 'docs', 'winget', 'manifests', 'k', 'kizemo', 'AlphaFileManager', version);

const problems = [];
const notes = [];

function fail(message) {
  problems.push(message);
}

function ok(message) {
  notes.push(message);
}

function readCurrentVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'package.json'), 'utf8'));

  return pkg.version;
}

/** Strip one layer of surrounding quotes from a YAML scalar. */
function unquote(value) {
  if ((value.startsWith('\'') && value.endsWith('\'')) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }

  return value;
}

/** Read a top-level `Key: value` pair out of a manifest, or undefined. */
function scalar(text, key) {
  const match = new RegExp(`^${key}:[ \\t]*(.*)$`, 'm').exec(text);

  return match ? unquote(match[1].trim()) : undefined;
}

/** Read the `- item` entries of a top-level block list. */
function listItems(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line === `${key}:`);

  if (start < 0) {
    return [];
  }

  const items = [];

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('- ')) {
      items.push(line.slice(2).trim());
      continue;
    }

    if (line.trim() === '' || line.startsWith('#')) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }
  }

  return items;
}

/** Read the `Key: value` pairs of the single item in a top-level list block. */
function listItemFields(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line === `${key}:`);

  if (start < 0) {
    return {};
  }

  const fields = {};

  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('- ')) {
      const first = /^-\s+([A-Za-z][A-Za-z0-9]*):[ \t]*(.*)$/.exec(line);

      if (first) {
        fields[first[1]] = unquote(first[2].trim());
      }
      continue;
    }

    if (line.trim() === '' || line.startsWith('#')) {
      continue;
    }

    if (/^\S/.test(line)) {
      break;
    }

    const pair = /^\s+([A-Za-z][A-Za-z0-9]*):[ \t]*(.*)$/.exec(line);

    if (pair) {
      fields[pair[1]] = unquote(pair[2].trim());
    }
  }

  return fields;
}

/** Read a `|-` block scalar as text. */
function blockScalar(text, key) {
  const lines = text.split('\n');
  const start = lines.findIndex(line => line === `${key}: |-`);

  if (start < 0) {
    return '';
  }

  const out = [];

  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      out.push('');
      continue;
    }

    if (!/^\s/.test(lines[i])) {
      break;
    }

    out.push(lines[i].trim());
  }

  return out.join('\n');
}

// ------------------------------------------------------------ 1. the files
const FILES = {
  version: `${PACKAGE_ID}.yaml`,
  installer: `${PACKAGE_ID}.installer.yaml`,
  defaultLocale: `${PACKAGE_ID}.locale.en-US.yaml`,
  locale: `${PACKAGE_ID}.locale.zh-CN.yaml`,
};

const texts = {};

for (const [kind, name] of Object.entries(FILES)) {
  const file = path.join(dir, name);

  if (!fs.existsSync(file)) {
    fail(`missing file: ${name}`);
    continue;
  }

  const buffer = fs.readFileSync(file);
  const text = buffer.toString('utf8');

  texts[kind] = text;

  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    fail(`${name}: has a UTF-8 BOM`);
  }

  if (text.includes('\r\n')) {
    fail(`${name}: uses CRLF`);
  }

  if (!text.endsWith('\n')) {
    fail(`${name}: missing the trailing newline`);
  }

  if (text.includes('\uFFFD')) {
    fail(`${name}: contains U+FFFD`);
  }

  if (/[ \t]+$/m.test(text)) {
    fail(`${name}: has trailing whitespace`);
  }
}

if (Object.keys(texts).length === 4) {
  ok('4 files present, UTF-8 no BOM, LF, trailing newline');
}

// A YAML parse is a bonus check -- `yaml` is not a declared dependency here.
try {
  const YAML = (await import('yaml')).default;

  for (const text of Object.values(texts)) {
    YAML.parse(text);
  }

  ok('all four files parse as YAML');
}
catch (error) {
  if (error && (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND')) {
    notes.push('YAML parse skipped (the `yaml` package is not resolvable here)');
  }
  else {
    fail(`YAML parse error -- ${error.message}`);
  }
}

// -------------------------------------------------------- 2. per-file shape
const EXPECTED_TYPE = {
  version: 'version',
  installer: 'installer',
  defaultLocale: 'defaultLocale',
  locale: 'locale',
};

for (const [kind, text] of Object.entries(texts)) {
  if (scalar(text, 'PackageIdentifier') !== PACKAGE_ID) {
    fail(`${kind}: PackageIdentifier is ${scalar(text, 'PackageIdentifier')}`);
  }

  if (scalar(text, 'PackageVersion') !== version) {
    fail(`${kind}: PackageVersion is ${scalar(text, 'PackageVersion')}, expected ${version}`);
  }

  if (scalar(text, 'ManifestType') !== EXPECTED_TYPE[kind]) {
    fail(`${kind}: ManifestType is ${scalar(text, 'ManifestType')}, expected ${EXPECTED_TYPE[kind]}`);
  }

  if (scalar(text, 'ManifestVersion') !== MANIFEST_VERSION) {
    fail(`${kind}: ManifestVersion is ${scalar(text, 'ManifestVersion')}, expected ${MANIFEST_VERSION}`);
  }
}

// ------------------------------------------- 3. multi-file manifest coherence
if (texts.version && texts.defaultLocale) {
  const declared = scalar(texts.version, 'DefaultLocale');
  const actual = scalar(texts.defaultLocale, 'PackageLocale');

  if (declared !== actual) {
    fail(`version.DefaultLocale (${declared}) != defaultLocale.PackageLocale (${actual})`);
  }
  else {
    ok('version.DefaultLocale matches defaultLocale.PackageLocale');
  }
}

if (texts.locale && texts.defaultLocale) {
  const locale = scalar(texts.locale, 'PackageLocale');
  const def = scalar(texts.defaultLocale, 'PackageLocale');

  if (locale === def) {
    fail('the locale file duplicates the defaultLocale -- upstream reports DuplicateMultiFileManifestType');
  }
  else {
    ok('locale file does not duplicate the defaultLocale');
  }
}

// The locale manifest may only carry the translated fields.
const LOCALE_ALLOWED = [
  'PackageIdentifier',
  'PackageVersion',
  'PackageLocale',
  'ShortDescription',
  'Description',
  'Tags',
  'ManifestType',
  'ManifestVersion',
];

if (texts.locale) {
  for (const line of texts.locale.split('\n')) {
    const key = /^([A-Za-z][A-Za-z0-9]*):/.exec(line);

    if (key && !LOCALE_ALLOWED.includes(key[1])) {
      fail(`locale file carries '${key[1]}', which only belongs in the defaultLocale file`);
    }
  }

  if (!/^Moniker:/m.test(texts.locale)) {
    ok('Moniker stays in the defaultLocale file only');
  }
}

if (texts.defaultLocale && scalar(texts.defaultLocale, 'Publisher') !== PUBLISHER) {
  fail(`defaultLocale: Publisher is ${scalar(texts.defaultLocale, 'Publisher')}, expected ${PUBLISHER}`);
}

// ------------------------------------------------------- 4. schema limits
for (const kind of ['defaultLocale', 'locale']) {
  const text = texts[kind];

  if (!text) {
    continue;
  }

  const short = scalar(text, 'ShortDescription') || '';
  const long = blockScalar(text, 'Description');

  if (short.length < 3 || short.length > 256) {
    fail(`${kind}: ShortDescription length ${short.length} outside 3..256`);
  }

  if (long.length > 10000) {
    fail(`${kind}: Description length ${long.length} > 10000`);
  }

  const tags = listItems(text, 'Tags');

  if (tags.length > TAG_LIMIT) {
    fail(`${kind}: ${tags.length} tags, maxItems is ${TAG_LIMIT}`);
  }

  if (new Set(tags).size !== tags.length) {
    fail(`${kind}: duplicate tags`);
  }

  for (const tag of tags) {
    if (tag.length < 1 || tag.length > 40) {
      fail(`${kind}: tag '${tag}' length ${tag.length} outside 1..40`);
    }
  }
}

ok(`ShortDescription / Description / Tags within the ${MANIFEST_VERSION} schema limits`);

// ------------------------------------------------- 5. the installer payload
if (texts.installer) {
  const fields = listItemFields(texts.installer, 'Installers');

  if (fields.Architecture !== 'x64') {
    fail(`installer: Architecture is ${fields.Architecture}`);
  }

  if (fields.InstallerType !== 'nullsoft') {
    fail(`installer: InstallerType is ${fields.InstallerType}`);
  }

  if (fields.Scope !== 'machine') {
    fail(`installer: Scope is ${fields.Scope}`);
  }

  if (fields.ElevationRequirement !== 'elevatesSelf') {
    fail(`installer: ElevationRequirement is ${fields.ElevationRequirement}`);
  }

  if (fields.UpgradeBehavior !== 'install') {
    fail(`installer: UpgradeBehavior is ${fields.UpgradeBehavior}`);
  }

  if (fields.ProductCode !== PRODUCT_CODE) {
    fail(`installer: ProductCode is ${fields.ProductCode}, expected ${PRODUCT_CODE}`);
  }

  if (fields.DefaultInstallLocation !== INSTALL_LOCATION) {
    fail(`installer: DefaultInstallLocation is ${fields.DefaultInstallLocation}`);
  }

  const sha = (fields.InstallerSha256 || '').toUpperCase();

  if (!/^[A-F0-9]{64}$/.test(sha)) {
    fail(`installer: InstallerSha256 is not 64 upper-case hex chars (${fields.InstallerSha256})`);
  }

  const localExe = path.join(REPO, 'release', `Alpha File Manager_${version}_x64-setup.exe`);

  if (!fs.existsSync(localExe)) {
    fail(`local installer not found: ${localExe}`);
  }
  else {
    const real = crypto.createHash('sha256').update(fs.readFileSync(localExe)).digest('hex').toUpperCase();

    if (real !== sha) {
      fail(`installer: InstallerSha256 ${sha} != local installer ${real}`);
    }
    else {
      ok(`installer: InstallerSha256 matches the local installer (${fs.statSync(localExe).size} bytes)`);
    }
  }

  const expectedUrl = `https://github.com/kizemo/alpha-file-manager/releases/download/v${version}/Alpha_File_Manager_${version}_x64-setup.exe`;

  if (fields.InstallerUrl !== expectedUrl) {
    fail(`installer: InstallerUrl is ${fields.InstallerUrl}, expected ${expectedUrl}`);
  }
  else {
    ok('installer: InstallerUrl points at this version\'s GitHub release asset');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(scalar(texts.installer, 'ReleaseDate') || '')) {
    fail(`installer: ReleaseDate is ${scalar(texts.installer, 'ReleaseDate')}`);
  }
}

// ---------------------------------------------------------------- 6. report
console.log(`=== Alpha File Manager ${version} -- winget manifest self-check ===`);
console.log(`    ${dir}\n`);

for (const note of notes) {
  console.log('  + ' + note);
}

if (problems.length > 0) {
  console.log('\n=== PROBLEMS ===');

  for (const problem of problems) {
    console.log('  ! ' + problem);
  }

  process.exit(1);
}

console.log('\nAll local checks passed. The upstream pipeline is still the authority.');
