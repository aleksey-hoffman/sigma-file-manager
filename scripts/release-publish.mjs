// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/**
 * 发版流水线：升版本号 → 打包 → 更新站点版本清单 → 上传 aiec.fun → 发布 GitHub 兜底 release。
 *
 * 为什么要有这个脚本：
 * 一次完整发版涉及 4 个文件系统的状态同步，任何一处漏掉都会产生"看起来成功、实际不一致"的故障：
 *   1. package.json / Cargo.toml 的版本号
 *   2. release/ 里的安装包
 *   3. 站点源目录里的安装包副本 + version.json（version / sha256 / pub_date / history[]）
 *   4. 服务器上的实际文件 + GitHub release 资产
 *
 * 最阴的一处：version.json 的 sha256 与安装包**必须成对更新**。
 * 应用下载后会本地比 sha256，不匹配就删除文件 —— 只换包不同步清单，
 * 会让校验功能反过来挡住正常用户。所以本脚本把这两步绑在一个命令里。
 *
 * 子命令：
 *   prepare  升版本号 + 打包 + 写站点源（不含上传）
 *   upload   SFTP 上传到服务器 + 带 cache-busting 回读校验
 *   github   创建/更新 GitHub 兜底 release
 *   verify   只做公网回读校验（不改动任何东西）
 *   status   打印本地与线上当前状态
 *
 * 可配置（环境变量）：
 *   AFM_SITE_DIR        站点源目录   默认 E:\办公文件\L1网站\alpha-file-manager
 *   AFM_SITE_URL        站点基址     默认 https://www.aiec.fun/alpha-file-manager
 *   AFM_SFTP_PYTHON     上传用的 python（含 paramiko）默认 E:\办公文件\L1网站\.venv-sftp\Scripts\python.exe
 *   AFM_GH_REPO         GitHub 兜底仓 默认 kizemo/alpha-file-manager
 *   AFM_TOOLCHAIN_BIN   Rust 工具链   默认 1.90.0（见下方说明）
 *
 * 用法示例：
 *   node scripts/release-publish.mjs prepare --bump patch --notes-file ./_notes.md
 *   node scripts/release-publish.mjs upload
 *   node scripts/release-publish.mjs github
 *   node scripts/release-publish.mjs status
 */

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SITE_DIR = process.env.AFM_SITE_DIR ?? 'E:\\办公文件\\L1网站\\alpha-file-manager';
const SITE_URL = (process.env.AFM_SITE_URL ?? 'https://www.aiec.fun/alpha-file-manager').replace(/\/+$/, '');
const SFTP_PYTHON = process.env.AFM_SFTP_PYTHON ?? 'E:\\办公文件\\L1网站\\.venv-sftp\\Scripts\\python.exe';
const GH_REPO = process.env.AFM_GH_REPO ?? 'kizemo/alpha-file-manager';
const TOOLCHAIN_BIN = process.env.AFM_TOOLCHAIN_BIN
  ?? path.join(process.env.USERPROFILE ?? '', '.rustup', 'toolchains', '1.90.0-x86_64-pc-windows-msvc', 'bin');

const PLATFORM_KEY = 'windows-x86_64';
const MAX_HISTORY_ENTRIES = 20;

function fail(message) {
  console.error(`\n[release] ${message}\n`);
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

/** 带前置参数解析：node script.mjs <command> [--flag value] */
function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    }
    else {
      flags[key] = next;
      index += 1;
    }
  }
  return { command, flags };
}

