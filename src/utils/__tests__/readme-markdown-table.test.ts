// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-24：**README 表格的列数一致性门禁**。
//
// ## 这道门禁为什么存在
//
// 2026-10-24 重写双��� README 后，GitHub 上「Alpha File Manager vs Sigma File Manager
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
// ⇒ 把它变成机器门禁：解析两个 README 里的每一张表，列数不一致就红。
//
// **门禁自身也要能红** —— 下面第一批用例就是故意喂坏的表格，
// 一旦解析器退化成「永远返回空」，这道门禁就废了。

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
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

/** 找出所有列数不一致的表格。 */
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
        reason: `分隔行有 ${delimiterColumns} 列，表头有 ${headerColumns} 列`,
      });
    }

    let cursor = index + 2;

    while (cursor < lines.length && lines[cursor].includes('|') && lines[cursor].trim() !== '') {
      const columns = splitTableRow(lines[cursor]).length;

      if (columns !== headerColumns) {
        broken.push({
          headerLine: cursor + 1,
          reason: `第 ${cursor + 1} 行有 ${columns} 列，表头有 ${headerColumns} 列`,
        });
      }

      cursor += 1;
    }

    index = cursor;
  }

  return broken;
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

  it('能查出「数据行少一列」的表格', () => {
    const markdown = ['| a | b | c |', '|---|---|---|', '| 1 | 2 |'].join('\n');

    const broken = findBrokenTables(markdown);
    expect(broken).toHaveLength(1);
    expect(broken[0].headerLine).toBe(3);
  });

  it('列数一致时不报问题', () => {
    const markdown = ['| a | b | c |', '|---|---|---|', '| 1 | 2 | 3 |', '| 4 | 5 | 6 |'].join('\n');

    expect(findBrokenTables(markdown)).toEqual([]);
  });
});

describe('README 表格', () => {
  const readmes = ['README.md', 'README.zh-CN.md'];

  for (const name of readmes) {
    it(`${name} 里每张表的列数都一致（否则 GitHub 不会渲染成表格）`, () => {
      const markdown = readFileSync(join(REPO_ROOT, name), 'utf8');
      const broken = findBrokenTables(markdown);

      expect(broken).toEqual([]);
    });
  }
});
