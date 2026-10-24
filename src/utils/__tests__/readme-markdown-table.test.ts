// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-24：**Markdown 表格的列数一致性门禁**。
//
// ## 这道门禁为什么存在
//
// 2026-10-24 重写双语 README 后，GitHub 上「Alpha File Manager vs Sigma File Manager
// vs Windows Explorer」那张对比表**整块塌成了一段文字** —— 用户直接指出来了。
//
// 根因是 GFM 的表格规则：**表头行、分隔行、每一行数据行的列数必须完全一致**，
// 少写一个 `---` 整张表就退化成普通段落，而且**不会报任何错**。
// 当时那张表有 5 列（两个图标列 + 三个产品列），分隔行却只写了 4 段。
//
// 这类缺陷的特征是「**只有眼睛能发现**」：
//   - 没有任何编译期/运行期信号；
//   - 功能测试全绿（功能确实是好的，只是表格没渲染）；
//   - 只有把 README 贴到 GitHub 上才会显形。
//
// ⇒ 把它变成机器门禁：解析仓库里每一份 markdown 的每一张表，列数不一致就红。
//
// **门禁自身也要能红** —— 下面第一批用例就是故意喂坏的表格，
// 一旦解析器退化成「永远返回空」，这道门禁就废了。
//
// ## 判据严格对齐 GFM 规范（github/gfm，§4.10 Tables）
//
// 规范原文：
//
// > The header row must match the delimiter row in the number of cells.
// > If not, a table will not be recognized.
// >
// > The remainder of the table's rows may vary in the number of cells.
// > If there are a number of cells fewer than the number of cells in the
// > header row, empty cells are inserted. If there are greater, the excess
// > is ignored.
//
// 翻译成三条可执行规则：
//
// 1. **分隔行 ≠ 表头** ⇒ 整块根本不被识别成表格（退化成段落）—— **必须报**。
// 2. **数据行比表头少列** ⇒ GFM 补空单元格，渲染正常 —— **不报**。
//    （早先的门禁把它也算成缺陷，那是误报：GFM 渲染出来是完好的。）
// 3. **数据行比表头多列** ⇒ 多出来的列**被静默丢弃**（内容丢失）—— **必须报**。

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// 本文件在 `src/utils/__tests__/` 下，往上三层才是仓库根。
const REPO_ROOT = join(__dirname, '..', '..', '..');

export interface BrokenTable {
  /** 表头所在行号（1 起） */
  headerLine: number;
  /** 人类可读的问题描述 */
  reason: string;
}

/** 一行是不是 GFM 的表格分隔行（`|---|---|`）。 */
export function isTableDelimiter(line: string): boolean {
  // GFM 的 delimiter row 必须**含至少一个 `|`**；单独一行的 `---` 是水平线（hr）。
  if (!line.includes('|')) return false;
  return /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line);
}

/** 按 `|` 切一行表格，转义过的 `\|` 不算分隔符。 */
export function splitTableRow(line: string): string[] {
  let text = line.trim();
  if (text.startsWith('|')) text = text.slice(1);
  if (text.endsWith('|')) text = text.slice(0, -1);

  const cells: string[] = [];
  let current = '';

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\' && text[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }

    if (text[index] === '|') {
      cells.push(current);
      current = '';
      continue;
    }

    current += text[index];
  }

  cells.push(current);
  return cells;
}

/**
 * 找出所有会真正坏掉的表格。
 *
 * 判据严格照 GFM 规范（见文件头注释）：
 * - 分隔行与表头列数不符 ⇒ 整块不会被识别成表格；
 * - 数据行比表头多列 ⇒ 多出来的内容被静默丢弃；
 * - 数据行比表头少列 ⇒ GFM 补空单元格，**不算缺陷**。
 */
export function findBrokenTables(markdown: string): BrokenTable[] {
  const lines = markdown.split(/\r?\n/);
  const broken: BrokenTable[] = [];
  let index = 0;

  while (index < lines.length) {
    const header = lines[index];
    const delimiter = lines[index + 1];
    const isTable
      = Boolean(header)
        && Boolean(delimiter)
        && header.includes('|')
        && isTableDelimiter(delimiter)
        && splitTableRow(delimiter).length >= 2;

    if (!isTable) {
      index += 1;
      continue;
    }

    const headerColumns = splitTableRow(header).length;
    const delimiterColumns = splitTableRow(delimiter).length;

    if (delimiterColumns !== headerColumns) {
      broken.push({
        headerLine: index + 1,
        reason: `分隔行有 ${delimiterColumns} 列，表头有 ${headerColumns} 列（GFM 不会把这块识别成表格）`,
      });
    }

    let cursor = index + 2;

    while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim() !== '') {
      const columns = splitTableRow(lines[cursor]).length;

      if (columns > headerColumns) {
        broken.push({
          headerLine: cursor + 1,
          reason: `第 ${cursor + 1} 行有 ${columns} 列，表头有 ${headerColumns} 列，多出来的列会被 GFM 丢弃`,
        });
      }

      cursor += 1;
    }

    index = cursor;
  }

  return broken;
}

