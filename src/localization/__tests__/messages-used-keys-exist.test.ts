// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 为什么需要这个门禁：
//
// `messages-key-alignment.test.ts` 只保证「各语言包之间 key 集合一致」，
// 基准是 en.json。但它**不检查代码里到底用了哪些 key**。
//
// 于是有整整一类漏法是它结构上抓不到的：
// **代码引用了一个 key，而 en.json 同样没有它** —— 17 个语言包一致地缺，
// 对齐测试全绿；构建通过；单测通过；界面直接把 key 原文显示给用户。
//
// 实例（2026-10-13 真机安装验收发现）：目录树右键菜单的「剪切」写的是
// `t('fileBrowser.actions.cut')`，而 `fileBrowser.actions` 下只有
// copy / move / paste / rename，**没有 cut**。真机上那一项显示成
// 字面量 `fileBrowser.actions.cut`。
//
// 这个测试补上缺的那一半：扫源码里的 `t('...')` 字面量，逐个问 en.json
// 「你有这个 key 吗」。缺任何一个就红，并在失败信息里点名是哪个文件引用的。
//
// 判定为什么可信（避免这道门禁自己变成摆设）：
//   1. 刻意注入了不存在的 key 验证过 —— 会被精确定位并点名文件；
//   2. 只认**静态字面量**参数。`t(\`a.${b}\`)`、`t(someVar)` 这类动态键
//      无法静态判定，强行猜会把门禁变成随机红，索性不纳入；
//   3. 要求 `missing` 为空数组，失败时 vitest 直接把键名数组打出来。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const localizationDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const messagesDirectory = path.join(localizationDirectory, 'messages');
const sourceRoot = path.join(localizationDirectory, '..');

const BASE_LOCALE = 'en';
const SCANNED_EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js']);

// 这些目录不在 src 下，但显式排除可以让「扫了整个仓库」的误解不成立。
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'target', '.git']);

// 测试目录整体排除，有两个理由：
//   1. 测试里的 stub key 不渲染给任何用户，缺不缺无关紧要；
//   2. 排除后本文件不会匹配到自己的正则与注释里的示例键（自指）。
//      保留 __tests__ 会让 `// 匹配 t('a.b')` 这种注释变成自己的失败原因。
const SKIPPED_DIRECTORY_NAMES = new Set([...SKIPPED_DIRECTORIES, '__tests__']);

type JsonObject = { [key: string]: unknown };

function readLocale(locale: string): JsonObject {
  const filePath = path.join(messagesDirectory, `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonObject;
}

/** 沿点号路径下探一层，返回该叶子 key 是否存在。 */
function hasKey(root: JsonObject, keyPath: string): boolean {
  let node: unknown = root;

  for (const part of keyPath.split('.')) {
    if (node === null || typeof node !== 'object') {
      return false;
    }
    if (!Object.prototype.hasOwnProperty.call(node, part)) {
      return false;
    }
    node = (node as JsonObject)[part];
  }

  return true;
}

function collectSourceFiles(directory: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, out);
    }
    else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(fullPath);
    }
  }

  return out;
}

// 匹配 t('a.b') / $t("a.b") / i18n.t('a.b')。
// 字符类里排除了 `$`、反引号、`{}`：动态键一律不纳入，避免误判。
const LITERAL_KEY_CALL = /\b(?:i18n\s*\.\s*)?\$?t\s*\(\s*(['"])([^'"$`{}]+)\1/g;

/** 点号路径不像命名空间的，按误匹配丢弃（例如把普通函数调用当成 t()）。 */
function looksLikeNamespacedKey(key: string): boolean {
  return key.includes('.') && !key.startsWith('.') && !key.endsWith('.');
}

describe('i18n keys referenced by code exist in the base locale', () => {
  const baseMessages = readLocale(BASE_LOCALE);
  const sourceFiles = collectSourceFiles(sourceRoot);

  // 让失败信息能直接回答「是哪个文件引用的」，而不是只给一个键名。
  const referencesByKey = new Map<string, Set<string>>();

  for (const file of sourceFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const relativePath = path.relative(sourceRoot, file);
    LITERAL_KEY_CALL.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = LITERAL_KEY_CALL.exec(text)) !== null) {
      const key = match[2];

      if (!looksLikeNamespacedKey(key) || hasKey(baseMessages, key)) {
        continue;
      }

      if (!referencesByKey.has(key)) {
        referencesByKey.set(key, new Set());
      }
      referencesByKey.get(key)?.add(relativePath);
    }
  }

  it('actually scans a non-trivial number of source files', () => {
    // 如果 collectSourceFiles 写坏了（比如路径拼错），下面那条断言会因为
    // 「扫描到 0 个文件所以没发现问题」而假绿。这条把那种情况挡掉。
    expect(sourceFiles.length).toBeGreaterThan(100);
  });

  it('finds every literal key used in code inside en.json', () => {
    const missing = [...referencesByKey.entries()]
      .map(([key, files]) => `${key}  <-  ${[...files].join(', ')}`)
      .sort();

    expect(
      missing,
      `代码引用了 ${missing.length} 个 ${BASE_LOCALE}.json 里不存在的 key。\n`
      + `界面会把 key 原文直接显示给用户，且各语言包对齐测试抓不到（它们一致地缺）。\n`
      + `请在 src/localization/messages/ 的 17 个语言包里补齐：\n  ${missing.join('\n  ')}`,
    ).toEqual([]);
  });
});