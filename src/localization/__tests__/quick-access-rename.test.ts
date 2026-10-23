// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-23：**板块改名「仪表板 → 快速访问」的门禁**。
//
// ## 这道门禁为什么存在
//
// 板块改名做了一轮**手工挑 key** 的批量替换，第一轮只改了 8 个 key，
// 结果漏掉了 5 个同样会显示给用户的：
//
// - `quickAccess.open{Favorites,Frequent,History,Tagged}Tab`
//   —— 侧边栏「快速访问」面板里四个跳转按钮的原生 title（悬浮提示）；
// - `settingsTags.quickAccess`
//   —— 设置页的搜索关键词表，用户在里面搜 "dashboard" 仍能命中这个设置项。
//
// 漏改不会让任何功能测试变红：功能是好的，只是文案还指着旧板块名。
// ⇒ 这里把「**全部语言包里的全部字符串**」都扫一遍，
// 谁再写回旧名（各语言的译法都算），CI 就红。
//
// 范围说明：**只管用户可见文案**。代码里的 `dashboard` 标识符
// （路由名、CSS 类名、i18n key、存储 key）一律不动 —— 那些不是文案。

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const localeDirectoryPath = path.resolve('src/localization/messages');

// 必须存在且非空的 key —— 少了说明改名时把文案删了。
const REQUIRED_PATHS = [
  'pages.dashboard',
  'dashboard.subtitle',
  'shortcuts.switchToDashboardPage',
  'settings.uiElements.quickAccessOnHoverDescription',
  'settings.stats.description',
  'settingsTags.uiElements',
  'settingsTags.stats',
  'settingsTags.startupPage',
  'settingsTags.quickAccess',
  'quickAccess.openFavoritesTab',
  'quickAccess.openFrequentTab',
  'quickAccess.openHistoryTab',
  'quickAccess.openTaggedTab',
];

// 「仪表板」在各语言里的旧译法。
const STALE_PATTERNS: RegExp[] = [
  /仪表盘/,
  /仪表盤/,
  /\b[Dd]ashboards?\b/,
  /Tableau de bord/i,
  /д[аa]шборд/i,
  /Дашборд/,
  /ダッシュボード/,
  /대시보드/,
  /داشبورد/,
  /لوحة التحكم/,
  /לוח מחוונים/,
  /לוח בקרה/,
  /डैशबोर्ड/,
  /Վահանակ/,
  /Nadzorna plošča/i,
  /Gösterge Tablosu/i,
  /Gösterge Panosu/i,
  /ڈیش بورڈ/,
  /Bảng điều khiển/i,
  /painel de control/i,
  /Tablero de control/i,
  /табло управления/i,
];

type Json = { [key: string]: Json | string };

function valueAt(payload: Json, dottedPath: string): Json | string | undefined {
  let cursor: Json | string | undefined = payload;

  for (const segment of dottedPath.split('.')) {
    if (typeof cursor !== 'object' || cursor === null) {
      return undefined;
    }

    cursor = cursor[segment];
  }

  return cursor;
}

function collectStrings(payload: Json, prefix = ''): Array<[string, string]> {
  const out: Array<[string, string]> = [];

  for (const [key, value] of Object.entries(payload)) {
    const dotted = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'string') {
      out.push([dotted, value]);
    }
    else if (value && typeof value === 'object') {
      out.push(...collectStrings(value, dotted));
    }
  }

  return out;
}

describe('dashboard board rename to "quick access"', () => {
  const localeFileNames = fs
    .readdirSync(localeDirectoryPath)
    .filter(fileName => fileName.endsWith('.json'))
    .sort();

  it('has locale files to check', () => {
    expect(localeFileNames.length).toBeGreaterThan(0);
  });

  it('keeps every renamed key present and non-empty in every locale', () => {
    for (const fileName of localeFileNames) {
      const payload = JSON.parse(
        fs.readFileSync(path.join(localeDirectoryPath, fileName), 'utf8'),
      ) as Json;

      for (const dottedPath of REQUIRED_PATHS) {
        const value = valueAt(payload, dottedPath);

        expect(typeof value, `${fileName} -> ${dottedPath} must be a string`).toBe('string');
        expect(String(value).trim(), `${fileName} -> ${dottedPath} must not be empty`).not.toBe('');
      }
    }
  });

  it('leaves no reference to the old board name in any user-facing string', () => {
    for (const fileName of localeFileNames) {
      const payload = JSON.parse(
        fs.readFileSync(path.join(localeDirectoryPath, fileName), 'utf8'),
      ) as Json;

      for (const [dottedPath, value] of collectStrings(payload)) {
        for (const pattern of STALE_PATTERNS) {
          expect(
            pattern.test(value),
            `${fileName} -> ${dottedPath} still says "${value}"`,
          ).toBe(false);
        }
      }
    }
  });

  it('uses the new Chinese wording for the board title', () => {
    const payload = JSON.parse(
      fs.readFileSync(path.join(localeDirectoryPath, 'ch.json'), 'utf8'),
    ) as Json;

    expect(valueAt(payload, 'pages.dashboard')).toBe('快速访问');
    expect(valueAt(payload, 'dashboard.subtitle')).toBe('收藏、标记与常用项目，一处直达');
    expect(valueAt(payload, 'quickAccess.openFavoritesTab')).toBe('在快速访问打开「收藏夹」页签');
  });
});
