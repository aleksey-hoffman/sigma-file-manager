// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION: 守卫 kill-app-tree.ps1 与 hooks.nsh 里内嵌副本的一致性。
//
// 为什么需要这条门禁：
//   安装时真正跑的是 hooks.nsh 内嵌的那份文本，不是 src-tauri/installer/kill-app-tree.ps1。
//   两份一旦不同步，机器上生效的就是旧逻辑 —— 而且**没有任何报错**：安装照常
//   跑完，只是「从 Alpha 里启动安装器会把自己杀掉」这个 bug 悄悄回来了。
//   这类静默漂移正是本项目栽过多次的坑（语言包 key 17 个一致地缺，反而判「通过」）。
//
// 另外两条断言守的是脚本正文本身的约束：改用 File 内嵌后，NSIS 的代码页与转义
// 限制不再适用，但 PowerShell 5.1 读取无 BOM 的 .ps1 时按系统 ANSI 代码页解码，
// 非 ASCII 仍会变乱码，所以 ASCII 这条继续守住。

import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// vitest 的 import.meta.url 不是 file:// URL（ERR_INVALID_URL_SCHEME），
// 所以从 cwd 往上找包含 installer 目录的仓库根，而不是用 import.meta 推导。
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
const PS1_PATH = path.join(INSTALLER_DIR, 'kill-app-tree.ps1');
const GENERATOR_PATH = path.join(INSTALLER_DIR, 'embed-kill-script.mjs');

