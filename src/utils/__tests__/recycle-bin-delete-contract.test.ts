// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：**回收站删除的「接线层」契约门禁**。
//
// ## 这道门禁为什么存在
//
// `planDeleteJobs` 本身有单测（`recycle-bin-delete.test.ts`），
// Rust 侧也有单测（`utils.rs` 的 `recycle_bin_tests`）。
// 但这两边都验不到三件事：
//
// 1. **跨语言契约**。前端 `invoke('recycle_bin_unavailable_paths', { paths })`
//    与 Rust `pub fn recycle_bin_unavailable_paths(paths: Vec<String>)`
//    是**两份独立的字符串**。Tauri v2 按 Rust 参数名的 camelCase 形式匹配 JS 的键，
//    写错一个字母，两边单测**照样全绿**，真机上才炸成 `unknown field`。
//    （同一个坑本仓已经踩过一次，见扩展权限契约测试的注释。）
//
// 2. **两个删除入口都接上了吗**。本地删除有两个入口：
//    `use-dir-entry-actions.ts`（首页）与 `use-file-browser-selection.ts`（文件浏览器）。
//    只改一个，另一个就会**静默地**退回「回收站失败 = 永久删除」的旧行为 ——
//    而这条旧行为的后果是**用户以为进了回收站，文件其实没了**。
//
// 3. **后端真的挡住了吗**。前端只是「先问后做」，
//    真正兜底的是后端的 `delete_path_to_trash` —— 它在路径不能进回收站时
//    直接报错，**绝不**退回永久删除。少了这一步，前端的确认框就成了唯一防线。
//
// 源码一变测试立刻红，不需要跑 Rust、不需要起应用。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 本文件在 `src/utils/__tests__/` 下，往上三层才是仓库根。
const REPO_ROOT = join(__dirname, '..', '..', '..');

const DELETE_JOB_RS = join(REPO_ROOT, 'src-tauri', 'src', 'delete_job.rs');
const FILE_OPERATIONS_RS = join(REPO_ROOT, 'src-tauri', 'src', 'file_operations.rs');
const LIB_RS = join(REPO_ROOT, 'src-tauri', 'src', 'lib.rs');
const RECYCLE_BIN_DELETE_TS = join(REPO_ROOT, 'src', 'utils', 'recycle-bin-delete.ts');
const DIR_ENTRY_ACTIONS_TS = join(REPO_ROOT, 'src', 'composables', 'use-dir-entry-actions.ts');
const FILE_BROWSER_SELECTION_TS = join(
  REPO_ROOT,
  'src',
  'modules',
  'navigator',
  'components',
  'file-browser',
  'composables',
  'use-file-browser-selection.ts',
);

function read(filePath: string): string {
  return readFileSync(filePath, 'utf8');
}

/** Rust 的 snake_case 参数名 → Tauri v2 期望的 JS 键（camelCase）。 */
function toCamelCase(name: string): string {
  return name.replace(/_([a-z0-9])/g, (_match, character: string) => character.toUpperCase());
}

describe('回收站删除的跨语言契约', () => {
  it('前端 invoke 的命令名与 Rust 命令名一致', () => {
    const rust = read(DELETE_JOB_RS);
    const ts = read(RECYCLE_BIN_DELETE_TS);

    expect(rust).toContain('pub fn recycle_bin_unavailable_paths');
    expect(ts).toContain('invoke<string[]>(\'recycle_bin_unavailable_paths\'');
  });

  it('前端 invoke 传的键与 Rust 参数名逐条对得上', () => {
    const rust = read(DELETE_JOB_RS);
    const ts = read(RECYCLE_BIN_DELETE_TS);

    // Rust 侧的参数名。
    const signature = /pub fn recycle_bin_unavailable_paths\s*\(([^)]*)\)/.exec(rust);
    expect(signature).not.toBeNull();

    const rustParams = (signature?.[1] ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => /^(\w+)\s*:\s*/.exec(part)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(rustParams.length).toBeGreaterThan(0);

    // 前端侧实际传出去的键。
    const invokeCall = /invoke<[^>]*>\(\s*'recycle_bin_unavailable_paths'\s*,\s*\{([^}]*)\}/.exec(ts);
    expect(invokeCall).not.toBeNull();

    // 前端侧实际传出去的键。`{ paths }` 是简写，`{ paths: value }` 是完整写法，
    // 两种都要认 —— 所以只取每段开头的标识符，不要求后面有冒号。
    const jsKeys = (invokeCall?.[1] ?? '')
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => /^(\w+)/.exec(part)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(jsKeys.length).toBeGreaterThan(0);

    // Tauri v2 按 Rust 参数名的 camelCase 形式匹配 JS 的键。
    const expectedJsKeys = rustParams.map(toCamelCase);
    expect(jsKeys).toEqual(expectedJsKeys);
  });

  it('命令在 Tauri 的 invoke_handler 里注册了', () => {
    expect(read(LIB_RS)).toContain('delete_job::recycle_bin_unavailable_paths');
  });

  it('后端删除路径走的是 delete_path_to_trash，不是裸 trash::delete', () => {
    // 少了这道闸，前端的确认框就成了唯一防线 ——
    // 而上游 0ae258d6 之前的实现正是「trash 失败就当永久删除」。
    expect(read(DELETE_JOB_RS)).toContain('delete_path_to_trash(path, &normalized)');
    expect(read(DELETE_JOB_RS)).not.toContain('trash::delete(');

    expect(read(FILE_OPERATIONS_RS)).toContain('delete_path_to_trash(path, path_str)');
    expect(read(FILE_OPERATIONS_RS)).not.toContain('trash::delete(');
  });
});

describe('两个本地删除入口都接上了 planDeleteJobs', () => {
  const entryPoints: Array<[string, string]> = [
    ['use-dir-entry-actions.ts', DIR_ENTRY_ACTIONS_TS],
    ['use-file-browser-selection.ts', FILE_BROWSER_SELECTION_TS],
  ];

  for (const [label, filePath] of entryPoints) {
    it(`${label} 会先规划作业再逐个执行`, () => {
      const source = read(filePath);

      // 1. 引入了规划器。
      expect(source).toContain('from \'@/utils/recycle-bin-delete\'');
      expect(source).toContain('planDeleteJobs({');

      // 2. 规划结果为空时直接放弃（用户取消确认）。
      expect(source).toMatch(/if \(!jobs\) \{\s*return false;/);

      // 3. **逐个**执行作业，而不是把整批路径塞进一个作业 ——
      //    只有分作业，才能让「能进回收站的」和「要永久删除的」走不同的 useTrash。
      expect(source).toMatch(/for \(const job of jobs\)/);
      expect(source).toContain('deleteJobsStore.startJob(job.paths, job.useTrash');

      // 4. 旧的「不回收就直接永久删除」路径不能再出现。
      expect(source).not.toMatch(/if \(!useTrash\) \{\s*const confirmed = await permanentDeleteConfirm/);
    });
  }
});