function bumpVersion(version, kind) {
  if (kind === 'none') return version;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    fail(`版本号 ${version} 不是 X.Y.Z 形态，无法自动递增`);
  }
  const [, major, minor, patch] = match.map(Number);
  if (kind === 'major') return `${major + 1}.0.0`;
  if (kind === 'minor') return `${major}.${minor + 1}.0`;
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`;
  fail(`未知的 --bump 取值：${kind}（可用：patch / minor / major / none）`);
  return version;
}

/** 站点上的安装包用下划线命名，避免 URL 里的空格需要百分号编码。 */
function siteFileName(version) {
  return `Alpha_File_Manager_${version}_x64-setup.exe`;
}

function latestInstaller(releaseDir) {
  if (!fs.existsSync(releaseDir)) return null;
  const installers = fs
    .readdirSync(releaseDir)
    .filter(name => name.toLowerCase().endsWith('.exe'))
    .map((name) => {
      const full = path.join(releaseDir, name);
      return { name, full, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return installers[0] ?? null;
}

function run(command, args, options = {}) {
  // 不经 shell 传参数数组。shell: true 会把参数交给 cmd.exe 重新拼接，
  // 遇到非 ASCII 路径（本项目的站点源在 E:\办公文件\ 下）会被打散：
  // 2026-10-10 实测 `gh release create` 因此报 "no matches found for `File`"。
  // 调用方历史上为了迁就 shell 会给含空格的参数手动加引号，这里统一剥掉，
  // 让 spawn 自己负责参数边界。
  const isWindows = process.platform === 'win32';
  // Windows 上 npm 是 .cmd shim，没有 shell 时必须带扩展名。
  const wantsCmdShim = isWindows && command === 'npm';

  let exe = command;
  let spawnArgs = args.map((arg) => {
    if (typeof arg === 'string' && arg.length >= 2 && arg.startsWith('"') && arg.endsWith('"')) {
      return arg.slice(1, -1);
    }
    return arg;
  });

  // Node 20+ 起，spawnSync 以 shell:false 执行 .cmd/.bat shim 会直接返回 EINVAL
  // （2026-10-11 实测 `spawnSync npm.cmd EINVAL`，release:prepare 因此中断）。
  //
  // 不能简单改成 shell:true —— 那正是上面注释里记录的中文路径被打散的坑。
  // 改用 `cmd.exe /d /c <shim> <args>`：cmd.exe 只负责把 .cmd shim 跑起来，
  // 参数仍由 spawn 按数组逐个传递，不经过 cmd.exe 的重新拼接，
  // 因此 `E:\办公文件\` 这类路径不会被拆开。
  let wrapper = null;
  if (wantsCmdShim) {
    wrapper = process.env.ComSpec || 'cmd.exe';
    exe = wrapper;
    spawnArgs = ['/d', '/c', 'npm.cmd', ...spawnArgs];
  }

  const result = spawnSync(exe, spawnArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) fail(`执行 ${command} 失败：${result.error.message}`);
  if (typeof result.status === 'number' && result.status !== 0 && !options.allowFailure) {
    fail(`${command} ${spawnArgs.slice(wantsCmdShim ? 3 : 0).join(' ')} 退出码 ${result.status}`);
  }
  return result.status;
}

function readNotes(flags) {
  if (flags.notes) return String(flags.notes);
  if (flags['notes-file']) {
    const notesPath = path.resolve(repoRoot, String(flags['notes-file']));
    if (!fs.existsSync(notesPath)) fail(`--notes-file 指向的文件不存在：${notesPath}`);
    return fs.readFileSync(notesPath, 'utf8').trim();
  }
  return null;
}

// ---------------------------------------------------------------- prepare

function prepare(flags) {
  const bumpKind = String(flags.bump ?? 'patch');
  const notes = readNotes(flags);

  if (!notes && !flags['keep-notes']) {
    fail('必须提供 --notes-file <文件> 或 --notes <文本>。\n'
      + '  站点页面与 GitHub 都会把这段文字展示给用户，\n'
      + '  沿用旧说明等于发一个内容对不上的版本。若确实要沿用，显式加 --keep-notes。');
  }

  const packageJsonPath = path.join(repoRoot, 'package.json');
  const packageJson = readJson(packageJsonPath);
  const oldVersion = packageJson.version;
  const newVersion = bumpVersion(oldVersion, bumpKind);

  console.log(`[release] 版本 ${oldVersion} -> ${newVersion}（--bump ${bumpKind}）`);
  if (oldVersion !== newVersion) {
    packageJson.version = newVersion;
    writeJson(packageJsonPath, packageJson);
  }

  if (!flags['skip-build']) {
    // rustup 的代理 shim 可能不在 PATH 上，直接用具体 toolchain。
    const toolchainExists = fs.existsSync(path.join(TOOLCHAIN_BIN, 'cargo.exe'));
    if (toolchainExists) {
      process.env.PATH = `${TOOLCHAIN_BIN};${process.env.PATH}`;
    }
    else {
      console.warn(`[release] 未找到 ${TOOLCHAIN_BIN}，将使用 PATH 上的 cargo`);
    }
    console.log('[release] 打包中（约 8 分钟）…');
    run('npm', ['run', 'tauri:build']);
  }
  else {
    console.log('[release] 跳过打包（--skip-build），使用 release/ 里现有的产物');
    run('npm', ['run', 'sync-version']);
  }

  const installer = latestInstaller(path.join(repoRoot, 'release'));
  if (!installer) fail('release/ 下没有找到安装包');

  const installerHash = sha256File(installer.full);
  console.log(`[release] 安装包：${installer.name}`);
  console.log(`[release] 大小    ：${fs.statSync(installer.full).size} 字节`);
  console.log(`[release] sha256 ：${installerHash}`);

  if (!fs.existsSync(SITE_DIR)) fail(`站点源目录不存在：${SITE_DIR}`);
  const manifestPath = path.join(SITE_DIR, 'version.json');
  if (!fs.existsSync(manifestPath)) fail(`站点版本清单不存在：${manifestPath}`);

  const manifest = readJson(manifestPath);

  // 版本号变了才归档旧版本，避免同版本重打包时把历史搅乱。
  if (oldVersion !== newVersion && manifest.version === oldVersion) {
    const previousUrl = manifest.platforms?.[PLATFORM_KEY]?.url;
    manifest.history ??= [];
    manifest.history.unshift({
      version: manifest.version,
      notes: manifest.notes ?? '',
      pub_date: manifest.pub_date ?? null,
      url: previousUrl ?? null,
      sha256: manifest.sha256 ?? null,
    });
    manifest.history = manifest.history.slice(0, MAX_HISTORY_ENTRIES);
    console.log(`[release] 旧版本 ${oldVersion} 已归档进 history[]`);
  }

  manifest.version = newVersion;
  manifest.sha256 = installerHash;
  manifest.pub_date = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  manifest.release_url = `${SITE_URL}/`;
  manifest.notes = notes ?? manifest.notes;
  manifest.platforms ??= {};
  manifest.platforms[PLATFORM_KEY] = {
    url: `${SITE_URL}/${siteFileName(newVersion)}`,
    signature: '',
  };

  writeJson(manifestPath, manifest);
  console.log(`[release] 已更新 ${manifestPath}`);

  const siteInstaller = path.join(SITE_DIR, siteFileName(newVersion));
  fs.copyFileSync(installer.full, siteInstaller);
  const copiedHash = sha256File(siteInstaller);
  if (copiedHash !== installerHash) fail('复制到站点源目录后 sha256 不一致');
  console.log(`[release] 已复制安装包到 ${siteInstaller}（sha256 一致）`);

  console.log('\n[release] 下一步：');
  // 这一步不能省：github 子命令只「读」_release-notes-v<版本>.md，从不生成它。
  // 唯一的生成入口是 prepare --write-notes。漏掉它不会报错，
  // 只会安静地发一个正文为空的 release —— 所以必须在这里显式提示。
  console.log(`  node scripts/release-publish.mjs prepare --write-notes <你的说明文件>`);
  console.log('    # 生成带大小/sha256 的 _release-notes-v<版本>.md，供 github 读取正文');
  console.log(`  node scripts/release-publish.mjs upload    # 上传到 ${SITE_URL}`);
  console.log(`  node scripts/release-publish.mjs github    # 发布 GitHub 兜底 release v${newVersion}`);
  console.log('\n[release] 提醒：version.json 已改但尚未生效，需上传后用户端才能感知到该版本。');
}

