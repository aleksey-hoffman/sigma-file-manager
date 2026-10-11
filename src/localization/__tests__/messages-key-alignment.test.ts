// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 为什么需要这个门禁：
//
// `messages-json.test.ts` 只验证 JSON 能不能解析，`createI18n` 也没有配
// `fallbackLocale`。这意味着**漏改一个语言包不会产生任何报错** ——
// 测试全绿、构建通过，但那个语言的界面会直接显示 key 原文
// （例如 `batchRename.title`）。
//
// 这个测试把「漏改」变成一条会红的断言。
//
// 判定基准是 `en.json`：每个语言包的叶子 key 集合必须与它**完全相等**。
// 缺失与多余都算失败。多余也要查 —— 多出来的 key 说明有人删过 en 的 key
// 却漏删了其它语言，这种不一致同样会让界面行为在不同语言下不一致。
//
// 注意：只比对 key 集合，**不**比对取值。不同语言的文案本来就该不同，
// 而第一期有 15 个语言包使用的是英文占位值（见 batchRename.* 的说明），
// 比对取值会把「尚未翻译」误报成失败。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const messagesDirectory = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../messages',
);

const BASE_LOCALE = 'en';

type JsonObject = { [key: string]: JsonValue };
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

function readLocale(locale: string): JsonObject {
  const filePath = path.join(messagesDirectory, `${locale}.json`);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as JsonObject;
}

/**
 * 递归收集所有叶子 key 的路径。
 *
 * 数组不算叶子 key：语言包里没有任何数组值，把数组当成「一个有 key 的东西」
 * 会产出 `someArray.0` 这种伪 key，比对时制造假阳性。
 */
function collectLeafKeys(node: JsonValue, prefix = ''): Set<string> {
  const keys = new Set<string>();

  if (node === null || typeof node !== 'object' || Array.isArray(node)) {
    return keys;
  }

  for (const [key, value] of Object.entries(node)) {
    const keyPath = prefix ? `${prefix}.${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const nested of collectLeafKeys(value, keyPath)) {
        keys.add(nested);
      }
    }
    else {
      keys.add(keyPath);
    }
  }

  return keys;
}

function sortKeys(keys: Set<string>): string[] {
  return [...keys].sort();
}

const locales = fs
  .readdirSync(messagesDirectory)
  .filter(fileName => fileName.endsWith('.json'))
  .map(fileName => fileName.replace(/\.json$/, ''))
  .sort();

const baseKeys = collectLeafKeys(readLocale(BASE_LOCALE));

describe('localization key alignment', () => {
  it('finds the base locale and several locales to compare against', () => {
    expect(locales).toContain(BASE_LOCALE);
    // 少到不值得逐个断言，多到能证明遍历真的跑起来了。
    expect(locales.length).toBeGreaterThanOrEqual(2);
    expect(baseKeys.size).toBeGreaterThan(0);
  });

  // 每个语言包生成一组 [locale, base]，让 it.each 的标题能同时显示两边。
  const comparables = locales
    .filter(locale => locale !== BASE_LOCALE)
    .map(locale => [locale, BASE_LOCALE] as const);

  it.each(comparables)('%s has exactly the same leaf keys as %s', (locale, base) => {
    const localeKeys = collectLeafKeys(readLocale(locale));
    const baseKeys = collectLeafKeys(readLocale(base));

    const missing = sortKeys(new Set([...baseKeys].filter(key => !localeKeys.has(key))));
    const extra = sortKeys(new Set([...localeKeys].filter(key => !baseKeys.has(key))));

    // 拆成两条断言：失败时 vitest 会直接把多出来的 key 数组打出来，
    // 比把它们塞进一个对象里对比可读得多。
    expect(
      missing,
      `${locale}.json 缺少 ${missing.length} 个 ${base}.json 有的 key:\n  ${missing.join('\n  ')}`,
    ).toEqual([]);

    expect(
      extra,
      `${locale}.json 多出 ${extra.length} 个 ${base}.json 没有的 key:\n  ${extra.join('\n  ')}`,
    ).toEqual([]);
  });

  it('has no blank or whitespace-only values anywhere', () => {
    // 空字符串在界面上等同于「什么都没说」，比缺 key 更难排查。
    const problems: string[] = [];

    for (const locale of locales) {
      function walk(node: JsonValue, prefix: string): void {
        if (node === null || typeof node !== 'object' || Array.isArray(node)) {
          return;
        }

        for (const [key, value] of Object.entries(node)) {
          const keyPath = prefix ? `${prefix}.${key}` : key;

          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            walk(value, keyPath);
          }
          else if (typeof value === 'string' && value.trim() === '') {
            problems.push(`${locale}: ${keyPath}`);
          }
        }
      }

      walk(readLocale(locale), '');
    }

    expect(problems, `以下 key 的值是空字符串：\n  ${problems.join('\n  ')}`).toEqual([]);
  });
});
