// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-23：**语言包文件格式的门禁**。
//
// ## 这道门禁为什么存在
//
// 本仓有 17 个语言包。它们是**被脚本批量改写**的：
// `scripts/sync-i18n.js` 负责补齐缺失的 key、删掉多余的 key，然后重写整个文件。
//
// 脚本写得再对，**格式约定本身没人守**。一旦某次改动（或某次手改、
// 或某个编辑器）让某个语言包：
//
// - 少了末尾换行 → 之后每个 diff 都显示「\ No newline at end of file」；
// - 多了末尾换行 → 某些工具会把它当坏文件；
// - 混进了 CRLF → 与仓库的 `end_of_line = lf` 约定冲突，
//   而且会让「文件是否相同」的比较在 Windows / Linux 上给出不同结果。
//
// 这些问题**都不会让任何功能测试变红**，只会在某次无关的改动里冒出来，
// 变成难查的 git 噪音。所以在这里钉一道纯格式门禁。
//
// 移植自 upstream 的 `a4d4f4f1`（"Dev: keep locale JSON files ending with a newline"）。

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const localeDirectoryPath = path.resolve('src/localization/messages');

describe('locale json format', () => {
  const localeFileNames = fs
    .readdirSync(localeDirectoryPath)
    .filter(fileName => fileName.endsWith('.json'));

  it('has locale files to check', () => {
    expect(localeFileNames.length).toBeGreaterThan(0);
  });

  it('uses lf line endings and exactly one trailing newline', () => {
    for (const fileName of localeFileNames) {
      const fileContent = fs.readFileSync(path.join(localeDirectoryPath, fileName), 'utf8');

      expect(fileContent.includes('\r'), `${fileName} must not contain CR`).toBe(false);
      expect(fileContent.endsWith('\n'), `${fileName} must end with a newline`).toBe(true);
      expect(fileContent.endsWith('\n\n'), `${fileName} must end with exactly one newline`).toBe(false);
    }
  });

  it('uses two-space indentation', () => {
    for (const fileName of localeFileNames) {
      const fileContent = fs.readFileSync(path.join(localeDirectoryPath, fileName), 'utf8');
      const parsed = JSON.parse(fileContent);
      const expected = `${JSON.stringify(parsed, null, 2)}\n`;

      expect(fileContent, `${fileName} must use 2-space indentation`).toBe(expected);
    }
  });
});
