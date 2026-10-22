// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-22：**批量删除进度语义的「接线层」契约门禁**。
//
// ## 这道门禁为什么存在
//
// 2026-10-22 收到一份批量删除分析报告，症状是「进度条卡在 4% 长达 40 分钟」。
// 复核代码后发现报告的归因（进度按字节计量）**与实现不符**：本仓的删除进度
// 一直按**顶层路径数**推进，字节数从来没进过进度公式。症状一样，根因不同。
//
// 真缺陷有三处，都不在单测能覆盖的地方：
//
// 1. **跨语言契约**。Rust 的 `DeleteJobProgressPayload` 与 TS 的同名接口是
//    **两份独立的字符串**。字段名写错一个字母，两边单测照样全绿，真机上
//    进度条就成了「0% 到底」。
// 2. **口径本身**。进度必须按**条目数**推进、必须有**节流**、取消必须
//    在**每个文件之前**被检查 —— 这三条都是「写在代码里但很容易被改回去」的
//    性质，需要门禁钉住。
// 3. **规模预告**。删除前要能问出「要删掉多少」，后端命令与前端调用名
//    也得对得上。
//
// 源码一变测试立刻红，不需要跑 Rust、不需要起应用。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// 本文件在 `src/utils/__tests__/` 下，往上三层才是仓库根。
const REPO_ROOT = join(__dirname, '..', '..', '..');

const DELETE_JOB_RS = join(REPO_ROOT, 'src-tauri', 'src', 'delete_job.rs');
const DELETE_TREE_RS = join(REPO_ROOT, 'src-tauri', 'src', 'delete_tree.rs');
const LIB_RS = join(REPO_ROOT, 'src-tauri', 'src', 'lib.rs');
const DELETE_JOBS_TS = join(REPO_ROOT, 'src', 'stores', 'runtime', 'delete-jobs.ts');
const STATUS_CENTER_TS = join(REPO_ROOT, 'src', 'stores', 'runtime', 'status-center.ts');
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

/** 取 Rust 结构体里的字段名。 */
function rustStructFields(source: string, structName: string): string[] {
  const structMatch = new RegExp(`pub struct ${structName} \\{([^}]*)\\}`).exec(source);

  expect(structMatch, `应当能找到结构体 ${structName}`).not.toBeNull();

  return (structMatch?.[1] ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('pub '))
    .map(line => line.replace(/^pub\s+/, '').split(':')[0].trim())
    .filter(name => name.length > 0);
}

/** 取 TS interface 里的字段名。 */
function tsInterfaceFields(source: string, interfaceName: string): string[] {
  const interfaceMatch = new RegExp(`interface ${interfaceName} \\{([^}]*)\\}`).exec(source);

  expect(interfaceMatch, `应当能找到接口 ${interfaceName}`).not.toBeNull();

  return (interfaceMatch?.[1] ?? '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('//') && !line.startsWith('*'))
    .map(line => line.split('?')[0].split(':')[0].trim())
    .filter(name => name.length > 0);
}

describe('批量删除进度的跨语言契约', () => {
  it('进度事件的字段在 Rust 与 TS 两侧逐条对得上', () => {
    const rust = read(DELETE_JOB_RS);
    const ts = read(DELETE_JOBS_TS);

    const rustFields = rustStructFields(rust, 'DeleteJobProgressPayload')
      .map(toCamelCase);
    const tsFields = tsInterfaceFields(ts, 'DeleteJobProgressPayload');

    for (const field of rustFields) {
      expect(tsFields, `TS 侧缺少进度字段 ${field}`).toContain(field);
    }
  });

  it('结束事件的字段在 Rust 与 TS 两侧逐条对得上', () => {
    const rust = read(DELETE_JOB_RS);
    const ts = read(DELETE_JOBS_TS);

    const rustFields = rustStructFields(rust, 'DeleteJobFinishedPayload')
      .map(toCamelCase);
    const tsFields = tsInterfaceFields(ts, 'DeleteJobFinishedPayload');

    for (const field of rustFields) {
      expect(tsFields, `TS 侧缺少结束字段 ${field}`).toContain(field);
    }
  });

  it('进度事件名两侧一致', () => {
    const rust = read(DELETE_JOB_RS);
    const ts = read(DELETE_JOBS_TS);

    expect(rust).toContain('"delete-job-progress"');
    expect(ts).toContain('\'delete-job-progress\'');
    expect(rust).toContain('"delete-job-finished"');
    expect(ts).toContain('\'delete-job-finished\'');
  });

  it('进度按条目数计量，字节数只作辅助', () => {
    const rust = read(DELETE_JOB_RS);
    const tree = read(DELETE_TREE_RS);

    // 主指标是条目数。
    expect(tree).toContain('pub deleted_items: u64');
    expect(tree).toContain('pub fn item_percent(&self) -> Option<u32>');
    expect(rust).toContain('pub deleted_items: u64');

    // 字节数是辅助指标，两个口径都在事件里。
    expect(tree).toContain('pub freed_bytes: u64');
    expect(tree).toContain('pub fn byte_percent(&self) -> Option<u32>');
  });

  it('进度事件有节流：100ms 或 500 条目', () => {
    const tree = read(DELETE_TREE_RS);

    expect(tree).toContain('pub const PROGRESS_INTERVAL: Duration = Duration::from_millis(100);');
    expect(tree).toContain('pub const PROGRESS_ITEM_INTERVAL: u64 = 500;');
    // 闸门是「取先到者」，不是「两个都要满足」。
    expect(tree).toContain('item_gate || time_gate');
  });

  it('取消标志在逐文件删除之前被检查', () => {
    const tree = read(DELETE_TREE_RS);

    // 扫描、文件循环、目录循环三处都要检查取消。
    const cancelChecks = tree.match(/cancel\.load\(Ordering::Relaxed\)/g) ?? [];

    expect(cancelChecks.length).toBeGreaterThanOrEqual(3);
  });

  it('界面报的是真实条目数，不是顶层路径数', () => {
    const ts = read(DELETE_JOBS_TS);

    expect(ts).toContain('payload.deletedItems ?? payload.deletedPaths.length');
  });

  it('状态中心存下了条目与字节两个口径', () => {
    const ts = read(STATUS_CENTER_TS);

    expect(ts).toContain('deletedItems?: number;');
    expect(ts).toContain('freedBytes?: number;');
    expect(ts).toContain('totalBytes?: number;');
    expect(ts).toContain('itemPercent?: number;');
    expect(ts).toContain('bytePercent?: number;');
  });

  it('删除前的规模统计命令两侧接得上', () => {
    const rust = read(DELETE_JOB_RS);
    const lib = read(LIB_RS);
    const ts = read(FILE_BROWSER_SELECTION_TS);

    expect(rust).toContain('pub fn scan_delete_targets');
    expect(lib).toContain('delete_job::scan_delete_targets');
    expect(ts).toContain('invoke(\'scan_delete_targets\'');
  });
});
