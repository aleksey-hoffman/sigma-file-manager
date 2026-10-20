// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：**跨语言契约门禁**。
//
// ## 这道门禁为什么存在
//
// Tauri v2 的 command 参数按「**Rust 参数名的 camelCase 形式**」匹配 JS 传进来的键：
//
// ```
// Rust `remote_path`  ->  JS `remotePath`   ✅
// Rust `path`          ->  JS `path`         ✅
// Rust `path`          ->  JS `remotePath`   ❌ 换算成 remote_path，对不上
// ```
//
// **两边单测全绿也测不出这个问题**：前端单测 mock 掉了 `invoke`，
// Rust 单测根本不经过 Tauri 的参数绑定。只有真机上会炸成
// `unknown field remote_path` —— 而真机验收一次要几十分钟。
//
// 所以这里**直接读 Rust 源码**把参数名抠出来，与前端实际传出去的键逐条比对。
// 源码一变测试立刻红，**不需要跑 Rust、不需要起应用**。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 本文件在 `src/modules/remote/utils/__tests__/` 下，往上五层才是仓库根。
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const RUST_COMMANDS_FILE = join(REPO_ROOT, 'src-tauri', 'src', 'remote', 'commands.rs');

/**
 * 前端所有**生产代码**里调用远程 command 的地方。
 *
 * **只扫生产代码，不扫 `__tests__`** —— 测试里的
 * `expect(invokeMock).toHaveBeenCalledWith('remote_x', {...})`
 * 长得和真正的调用几乎一样，扫进去会得到一堆假阳性。
 */
const FRONTEND_CALL_SITES = [
  'src/stores/storage/remote-connections.ts',
  'src/utils/remote-directory.ts',
  'src/modules/remote/utils/remote-transfer.ts',
];