function writeReleaseNotes(flags, version, hash, size, sourceNotesPath) {
  if (!sourceNotesPath) return null;
  const sourcePath = path.resolve(repoRoot, sourceNotesPath);
  if (!fs.existsSync(sourcePath)) return null;
  const notes = fs.readFileSync(sourcePath, 'utf8').trim();
  const withBuildInfo = `${notes}\n\n---\n\n## 构建信息\n\n- 版本号：\`${version}\`\n- 安装包：\`${siteFileName(version)}\`\n- 大小：${size} 字节\n- SHA-256：\`${hash}\``;
  const outputPath = path.join(SITE_DIR, `_release-notes-v${version}.md`);
  fs.writeFileSync(outputPath, `${withBuildInfo}\n`, 'utf8');
  return outputPath;
}

// ---------------------------------------------------------------- upload

async function upload() {
  if (!fs.existsSync(SFTP_PYTHON)) {
    fail(`上传用的 python 不存在：${SFTP_PYTHON}\n`
      + '  装法：python -m venv E:\\办公文件\\L1网站\\.venv-sftp\n'
      + '        E:\\办公文件\\L1网站\\.venv-sftp\\Scripts\\python.exe -m pip install paramiko');
  }

  const uploader = path.join(SITE_DIR, '_upload_alpha_files.py');
  if (!fs.existsSync(uploader)) fail(`上传脚本不存在：${uploader}`);

  console.log('[release] SFTP 上传中…');
  run(SFTP_PYTHON, [uploader]);
  await verify();
}