describe('kill-app-tree.ps1 与 hooks.nsh 的内嵌副本', () => {
  it('hooks.nsh 里内嵌的脚本与 .ps1 源文件同步', () => {
    const result = spawnSync(process.execPath, [GENERATOR_PATH, '--check'], {
      cwd: INSTALLER_DIR,
      encoding: 'utf8',
    });

    expect(
      result.status,
      `embed-kill-script.mjs --check 失败：\n${result.stdout}\n${result.stderr}\n`
      + '修复方式：改完 kill-app-tree.ps1 后运行 node embed-kill-script.mjs --out _block.txt，'
      + '再把新的代码块填回 hooks.nsh 的 AlphaTerminateAppProcesses 函数。',
    ).toBe(0);
  });

  it('脚本正文保持纯 ASCII —— PowerShell 5.1 按 ANSI 代码页读无 BOM 的 .ps1', () => {
    const source = fs.readFileSync(PS1_PATH, 'utf8');

    expect(
      source,
      'kill-app-tree.ps1 出现了非 ASCII 字符。脚本被原样解包到 $PLUGINSDIR 后，'
      + 'PowerShell 5.1 读无 BOM 的 .ps1 会按系统 ANSI 代码页解码，中文注释会变成乱码。'
      + '中文说明请写在 hooks.nsh 里。',
    ).toMatch(/^[\x00-\x7F]*$/);
  });

  it('PREINSTALL 与 PREUNINSTALL 各有一个调用点，且卸载段用 un. 前缀', () => {
    const hooks = fs.readFileSync(path.join(INSTALLER_DIR, 'hooks.nsh'), 'utf8');

    // NSIS 规定「从 Uninstall 段调用的函数名必须以 un. 开头」，
    // 所以两个 hook 调的是两个不同名的薄封装，函数体共用一个 !macro。
    const plain = hooks.match(/^\s*Call AlphaTerminateAppProcesses$/gm) ?? [];
    const uninstall = hooks.match(/^\s*Call un\.AlphaTerminateAppProcesses$/gm) ?? [];

    // 各一个。少于两个说明又漏改了一个 hook
    // （本项目踩过：只改 PREINSTALL，结果 launcher / 卸载路径把新键删回去）。
    expect(plain.length).toBe(1);
    expect(uninstall.length).toBe(1);

    // 内嵌脚本必须只有一份 —— 两份就意味着可能漂移。
    expect(hooks.match(/BEGIN EMBEDDED kill-app-tree\.ps1/g)?.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 下面这一组守的是 2026-10-13 真机安装事故。
//
// 上一组四条断言在那个 bug 存在时**全部是绿的**：脚本文本同步、纯 ASCII、无反斜杠、
// 两个 hook 都调用了。而安装照样跑完、照样打印「部署成功」，用户机器上留着的却是
// 0.5.8，新二进制被 Delete 掉了。原因全在「文本之外」——参数怎么传、nsExec 怎么
// 执行命令、成功判据问的是什么问题。这几条就是给那三处加的锁。
// ---------------------------------------------------------------------------
describe('安装期执行语义的守卫（2026-10-13 事故）', () => {
  it('nsExec 调用不得再传 -SelfPid —— NSIS 的 $0 在此处不是安装器 PID', () => {
    const hooks = fs.readFileSync(path.join(INSTALLER_DIR, 'hooks.nsh'), 'utf8');
    const call = hooks.match(/^\s*nsExec::ExecToLog .*kill-app-tree\.ps1.*$/m)?.[0] ?? '';

    expect(
      call,
      '不要再用 `-SelfPid $0`：Tauri 模板在 installer.nsi:196 用 `StrCpy $0 0` 把 $0 '
      + '初始化为 wix_detect 的 EnumRegKey 循环下标，到 PREINSTALL 时它装的是「本机装了'
      + '多少个程序」，与安装器自身 PID 无关。实测后果：Alpha 与 sidecar 都没被杀掉，'
      + '安装照常完成。脚本应自行取父进程 PID（nsExec 直接 spawn powershell.exe，'
      + '其父进程即安装器）。',
    ).not.toContain('-SelfPid');
  });

  it('SelfPid 必须是可选参数且默认 0，不能是 Mandatory', () => {
    const source = fs.readFileSync(PS1_PATH, 'utf8');

    expect(
      source,
      'SelfPid 恢复成 Mandatory 之后，安装器一旦漏传（它现在**有意不传**），'
      + '脚本会在动手之前就因参数绑定失败退出，表现为「什么都没杀」。',
    ).not.toMatch(/\[Parameter\(Mandatory\s*=\s*\$true\)\]\s*\r?\n\s*\[int\]\$SelfPid/);

    expect(source).toMatch(/\[int\]\$SelfPid\s*=\s*0/);
  });

  it('nsExec 的命令行里不得出现 shell 重定向 —— 它不经过 cmd.exe', () => {
    const hooks = fs.readFileSync(path.join(INSTALLER_DIR, 'hooks.nsh'), 'utf8');
    const offenders = [...hooks.matchAll(/^\s*nsExec::ExecToLog '([^']*)'/gm)]
      .map((m) => m[1])
      .filter((cmd) => /[12]>[^>]|>&/.test(cmd));

    expect(
      offenders,
      'nsExec 直接走 CreateProcess，中间没有 cmd.exe，`2>nul` 会被当成一个字面参数\n'
      + `递给目标程序。真机报错原文：\n`
      + '    错误: 无效参数/选项 "-2>null。\n'
      + '    键入 "SCHTASKS /CHANGE /?" 以了解用法。\n'
      + '真要重定向就显式写成 cmd.exe /d /c "..."，否则删掉。\n'
      + `命中的行：\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('禁用计划任务改用 Disable-ScheduledTask —— 原来的 schtasks 重定向是坏的', () => {
    const hooks = fs.readFileSync(path.join(INSTALLER_DIR, 'hooks.nsh'), 'utf8');

    expect(
      hooks,
      'PREINSTALL 必须真的把 \\KizemoFocusSync 禁掉，否则它会在 sidecar 被杀后'
      + '按 -RestartCount 3 / -RestartInterval 1min 把它拉起来，重新锁住二进制。',
    ).toMatch(/Disable-ScheduledTask\s+-TaskName\s+''KizemoFocusSync''/);
  });

  it('sidecar 部署必须先删旧文件 —— FileExists 只问「有没有」，不问「拷贝成了吗」', () => {
    const hooks = fs.readFileSync(path.join(INSTALLER_DIR, 'hooks.nsh'), 'utf8');
    const deleteAt = hooks.indexOf('Delete "$RESOLVEDAPPDATA\\com.sigma-file-manager.app');
    const copyAt = hooks.indexOf('CopyFiles "$INSTDIR\\tools\\focus-sync-sidecar.exe"');

    expect(
      deleteAt,
      '部署 sidecar 之前必须 Delete 目标位置并确认删掉了。旧代码先 CopyFiles 再用 '
      + '${FileExists} 判成功，而目标位置上的上一版二进制本来就在，拷贝又因 sidecar '
      + '占着文件而失败时，FileExists 照样返回 true —— 一次完美的假成功，'
      + '新二进制随后被 Stage 9 结尾的 Delete 删掉，用户永远停留在旧版本。',
    ).toBeGreaterThan(-1);

    expect(
      copyAt,
      '没有找到部署 sidecar 的 CopyFiles 语句。',
    ).toBeGreaterThan(deleteAt);
  });
});

// ---------------------------------------------------------------------------
// 下面两条守的是「Alpha 每次安装都活着」这个症状的**真正**根因。
//
// 前面几轮修的是真问题（-SelfPid 传错、重定向、假成功门），但都没碰到这一层：
// 2026-10-13 真机 A/B 证明脚本**从来没有被正确写到磁盘**，于是 nsExec 的
// -File 指向一个不存在或不可执行的目标，Alpha 与 sidecar 每次都活下来。
//
// 这两条断言在 bug 存在时是绿的：文本同步检查通过、ASCII 检查通过、
// 两个 hook 都调用了、单测全绿。真要抓它，只能断言「用什么指令落盘」。
// ---------------------------------------------------------------------------
describe('kill 脚本的落盘方式（2026-10-13 真机 A/B 定案）', () => {
  const HOOKS = path.join(INSTALLER_DIR, 'hooks.nsh');

  it('内嵌块必须用 File 指令，不得回退到 FileWrite 逐行拼装', () => {
    const hooks = fs.readFileSync(HOOKS, 'utf8');
    const block = hooks.slice(
      hooks.indexOf('BEGIN EMBEDDED kill-app-tree.ps1'),
      hooks.indexOf('END EMBEDDED kill-app-tree.ps1'),
    );

    expect(
      /^\s*FileWrite\b/m.test(block),
      '内嵌块里又出现了 FileWrite 指令。NSIS 的 FileWrite 字符串**不做任何转义展开**：\n'
      + '  "A`r`nB" / "A\\nB" / "A${NL}B" / "A$1B" 落盘后全是字面量，\n'
      + '整个文件 0 个 CR、0 个 LF。于是 269 行脚本塌成物理上的 1 行，\n'
      + '<# 到 #> 的块注释在同一行闭合，PowerShell 什么都不执行，退出码却是 0、\n'
      + 'stdout 为空、日志文件也不生成 —— 与「脚本根本没跑」在 exit code 上无法区分。\n'
      + '正确做法是 File：编译期内嵌 + 运行期原样解包，字节精确。',
    ).toBe(false);

    expect(
      /File\s+\/oname=\$PLUGINSDIR\\kill-app-tree\.ps1\s+"\$\{__FILEDIR__\}\\kill-app-tree\.ps1"/.test(block),
      '内嵌块里的 File 指令形态不对。必须从 ${__FILEDIR__}（本 .nsh 所在目录）取源文件，'
      + '并解包到 $PLUGINSDIR\\kill-app-tree.ps1 —— 反斜杠是必须的：NSIS 的 FileOpen '
      + '无法用含正斜杠的路径**创建**文件（IfFileExists 却认正斜杠，所以「写完再查」'
      + '会误判成没写成功）。',
    ).toBe(true);
  });

  it('nsExec 调用 kill 脚本时 -File 参数必须用反斜杠拼接', () => {
    const hooks = fs.readFileSync(HOOKS, 'utf8');
    const call = hooks.match(/^\s*nsExec::ExecToLog .*kill-app-tree\.ps1.*$/m)?.[0] ?? '';

    expect(call).not.toBe('');
    expect(
      call,
      `-File 的路径用了正斜杠拼接：${call}\n`
      + 'NSIS 的文件函数对正斜杠路径的处理与 File 指令不一致，别在这里混用。',
    ).toMatch(/-File\s+"\$PLUGINSDIR\\kill-app-tree\.ps1"/);
  });
});
