// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION: 安装器单实例守卫（2026-10-19 真机事故）。
//
// 事故：用户只点了一次安装，同一份 setup.exe 却跑起了 6 个安装器进程
// （kill 日志里 15:54:24 同时活着的就有 3 个）。每一个都完整跑一遍 PREINSTALL，
// 每一个都把上一个刚启动的应用杀掉 —— 用户看到的是「装完又自动启动一次安装」。
//
// 守卫的规则是「最低 PID 当选」：同一份 setup 可执行文件同时活着多个副本时，
// PID 最小的那个继续安装，其余立刻退出。
//
// 这组断言守两件事：
//   1. **接线**：守卫必须排在 PREINSTALL 的最前面，且排在杀应用之前。
//      守卫排在杀应用之后等于没写 —— 重复安装器照样会把应用杀掉。
//   2. **判别力**：守卫脚本的判定必须真的能判出「重复」。
//      这里用一份「故意改坏的副本」跑同一个验收脚本，断言它**必须失败**。
//      一套永远绿的验收脚本比没有验收脚本更糟 —— 它会让人以为这条路有覆盖。
//

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// vitest 的 import.meta.url 不是 file:// URL（ERR_INVALID_URL_SCHEME），
// 所以从 cwd 往上找包含 installer 目录的仓库根。
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
const GUARD_PATH = path.join(INSTALLER_DIR, 'check-single-instance.ps1');
const HARNESS_PATH = path.join(INSTALLER_DIR, '_acceptance', 'test-single-instance-guard.ps1');
const VERDICT_FILE_NAME = 'alpha-single-instance-duplicate.flag';

const isWindows = process.platform === 'win32';

describe('安装器单实例守卫：接线', () => {
  it('守卫脚本存在且保持纯 ASCII（PowerShell 5.1 按 ANSI 代码页读无 BOM 的 .ps1）', () => {
    const source = fs.readFileSync(GUARD_PATH, 'utf8');

    expect(
      source,
      'check-single-instance.ps1 出现了非 ASCII 字符。它被原样解包到 $PLUGINSDIR 后，'
      + 'PowerShell 5.1 读无 BOM 的 .ps1 会按系统 ANSI 代码页解码，中文注释会变成乱码。',
    ).toMatch(/^[\x00-\x7F]*$/);
  });

  it('hooks.nsh 用 File 指令内嵌守卫脚本，路径指向真实源文件', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');

    expect(
      hooks,
      '内嵌块必须用 File 指令从 ${__FILEDIR__} 取源文件并解包到 $PLUGINSDIR，'
      + '这样安装时跑的就是仓库里那一份，不存在两份文本漂移。',
    ).toMatch(
      /File\s+\/oname=\$PLUGINSDIR\\check-single-instance\.ps1\s+"\$\{__FILEDIR__\}\\check-single-instance\.ps1"/,
    );

    expect(fs.existsSync(GUARD_PATH)).toBe(true);
  });

  it('守卫必须排在杀应用之前 —— 排在后面等于没写', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');

    const guardAt = hooks.indexOf('Call AlphaCheckSingleInstance');
    const killAt = hooks.indexOf('Call AlphaTerminateAppProcesses');

    expect(guardAt, 'hooks.nsh 里找不到 Call AlphaCheckSingleInstance').toBeGreaterThan(-1);
    expect(killAt, 'hooks.nsh 里找不到 Call AlphaTerminateAppProcesses').toBeGreaterThan(-1);

    expect(
      guardAt,
      '单实例守卫必须排在 AlphaTerminateAppProcesses 之前。重复安装器的作用就是'
      + '「杀掉上一个刚启动的应用」—— 守卫排在杀应用之后，重复实例照样会杀应用，'
      + '用户看到的「装完又启动一次」一点都不会变。',
    ).toBeLessThan(killAt);
  });

  it('判定为重复时必须退出安装器，而不是继续装', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');

    expect(hooks).toMatch(/\$\{If\} \$AlphaSingleInstanceDuplicate == "1"/);
    expect(hooks).toMatch(/Quit/);
  });

  it('标记文件路径：NSIS 传给脚本的与 NSIS 自己检查的必须是同一个', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');
    const guard = fs.readFileSync(GUARD_PATH, 'utf8');

    // 标记文件的名字是 NSIS 决定的，脚本只认 -VerdictFile 参数 ——
    // 所以真正的不变量是「传进去的路径」和「检查的路径」是同一个字符串。
    // 两处写成不同的字面量时，守卫会判重复、NSIS 却看不到标记文件，
    // 重复安装器照装不误，而且没有任何报错。
    expect(
      hooks,
      'nsExec 必须把标记文件路径传给守卫脚本的 -VerdictFile 参数。',
    ).toContain(`-VerdictFile "$PLUGINSDIR\\${VERDICT_FILE_NAME}"`);

    expect(
      hooks,
      'IfFileExists 检查的必须是同一个标记文件路径。',
    ).toContain(`IfFileExists "$PLUGINSDIR\\${VERDICT_FILE_NAME}"`);

    // 脚本侧必须真的认这个参数名，否则 nsExec 会因为绑定失败而什么都没做。
    expect(guard).toMatch(/\[string\]\$VerdictFile\s*=\s*''/);
    expect(guard).toContain('Write-VerdictFile -Path $VerdictFile');
  });

  it('静默模式（/S）下不得弹模态框 —— 没人点它，安装会永远卡住', () => {
    const hooks = fs.readFileSync(HOOKS_PATH, 'utf8');

    expect(hooks).toMatch(/\$\{GetOptions\} \$CMDLINE "\/S"/);
    expect(
      hooks,
      'MessageBox 必须被 AlphaSilentMode 保护。/S 静默安装没有界面，'
      + '一个模态框会让安装永远等着一个永远不会出现的点击。',
    ).toMatch(/\$\{If\} \$AlphaSilentMode == "0"[\s\S]{0,200}MessageBox/);
  });
});

