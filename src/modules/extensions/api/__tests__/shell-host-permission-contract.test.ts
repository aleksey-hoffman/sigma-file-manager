// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20:**扩展特权的「接线层」契约门禁**。
//
// ## 这道门禁为什么存在
//
// 权限判定本身有 Rust 单测（`require_extension_permission_in_dir`），前端也有单测
// （`create-shell-api.test.ts` 断言没有 `shell` 权限时**前端**就拒绝）。
//
// 但这两边都验不到一件事：**主机侧那道门禁到底接没接到命令上**。
//
// 门禁函数写对了、命令没调用它 —— 两边单测**照样全绿**，真机上却毫无保护。
// 这正是「纯函数测试全绿 + 运行时静默失效」的典型形态：每个零件都被单独测过，
// 拼起来才是坏的。
//
// 所以这里**直接读源码**把接线关系抠出来断言：
//   1. 每条特权命令的函数体里**确实**有权限判定调用；
//   2. 命令的 Rust 参数名与前端实际传的键**逐条对得上**
//      （Tauri v2 按 Rust 参数名的 camelCase 形式匹配 JS 的键）。
//
// 源码一变测试立刻红，不需要跑 Rust、不需要起应用。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 本文件在 `src/modules/extensions/api/__tests__/` 下，往上五层才是仓库根。
const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');

const PROCESSES_RS = join(REPO_ROOT, 'src-tauri', 'src', 'extensions', 'processes.rs');
const COMMANDS_RS = join(REPO_ROOT, 'src-tauri', 'src', 'extensions', 'commands.rs');
const MANIFEST_PERMISSIONS_RS = join(REPO_ROOT, 'src-tauri', 'src', 'extensions', 'manifest_permissions.rs');
const SHELL_API_TS = join(REPO_ROOT, 'src', 'modules', 'extensions', 'api', 'create-shell-api.ts');

function readRust(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

/**
 * 从 Rust 源码里截出某个函数（含函数体）的文本。
 *
 * 用「签名之后的一段窗口」而不是括号配对 —— Rust 的泛型、生命周期和字符串里
 * 的括号会让配对解析不可靠，而这里的断言只需要看到函数体的开头若干行。
 */
function extractFunction(source: string, signatureNeedle: string, window = 1200): string {
  const index = source.indexOf(signatureNeedle);

  if (index === -1) {
    throw new Error(`signature not found in source: ${signatureNeedle}`);
  }

  return source.slice(index, index + window);
}

/**
 * 从 `#[tauri::command]` 函数签名里抽出 Rust 参数名。
 *
 * `app_handle: tauri::AppHandle` 是 Tauri 自己注入的，不算 JS 要传的键。
 */
function parseRustCommandParams(source: string, commandName: string): string[] {
  const block = extractFunction(source, `pub async fn ${commandName}`, 600);
  const signatureEnd = block.indexOf(')');
  const signature = block.slice(0, signatureEnd);
  const params: string[] = [];

  for (const rawParam of signature.split(',')) {
    const trimmed = rawParam.trim();

    if (!trimmed || trimmed.startsWith('app_handle')) {
      continue;
    }

    const nameMatch = /^(\w+)\s*:\s*/.exec(trimmed);

    if (!nameMatch) {
      continue;
    }

    params.push(nameMatch[1]);
  }

  return params;
}

/** `snake_case` → `camelCase`。 */
function toCamelCase(snakeCase: string): string {
  return snakeCase.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

describe('extension privileged commands are gated host-side', () => {
  it('run_extension_command checks the on-disk manifest for the shell permission', () => {
    const source = readRust(PROCESSES_RS);
    const block = extractFunction(source, 'pub async fn run_extension_command');

    expect(block).toContain('require_extension_permission(&app_handle, &extension_id, "shell")');
    // 调用者身份也必须校验：光有权限、身份随便冒充一样不行。
    expect(block).toContain('authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)');
  });

  it('start_extension_command checks the on-disk manifest for the shell permission', () => {
    const source = readRust(PROCESSES_RS);
    const block = extractFunction(source, 'pub async fn start_extension_command');

    expect(block).toContain('require_extension_permission(&app_handle, &extension_id, "shell")');
    expect(block).toContain('authorize_extension_caller(caller_extension_id.as_deref(), &extension_id)');
  });

  it('rename_part_files_to_ts is gated too — it had no check at all before', () => {
    const source = readRust(COMMANDS_RS);
    const block = extractFunction(source, 'pub async fn rename_part_files_to_ts');

    expect(block).toContain('require_extension_shell_permission(');
    expect(block).toContain('caller_extension_id.as_deref()');
  });

  it('the shell gate checks BOTH the caller identity and the manifest permission', () => {
    const source = readRust(MANIFEST_PERMISSIONS_RS);
    const block = extractFunction(source, 'pub fn require_extension_shell_permission_in_dir');

    expect(block).toContain('authorize_extension_caller(caller_extension_id, extension_id)');
    expect(block).toContain('require_extension_permission_in_dir(extension_dir, extension_id, "shell")');
  });

  it('the permission decision reads the manifest from disk, not from the IPC caller', () => {
    const source = readRust(MANIFEST_PERMISSIONS_RS);
    const block = extractFunction(source, 'pub fn require_extension_permission_in_dir');

    // 权威来源是磁盘上那份 manifest —— 扩展自己改不了它。
    expect(block).toContain('extension_dir.join(EXTENSION_MANIFEST_FILE)');
    expect(block).toContain('fs::read_to_string(&manifest_path)');
    expect(block).toContain('extension_declares_permission(&manifest, permission)');
  });
});

describe('the shell API and the Rust commands agree on argument names', () => {
  it('rename_part_files_to_ts takes the extension id and the caller identity', () => {
    const params = parseRustCommandParams(readRust(COMMANDS_RS), 'rename_part_files_to_ts');

    expect(params).toContain('extension_id');
    expect(params).toContain('caller_extension_id');
    expect(params).toContain('directory');
  });

  it('the frontend sends exactly the keys the Rust command declares', () => {
    const source = readRust(COMMANDS_RS);
    const params = parseRustCommandParams(source, 'rename_part_files_to_ts');
    const expectedKeys = params.map(toCamelCase).sort();

    const shellApi = readFileSync(SHELL_API_TS, 'utf8');
    const callIndex = shellApi.indexOf('rename_part_files_to_ts');

    expect(callIndex).toBeGreaterThan(-1);

    // 截出这次调用的参数对象，取出里面出现的 `key:` 形式。
    const callBlock = shellApi.slice(callIndex, callIndex + 400);
    const sentKeys = [...callBlock.matchAll(/(\w+)\s*:/g)].map(match => match[1]);
    const uniqueSentKeys = [...new Set(sentKeys)].sort();

    // 前端还会带上 `callerExtensionId`（由 invokeAsExtension 注入），
    // 它对应 Rust 的 `caller_extension_id`，已经在参数表里了。
    expect(uniqueSentKeys.filter(key => !expectedKeys.includes(key))).toEqual([]);
  });

  it('the frontend asks for the extension id that the Rust command needs', () => {
    const shellApi = readFileSync(SHELL_API_TS, 'utf8');
    const callIndex = shellApi.indexOf('rename_part_files_to_ts');
    const callBlock = shellApi.slice(callIndex, callIndex + 400);

    expect(callBlock).toContain('extensionId: context.extensionId');
    expect(callBlock).toContain('directory,');
  });
});
