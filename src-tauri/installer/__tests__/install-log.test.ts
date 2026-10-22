// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION: 安装器安装日志（2026-10-22）。
//
// 背景：用户反馈「装完 3.4.0 又装了一次，似乎激活了在线更新」。查安装日志
// 才发现：安装器只有两个持久日志（单实例守卫、杀进程），**安装器自己的决定
// 一个都没落盘** —— 装了哪个目录、检测到既有安装没有、既有版本是几、这次
// 是不是同版本重装，全都无法从产物上回答。
//
// 这组断言守三件事：
//   1. **接线**：四个阶段（PRE/POSTINSTALL、PRE/POSTUNINSTALL）都要写日志，
//      少一个就有一段时间是黑的。
//   2. **判别力**：日志必须能区分「同版本重装」与「升级安装」—— 这正是本次
//      问题的核心判据。一条永远写着 unknown 的日志等于没有日志。
//   3. **纯 ASCII**：脚本被原样解包到 $PLUGINSDIR 运行，PowerShell 5.1 按
//      系统 ANSI 代码页读无 BOM 文件，非 ASCII 字符会变成乱码。
//

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function findInstallerDir(): string {
  let dir = process.cwd();

  for (let i = 0; i < 10; i += 1) {
    const candidate = path.join(dir, 'src-tauri', 'installer');

    if (fs.existsSync(path.join(candidate, 'kill-app-tree.ps1'))) {
      return candidate;
    }

    const parent = path.dirname(dir);

    if (parent === dir) break;
    dir = parent;
  }

  throw new Error('从 cwd 向上找不到 src-tauri/installer');
}

const INSTALLER_DIR = findInstallerDir();
const HOOKS_PATH = path.join(INSTALLER_DIR, 'hooks.nsh');
const LOG_SCRIPT_PATH = path.join(INSTALLER_DIR, 'write-install-log.ps1');

const isWindows = process.platform === 'win32';

/**
 * 跑一次写日志脚本，返回日志文件内容。
 */
function runLogScript(args: string[]): string {
  const logFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), 'afm-install-log-')),
    'install.log',
  );

  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      LOG_SCRIPT_PATH,
      '-LogFileOverride',
      logFile,
      ...args,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );

  expect(result.status, `写日志脚本失败: ${result.stderr}`).toBe(0);
  expect(fs.existsSync(logFile), '日志文件应当被创建').toBe(true);

  return fs.readFileSync(logFile, 'utf8');
}

/**
 * 找一个带版本资源、且版本号读得出来的系统文件，用来当「安装器自身」。
 */
function findVersionedSystemFile(): string {
  const candidates = [
    path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'kernel32.dll'),
    path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'notepad.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return '';
}

describe('安装器安装日志', () => {
  it('hooks.nsh 在四个阶段都写了日志', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');

    expect(hooks).toContain('StrCpy $AlphaLogPhase "PREINSTALL"');
    expect(hooks).toContain('StrCpy $AlphaLogPhase "POSTINSTALL"');
    expect(hooks).toContain('StrCpy $AlphaLogPhase "PREUNINSTALL"');
    expect(hooks).toContain('StrCpy $AlphaLogPhase "POSTUNINSTALL"');

    expect(hooks).toContain('Call AlphaLogInstall');
    expect(hooks).toContain('Call un.AlphaLogInstall');
  });

  it('日志脚本被编译期内嵌到 $PLUGINSDIR', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');

    expect(hooks).toContain(
      'File /oname=$PLUGINSDIR\\write-install-log.ps1 "${__FILEDIR__}\\write-install-log.ps1"',
    );
  });

  it('日志脚本是纯 ASCII', () => {
    const raw = fs.readFileSync(LOG_SCRIPT_PATH);

    for (const byte of raw) {
      expect(byte, '安装日志脚本必须保持纯 ASCII').toBeLessThanOrEqual(0x7f);
    }
  });

  it.runIf(isWindows)('同版本重装会被标成 yes', () => {
    const versioned = findVersionedSystemFile();

    expect(versioned, '本机应当能找到带版本资源的系统文件').not.toBe('');

    const version = (fs.statSync(versioned) && readProductVersion(versioned)) ?? '';

    expect(version).not.toBe('');

    const log = runLogScript([
      '-Phase',
      'PREINSTALL',
      '-InstallerPath',
      versioned,
      '-InstDir',
      'D:\\Program Files\\Alpha File Manager',
      '-DetectedVersion',
      version,
      '-DetectedLocation',
      'D:\\Program Files\\Alpha File Manager',
    ]);

    expect(log).toContain('phase=PREINSTALL');
    expect(log).toContain(`installerVersion=${version}`);
    expect(log).toContain('sameVersionReinstall=yes');
    expect(log).toContain('detectedLocation=');
  });

  it.runIf(isWindows)('版本不同会被标成 no', () => {
    const versioned = findVersionedSystemFile();

    expect(versioned).not.toBe('');

    const log = runLogScript([
      '-Phase',
      'POSTINSTALL',
      '-InstallerPath',
      versioned,
      '-DetectedVersion',
      '0.0.1',
    ]);

    expect(log).toContain('phase=POSTINSTALL');
    expect(log).toContain('sameVersionReinstall=no');
    expect(log).toContain('detectedVersion=0.0.1');
  });

  it.runIf(isWindows)('没有既有安装时记成 none', () => {
    const log = runLogScript(['-Phase', 'PREUNINSTALL']);

    expect(log).toContain('sameVersionReinstall=unknown');
    expect(log).toContain('detectedVersion=none');
    expect(log).toContain('detectedLocation=\'none\'');
  });

  it('日志行带时间戳，便于与守卫/杀进程日志对时', () => {
    const log = runLogScript(['-Phase', 'POSTINSTALL']);

    expect(log).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \[install\]/);
  });
});

function readProductVersion(filePath: string): string {
  const result = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `(Get-Item -LiteralPath '${filePath}').VersionInfo.ProductVersion`,
    ],
    { encoding: 'utf8', timeout: 60_000 },
  );

  return (result.stdout ?? '').trim();
}