async function verify() {
  // Cloudflare 后面必须带 cache-busting，否则可能读到旧缓存而误判。
  const stamp = Date.now();
  const url = `${SITE_URL}/version.json?_=${stamp}`;

  const response = await fetch(url, { cache: 'no-store', headers: { 'Accept-Encoding': 'identity' } });
  if (!response.ok) fail(`读取 ${url} 失败：HTTP ${response.status}`);
  const manifest = await response.json();

  const installerUrl = manifest.platforms?.[PLATFORM_KEY]?.url;
  if (!installerUrl) fail(`线上 version.json 缺少 ${PLATFORM_KEY}.url`);

  console.log(`[verify] 线上版本  ：${manifest.version}`);
  console.log(`[verify] 发布日期  ：${manifest.pub_date ?? '(无)'}`);
  console.log(`[verify] 清单 sha256：${manifest.sha256 ?? '(无)'}`);

  const head = await fetch(installerUrl, { method: 'HEAD' });
  if (!head.ok) fail(`安装包地址不可达：${installerUrl} HTTP ${head.status}`);
  const remoteSize = Number(head.headers.get('content-length') ?? '0');

  const installer = latestInstaller(path.join(repoRoot, 'release'));
  let verdict = '仅完成连通性校验';

  if (installer) {
    const localHash = sha256File(installer.full);
    console.log(`[verify] 本地包    ：${installer.name}  ${fs.statSync(installer.full).size} 字节`);
    console.log(`[verify] 线上包大小：${remoteSize} 字节`);
    console.log(`[verify] 本地 sha256：${localHash}`);

    if (manifest.sha256 && manifest.sha256 !== localHash) {
      fail(
        `清单 sha256 (${manifest.sha256}) 与本地包 (${localHash}) 不一致。\n`
        + '  应用下载后会因校验失败删除文件，必须重新 prepare。',
      );
    }
    if (remoteSize > 0 && remoteSize !== fs.statSync(installer.full).size) {
      fail(`线上包大小 ${remoteSize} 与本地 ${fs.statSync(installer.full).size} 不一致`);
    }
    verdict = '版本号 / 大小 / sha256 三项均一致';
  }

  console.log(`[verify] 通过：${verdict}`);
}

// ---------------------------------------------------------------- github