/** `snake_case` → `camelCase`。`path` 没有下划线，转换后仍然是 `path`。 */
function toCamelCase(snakeCase: string): string {
  return snakeCase.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

/**
 * 从 Rust 源码里抽出每个 `#[tauri::command]` 的参数名。
 *
 * 返回 `Map<命令名, Set<期望的 JS 键>>`。
 *
 * `app: tauri::AppHandle` 是 Tauri 自己注入的，**不算** JS 要传的键。
 */
function parseRustCommandParams(source: string): Map<string, Set<string>> {
  const commands = new Map<string, Set<string>>();

  const pattern = /#\[tauri::command\]\s*pub async fn (\w+)\s*\(([^)]*)\)/g;
  let match = pattern.exec(source);

  while (match !== null) {
    const commandName = match[1];
    const rawParams = match[2];

    const expectedKeys = new Set<string>();

    for (const rawParam of rawParams.split(',')) {
      const trimmed = rawParam.trim();

      if (!trimmed) {
        continue;
      }

      const [name] = trimmed.split(':').map(part => part.trim());

      if (!name || name === 'app') {
        continue;
      }

      expectedKeys.add(toCamelCase(name));
    }

    commands.set(commandName, expectedKeys);
    match = pattern.exec(source);
  }

  return commands;
}

/**
 * 从前端源码里抽出每个 `invoke(...)` 调用的命令名与载荷键。
 *
 * 返回 `Map<命令名, Set<实际传的 JS 键>>`。
 *
 * 命令名既可能是字符串字面量，也可能是本文件里定义的常量
 * （`REMOTE_READ_DIR_COMMAND`）—— 两种都要认。
 */
function parseFrontendInvokeCalls(source: string): Map<string, Set<string>> {
  const calls = new Map<string, Set<string>>();

  const pattern = /invoke(?:<[^>]*>)?\(\s*('[^']*'|[A-Za-z_][\w]*)\s*(?:,\s*\{([\s\S]*?)\})?\s*\)/g;
  let match = pattern.exec(source);

  while (match !== null) {
    const commandExpression = match[1];
    const payloadBody = match[2] ?? '';

    const literal = commandExpression.match(/^'([^']+)'$/);

    let commandName: string | null = null;

    if (literal) {
      commandName = literal[1];
    }
    else {
      const constant = source.match(
        new RegExp(`const\\s+${commandExpression}\\s*=\\s*'([^']+)'`),
      );

      commandName = constant ? constant[1] : null;
    }

    if (commandName && commandName.startsWith('remote_')) {
      const keys = new Set<string>();

      // **只看载荷对象的顶层键。** 嵌套一层（比如
      // `remote_test_connection` 的 `{ request: { protocol, host, … } }`）
      // 里的键属于**请求体结构体**的契约，不是 command 参数名的契约 ——
      // 那个由 `#[serde(rename_all = "camelCase")]` 负责。
      //
      // 用花括号深度判断「顶层」：深度为 0 时这一行才是载荷的直接键。
      let depth = 0;

      for (const rawLine of payloadBody.split('\n')) {
        const line = rawLine.trim();

        if (!line) {
          continue;
        }

        if (depth === 0) {
          // `remotePath,`（简写）、`path: remotePath,`（带值）、
          // `request: {`（嵌套对象的开头）都要认。
          const keyMatch = line.match(/^([A-Za-z_]\w*)\s*[:,]?/);

          if (keyMatch) {
            keys.add(keyMatch[1]);
          }
        }

        depth += (line.match(/\{/g) ?? []).length;
        depth -= (line.match(/\}/g) ?? []).length;
      }

      const existing = calls.get(commandName);

      if (existing) {
        for (const key of keys) {
          existing.add(key);
        }
      }
      else {
        calls.set(commandName, keys);
      }
    }

    match = pattern.exec(source);
  }

  return calls;
}

const rustSource = readFileSync(RUST_COMMANDS_FILE, 'utf8');
const rustParams = parseRustCommandParams(rustSource);

const frontendCalls = new Map<string, Set<string>>();

for (const relativePath of FRONTEND_CALL_SITES) {
  const source = readFileSync(join(REPO_ROOT, relativePath), 'utf8');
  const parsed = parseFrontendInvokeCalls(source);

  for (const [commandName, keys] of parsed) {
    const existing = frontendCalls.get(commandName);

    if (existing) {
      for (const key of keys) {
        existing.add(key);
      }
    }
    else {
      frontendCalls.set(commandName, keys);
    }
  }
}

describe('远程 command 的跨语言参数契约', () => {
  it('Rust 侧确实抽出了远程 command', () => {
    // 阳性对照：解析器本身要能工作。空 Map 说明正则失效了，
    // 后面的断言会全部变成「没有可比的」而假绿。
    expect(rustParams.size).toBeGreaterThan(10);
    expect(rustParams.has('remote_make_dir')).toBe(true);
    expect(rustParams.has('remote_rename_path')).toBe(true);
  });

  it('每一条远程 command 在前端都有调用点', () => {
    // 反向检查：只做正向比对的话，新加一条 command 而前端没接，
    // 不会有任何用例变红 —— 而它要到真机上才会报 "command not found"。
    const missing: string[] = [];

    for (const commandName of rustParams.keys()) {
      if (!frontendCalls.has(commandName)) {
        missing.push(commandName);
      }
    }

    expect(missing).toEqual([]);
  });

  it('前端传的键与 Rust 参数名的 camelCase 形式逐条一致', () => {
    const mismatches: string[] = [];

    for (const [commandName, expectedKeys] of rustParams) {
      const actualKeys = frontendCalls.get(commandName);

      if (!actualKeys) {
        continue;
      }

      for (const expected of expectedKeys) {
        if (!actualKeys.has(expected)) {
          mismatches.push(`${commandName}: 缺少 ${expected}（实际传了 ${[...actualKeys].join(', ')}）`);
        }
      }

      for (const actual of actualKeys) {
        if (!expectedKeys.has(actual)) {
          mismatches.push(`${commandName}: 多传了 ${actual}（Rust 只要 ${[...expectedKeys].join(', ')}）`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it('本轮新增的两条 command 参数名对得上', () => {
    // 把契约**显式写出来**：将来有人改了 Rust 侧的参数名，
    // 上面的通用比对会红，但这条会直接告诉他「改的是哪一条」。
    expect([...rustParams.get('remote_make_dir')!]).toEqual(['remotePath']);
    expect([...rustParams.get('remote_rename_path')!].sort()).toEqual(['fromPath', 'newName']);
  });
});