describe.skipIf(!isWindows)('安装器单实例守卫：判定与判别力', () => {
  function runHarness(guardScript?: string) {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', HARNESS_PATH];

    if (guardScript) {
      args.push('-GuardScript', guardScript);
    }

    const result = spawnSync('powershell', args, { encoding: 'utf8', timeout: 120000 });

    return {
      status: result.status,
      output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    };
  }

  it('判定表全部符合预期', () => {
    const result = runHarness();

    expect(
      result.status,
      `单实例守卫验收脚本失败：\n${result.output}\n`
      + '它跑的是 installer/_acceptance/test-single-instance-guard.ps1，'
      + '里面是「最低 PID 当选」的五条判定用例。',
    ).toBe(0);

    expect(result.output).toContain('OK: all single-instance guard cases passed');
  });

  it('判别力：把判定改坏之后，验收脚本必须转红', () => {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'afm-guard-negative-'));
    const brokenPath = path.join(scratch, 'check-single-instance.ps1');

    // 故意让「比自己 PID 小的兄弟安装器」这条判据永远不成立 ——
    // 于是重复实例会被误判成主实例，验收脚本里那两条「应当退出」的用例必须失败。
    const broken = fs
      .readFileSync(GUARD_PATH, 'utf8')
      .replace(
        '$older = @($siblingPidList | Where-Object { $_ -lt $resolvedInstallerPid })',
        '$older = @($siblingPidList | Where-Object { $_ -lt $resolvedInstallerPid -and $false })',
      );

    expect(
      broken,
      '注入点没找到 —— 守卫脚本的选举语句被改过了，判别力测试必须跟着更新。',
    ).not.toBe(fs.readFileSync(GUARD_PATH, 'utf8'));

    fs.writeFileSync(brokenPath, broken, 'utf8');

    const result = runHarness(brokenPath);

    expect(
      result.status,
      `把守卫判定改坏之后，验收脚本居然还是绿的（exit=${result.status}）：\n${result.output}\n`
      + '这说明验收脚本没有判别力 —— 它证明不了守卫真的会拦住重复安装器。',
    ).toBe(1);

    expect(result.output).toContain('FAILED:');
  });
});