function github(flags) {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  const version = flags.tag ? String(flags.tag).replace(/^v/, '') : packageJson.version;
  const tag = `v${version}`;

  const installer = latestInstaller(path.join(repoRoot, 'release'));
  if (!installer) fail('release/ 下没有找到安装包');

  const asset = path.join(SITE_DIR, siteFileName(version));
  if (!fs.existsSync(asset)) fail(`站点源目录里没有 ${siteFileName(version)}，请先 prepare`);

  const hash = sha256File(asset);
  const size = fs.statSync(asset).size;

  const notesPath = flags['notes-file']
    ? path.resolve(repoRoot, String(flags['notes-file']))
    : path.join(SITE_DIR, `_release-notes-v${version}.md`);

  const ghArgs = ['release', 'upload', tag, `"${asset}"`, '--repo', GH_REPO, '--clobber'];
  const viewResult = spawnSync('gh', ['release', 'view', tag, '--repo', GH_REPO], {
    stdio: 'ignore',
    shell: true,
  });

  if (viewResult.status !== 0) {
    console.log(`[release] GitHub 上没有 ${tag}，创建 release`);
    const args = ['release', 'create', tag, `"${asset}"`, '--repo', GH_REPO, '--title', `Alpha File Manager ${tag}`];
    if (fs.existsSync(notesPath)) args.push('--notes-file', `"${notesPath}"`);
    run('gh', args);
  }
  else {
    console.log(`[release] 替换 ${tag} 的 release 资产`);
    run('gh', ghArgs);
    if (fs.existsSync(notesPath)) {
      run('gh', ['release', 'edit', tag, '--repo', GH_REPO, '--notes-file', `"${notesPath}"`]);
    }
    else {
      console.warn(`[release] 未找到 ${notesPath}，跳过说明正文更新（可能留下旧的大小/哈希）`);
    }
  }

  console.log(`[release] 已处理 https://github.com/${GH_REPO}/releases/tag/${tag}`);
  console.log(`[release] 资产 ${siteFileName(version)}  ${size} 字节  sha256 ${hash}`);
}

// ---------------------------------------------------------------- status

function status() {
  const packageJson = readJson(path.join(repoRoot, 'package.json'));
  console.log(`[status] package.json 版本 ：${packageJson.version}`);

  const installer = latestInstaller(path.join(repoRoot, 'release'));
  if (installer) {
    console.log(`[status] release/ 安装包    ：${installer.name}`);
    console.log(`[status]   大小 / sha256   ：${fs.statSync(installer.full).size} / ${sha256File(installer.full)}`);
  }
  else {
    console.log('[status] release/ 安装包    ：(无)');
  }

  const manifestPath = path.join(SITE_DIR, 'version.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    console.log(`[status] 站点源 version.json：${manifest.version}`);
    console.log(`[status]   sha256          ：${manifest.sha256}`);
    console.log(`[status]   history 条数     ：${manifest.history?.length ?? 0}`);
  }
  else {
    console.log(`[status] 站点源 version.json：(不存在 ${manifestPath})`);
  }
}

// ---------------------------------------------------------------- main

const { command, flags } = parseArgs(process.argv.slice(2));

try {
  switch (command) {
    case 'prepare':
      if (flags['write-notes']) {
        // 仅生成带构建信息的说明文件，供 github 子命令使用
        const packageJson = readJson(path.join(repoRoot, 'package.json'));
        const installer = latestInstaller(path.join(repoRoot, 'release'));
        if (!installer) fail('release/ 下没有找到安装包');
        const asset = path.join(SITE_DIR, siteFileName(packageJson.version));
        const target = fs.existsSync(asset) ? asset : installer.full;
        const out = writeReleaseNotes(flags, packageJson.version, sha256File(target), fs.statSync(target).size, String(flags['write-notes']));
        if (!out) fail('未能生成 release 说明');
        console.log(`[release] 已生成 ${out}`);
      }
      else {
        prepare(flags);
      }
      break;
    case 'upload':
      upload();
      break;
    case 'verify':
      await verify();
      break;
    case 'github':
      github(flags);
      break;
    case 'status':
      status();
      break;
    default:
      console.log('用法：node scripts/release-publish.mjs <prepare|upload|verify|github|status> [选项]');
      console.log('');
      console.log('  prepare --bump patch|minor|major|none --notes-file <文件> [--skip-build]');
      console.log('  prepare --write-notes <文件>          仅生成带构建信息的 release 说明');
      console.log('  upload                                 上传到站点并回读校验');
      console.log('  verify                                 只做公网回读校验');
      console.log('  github [--notes-file <文件>]           创建或更新 GitHub 兜底 release');
      console.log('  status                                 打印本地与线上状态');
  }
}
catch (error) {
  fail(error?.stack ?? String(error));
}