/** 扫描时跳过的目录名（构建产物、缓存、本地脚本目录等）。 */
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'target',
  'dist',
  'release',
  '_acceptance',
  'graphify-out',
  '.superpowers',
]);

/** 递归收集目录下所有 markdown 文件（跳过构建产物与缓存目录）。 */
function collectMarkdownFiles(dir: string, files: string[]): void {
  let entries: ReturnType<typeof readdirSync>;

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  }
  catch {
    return;
  }

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      collectMarkdownFiles(join(dir, entry.name), files);
      continue;
    }

    if (entry.name.toLowerCase().endsWith('.md')) {
      files.push(join(dir, entry.name));
    }
  }
}

/** 递归列出目录下所有 markdown 文件（跳过构建产物与缓存目录）。 */
export function listMarkdownFiles(root: string): string[] {
  const files: string[] = [];
  collectMarkdownFiles(root, files);
  return files.sort();
}

describe('markdown 表格解析器', () => {
  it('把表头行按列切开', () => {
    expect(splitTableRow('| a | b | c |')).toEqual([' a ', ' b ', ' c ']);
  });

  it('识别表格分隔行，且不把普通文字误判成分隔行', () => {
    expect(isTableDelimiter('|---|---|')).toBe(true);
    expect(isTableDelimiter('| :--- | ---: |')).toBe(true);
    expect(isTableDelimiter('| a | b |')).toBe(false);
    expect(isTableDelimiter('---')).toBe(false);
  });

  it('转义过的 \\| 不算列分隔符', () => {
    expect(splitTableRow('| a \\| b | c |')).toEqual([' a | b ', ' c ']);
  });

  it('能查出「分隔行少写一段」的表格（这道门禁自身必须能红）', () => {
    const markdown = [
      '| | | Alpha | Beta | Gamma |',
      '|---|---|---|---|',
      '| a | b | c | d | e |',
    ].join('\n');

    const broken = findBrokenTables(markdown);
    expect(broken).toHaveLength(1);
    expect(broken[0].reason).toMatch(/分隔行有 4 列/);
  });

  it('能查出「数据行多一列」的表格（多出来的列会被 GFM 静默丢弃）', () => {
    const markdown = ['| a | b | c |', '|---|---|---|', '| 1 | 2 | 3 | 4 |'].join('\n');

    const broken = findBrokenTables(markdown);
    expect(broken).toHaveLength(1);
    expect(broken[0].headerLine).toBe(3);
    expect(broken[0].reason).toMatch(/多出来的列会被 GFM 丢弃/);
  });

  it('「数据行少一列」不算缺陷（GFM 会补空单元格）', () => {
    const markdown = ['| a | b | c |', '|---|---|---|', '| 1 | 2 |'].join('\n');

    expect(findBrokenTables(markdown)).toEqual([]);
  });

  it('列数一致时不报问题', () => {
    const markdown = ['| a | b | c |', '|---|---|---|', '| 1 | 2 | 3 |', '| 4 | 5 | 6 |'].join('\n');

    expect(findBrokenTables(markdown)).toEqual([]);
  });
});

describe('仓库里的 markdown 表格', () => {
  const readmes = ['README.md', 'README.zh-CN.md'];

  for (const name of readmes) {
    it(`${name} 里每张表的列数都一致（否则 GitHub 不会渲染成表格）`, () => {
      const markdown = readFileSync(join(REPO_ROOT, name), 'utf8');
      const broken = findBrokenTables(markdown);

      expect(broken).toEqual([]);
    });
  }

  const docFiles = listMarkdownFiles(join(REPO_ROOT, 'docs'));

  it('docs/ 目录确实扫到了 markdown 文件（否则下面那道门禁就是空转）', () => {
    expect(docFiles.length).toBeGreaterThan(0);
  });

  for (const file of docFiles) {
    it(`${file.replace(`${REPO_ROOT}\\`, '')} 里的表格列数一致`, () => {
      const markdown = readFileSync(file, 'utf8');
      const broken = findBrokenTables(markdown);

      expect(broken).toEqual([]);
    });
  }
});
