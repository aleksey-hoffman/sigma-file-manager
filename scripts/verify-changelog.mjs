// 校验 CHANGELOG.md 与应用版本号同步。
//
// 为什么需要它（2026-10-14 实测事故）：
//   3.1.0 已经发布并上传到站点，GitHub release 也有正文，README 也写好了，
//   但首启的更新弹窗仍然显示 3.0.1 的内容。原因是 CHANGELOG.md 从 2.2.0
//   之后就没再更新过 —— 3.0.0 / 3.0.1 / 3.0.2 / 3.0.3 / 3.1.0 全都缺条目。
//
//   use-changelog.ts 的查找逻辑是
//       releases.find(r => r.version === appVersion) || releases[0]
//   找不到当前版本就静默回退到文件里最旧的那条，不报错、不告警。于是「发版
//   完成」和「用户看到正确的更新说明」之间没有任何一道自动检查。
//
//   这个脚本把那道检查补上：版本号对不上就退出码非零。
//
// 用法：node scripts/verify-changelog.mjs
//      （发版流程里应作为 release:prepare 之后的一步）

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\//, '').replace(/\/$/, ''));

const problems = [];
const notes = [];

function readJson(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) {
    problems.push(`文件不存在: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  }
  catch (err) {
    problems.push(`${relPath} 不是合法 JSON: ${err.message}`);
    return null;
  }
}

// 与 use-changelog.ts 的 parseChangelog 使用同一条正则，格式变了这里也会红。
function parseVersions(markdown) {
  const out = [];
  const re = /^## \[([^\]]+)\] - (.+)$/gm;
  for (const m of markdown.matchAll(re)) {
    out.push({ version: m[1], date: m[2] });
  }
  return out;
}

const pkg = readJson('package.json');
const changelogPath = path.join(ROOT, 'CHANGELOG.md');

if (!pkg || !fs.existsSync(changelogPath)) {
  for (const p of problems) console.error(`FAIL  ${p}`);
  process.exit(1);
}

const appVersion = pkg.version;

if (!appVersion) {
  console.error('FAIL  package.json 没有 version 字段');
  process.exit(1);
}

const markdown = fs.readFileSync(changelogPath, 'utf8');
const releases = parseVersions(markdown);

console.log(`应用版本      : ${appVersion}`);
console.log(`CHANGELOG 条目 : ${releases.length}`);
for (const r of releases.slice(0, 6)) {
  console.log(`   [${r.version}] - ${r.date}`);
}

// 1. 当前版本必须有条目 —— 否则弹窗会静默回退到最旧的一条。
if (!releases.some(r => r.version === appVersion)) {
  const fallback = releases[0];
  problems.push(
    fallback
      ? `CHANGELOG.md 没有 ${appVersion} 的条目，更新弹窗会回退显示 ${fallback.version}`
      : `CHANGELOG.md 解析不出任何版本条目（检查 \`## [x.y.z] - <date>\` 格式）`,
  );
}

// 2. 条目必须按版本从新到旧排列 —— use-changelog.ts 取 releases[0] 当兜底。
if (releases.length > 1) {
  const order = releases.map(r => r.version);
  const descending = [...order].sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pb[i] ?? 0) - (pa[i] ?? 0);
      if (d !== 0) return d;
    }
    return 0;
  });
  if (order.join(',') !== descending.join(',')) {
    problems.push(`CHANGELOG.md 条目未按版本从新到旧排列，实际顺序: ${order.slice(0, 6).join(' > ')}`);
  }
}

// 3. 中文用户看到的是 public/changelog/<locale>/changelog.md，不是根 CHANGELOG.md。
//    中文 locale code 是 `ch`，不是 `zh`（见 AGENTS.md）。
const localizedDir = path.join(ROOT, 'public', 'changelog');

// PowerShell 5.1 的 `Set-Content -Encoding UTF8` 会写 BOM，而 JSON.parse 和
// 这些 markdown 都要按无 BOM UTF-8 读；内容里出现 U+FFFD 则说明某个环节
// 用 GBK/ANSI 码页解码过。两者都在发版前拦下来。
function checkEncoding(label, file, problems) {
  const buf = fs.readFileSync(file);
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    problems.push(`${label} 带 UTF-8 BOM，按无 BOM UTF-8 读会出问题`);
  }
  const text = buf.toString('utf8');
  const bad = (text.match(/\uFFFD/g) || []).length;
  if (bad > 0) {
    problems.push(`${label} 含 ${bad} 个 U+FFFD 替换符，说明曾被按 ANSI/GBK 码页解码过`);
  }
}

checkEncoding('CHANGELOG.md', changelogPath, problems);

if (fs.existsSync(localizedDir)) {
  for (const locale of fs.readdirSync(localizedDir, { withFileTypes: true })) {
    if (!locale.isDirectory()) continue;
    const file = path.join(localizedDir, locale.name, 'changelog.md');
    if (!fs.existsSync(file)) continue;

    checkEncoding(`public/changelog/${locale.name}/changelog.md`, file, problems);

    const localVersions = parseVersions(fs.readFileSync(file, 'utf8'));
    const has = localVersions.some(r => r.version === appVersion);
    if (!has) {
      const top = localVersions[0];
      notes.push(
        `public/changelog/${locale.name}/changelog.md 停在 ${top ? top.version : '(无条目)'}`,
      );
    }
  }
}

if (notes.length) {
  console.log('');
  console.log('本地化 changelog 尚未覆盖当前版本（use-changelog.ts 会回退到英文条目）：');
  for (const n of notes) console.log(`   ${n}`);
}

if (problems.length) {
  console.error('');
  for (const p of problems) console.error(`FAIL  ${p}`);
  console.error('');
  console.error('更新弹窗会显示过期内容。补 CHANGELOG.md 后再发版。');
  process.exit(1);
}

console.log('');
console.log('OK    CHANGELOG.md 覆盖当前版本，条目顺序正确。');