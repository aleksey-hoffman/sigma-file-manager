#!/usr/bin/env node
/**
 * 审计「upstream 有、AFM 没有」的改动里，有多少其实已经以重写方式落地。
 *
 * 背景：AFM 是 fork，和 upstream 深度分叉（merge base 在 2026-08-27）。
 * AFM 历史上做过两轮「上游 A/B 类改动移植」——是**重写移植**，不是 cherry-pick，
 * 所以 `git cherry` 会把所有 upstream commit 都判成「未移植」。那个判据在本项目是错的。
 *
 * 本脚本的判据：对每个 upstream commit，取它补丁里的**新增行**（去文件头/空行/纯括号行），
 * 逐行到 AFM HEAD 的对应文件里找。命中率高 = 功能已经在；命中率低 = 真落后。
 * 100% 不代表逐字节一致（注释、格式化、license 头都可能差），但能可靠区分
 * 「完全没做」和「做了但改写过」。
 *
 * 用法：
 *   git fetch upstream main
 *   node scripts/audit-upstream-port.cjs
 *   node scripts/audit-upstream-port.cjs --max 90    # 只看命中率低于 90% 的明细
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, maxBuffer: 256 * 1024 * 1024, encoding: 'utf8' });
}

/** 文件可能不存在（upstream 新增、AFM 没有）——把 stderr 吞掉，只看返回值 */
function gitTry(args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      maxBuffer: 256 * 1024 * 1024,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

const maxIdx = process.argv.indexOf('--max');
const threshold = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : 90;

const mergeBase = git(['merge-base', 'HEAD', 'upstream/main']).trim();
const shas = git(['rev-list', '--reverse', `${mergeBase}..upstream/main`]).trim().split('\n');

console.log(`merge-base = ${mergeBase.slice(0, 8)}`);
console.log(`upstream commits not in AFM = ${shas.length}\n`);

const results = [];

for (const sha of shas) {
  const [date, subject] = git(['log', '-1', '--format=%ci%x09%s', sha]).trim().split('\t');
  let patch = '';
  try {
    patch = git(['show', '--format=', '--unified=0', sha]);
  } catch {
    patch = '';
  }

  // 按文件分组收集新增行
  const perFile = new Map();
  let currentFile = null;
  for (const line of patch.split('\n')) {
    const header = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (header) {
      currentFile = header[2];
      if (!perFile.has(currentFile)) perFile.set(currentFile, []);
      continue;
    }
    if (currentFile === null) continue;
    if (/^(index |--- |\+\+\+ |@@)/.test(line)) continue;
    if (!line.startsWith('+')) continue;
    const text = line.slice(1).trim();
    if (!text || text === '{' || text === '}' || text === '});') continue;
    perFile.get(currentFile).push(text);
  }

  let total = 0;
  let hit = 0;
  const fileStats = [];
  for (const [file, addedLines] of perFile) {
    if (!addedLines.length) continue;
    let afmContent = gitTry(['show', `HEAD:${file}`]);
    if (afmContent === null) {
      fileStats.push({ file, total: addedLines.length, hit: 0, missing: true });
      total += addedLines.length;
      continue;
    }
    const afmLines = new Set(afmContent.split('\n').map((l) => l.trim()));
    const fileHit = addedLines.filter((l) => afmLines.has(l)).length;
    fileStats.push({ file, total: addedLines.length, hit: fileHit, missing: false });
    total += addedLines.length;
    hit += fileHit;
  }

  results.push({
    sha: sha.slice(0, 8),
    date: date.slice(0, 10),
    subject,
    pct: total ? Math.round((hit / total) * 100) : 0,
    hit,
    total,
    fileStats,
  });
}

console.log('=== 移植完成度（upstream 新增行在 AFM HEAD 的命中率）===');
for (const r of results) {
  const bar = '#'.repeat(Math.round(r.pct / 5)).padEnd(20, '.');
  console.log(`${r.sha}  ${r.date}  ${String(r.pct).padStart(3)}%  ${bar}  ${r.subject.slice(0, 70)}`);
}

const low = results.filter((r) => r.pct < threshold);
if (!low.length) {
  console.log(`\n没有命中率低于 ${threshold}% 的 commit。`);
} else {
  console.log(`\n=== 命中率低于 ${threshold}% 的 commit 的文件级明细 ===`);
  for (const r of low) {
    console.log(`\n--- ${r.sha} ${r.subject}  (${r.pct}%)`);
    for (const f of r.fileStats) {
      const pct = f.total ? Math.round((f.hit / f.total) * 100) : 100;
      console.log(`    ${String(pct).padStart(3)}%  (${f.hit}/${f.total})  ${f.file}${f.missing ? '   [AFM 无此文件]' : ''}`);
    }
  }
}
