// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION: 设置页顶部软件简介文案的回归门禁。
//
// 为什么要有这条测试:
//   1. 2026-10-13 之前这段模板里存在过一处长期 bug —— `app.description` 自带
//      `"Alpha File Manager"` 前缀,模板又输出一次 `app.name`,界面渲染成
//      `"Alpha File Manager" "Alpha File Manager" 在 ...`。当时的修法是在模板里
//      加正则剥掉前缀,属于「绕过症状」而非消除重复来源。
//   2. 2026-10-13 用户重新指定了整段简介文案(含新增的「开发:段燚」一行),
//      品牌名结构变成「加粗品牌名 + 空格 + 正文」,那个正则已随之删除。
//
// 这条测试刻意不 mock 语言包内容,而是直接读真实的 ch.json ——
// 只有这样才能同时覆盖「语言包的值」和「模板的结构」两端。
// 用 key 回显式的 t() 只能验证模板结构,验不出文案本身被改坏。
//

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SettingsHeader from '../header.vue';
import chMessages from '@/localization/messages/ch.json';

// 扁平化 ch.json,让 t(key) 能按点号路径取到真实值。
function flatten(source: Record<string, unknown>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Record<string, unknown>, path));
    }
    else if (typeof value === 'string') {
      out[path] = value;
    }
  }

  return out;
}

const CH = flatten(chMessages as unknown as Record<string, unknown>);

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const value = CH[key];

      // 缺键时返回可见占位符,而不是抛错。
      // 抛错会让整个测试文件以「加载失败」结束 —— 输出里看不到是哪个断言、
      // 缺的是哪个键,排查成本很高(本轮探针实测踩到过)。
      // 返回占位符则会让断言正常 diff,坏结果直接显示在 received 里。
      if (typeof value !== 'string') {
        return `«missing:${key}»`;
      }

      return value;
    },
  }),
}));

// logo 是静态资源 import,vitest 下按文件名解析即可,这里 stub 掉避免读二进制。
vi.mock('@/assets/icons/logo-1024x1024.png', () => ({ default: '/logo.png' }));

function mountHeader() {
  return mount(SettingsHeader);
}

// 模板里的换行/缩进在 HTML 里会折叠成空白,比对前统一压成单空格。
function normalizedText(wrapper: ReturnType<typeof mountHeader>): string {
  return wrapper.text().replace(/\s+/g, ' ').trim();
}

describe('settings header 简介文案', () => {
  it('品牌名在整个简介里只出现一次(历史上出现过两次)', () => {
    const text = normalizedText(mountHeader());
    const occurrences = text.split('Alpha File Manager').length - 1;

    expect(occurrences).toBe(1);
  });

  it('品牌名加粗、正文紧随其后', () => {
    const wrapper = mountHeader();
    const strong = wrapper.find('strong');

    expect(strong.exists()).toBe(true);
    expect(strong.text()).toBe('Alpha File Manager');
  });

  it('渲染出用户指定的完整中文简介', () => {
    const text = normalizedText(mountHeader());

    // 第一行:加粗品牌名 + 正文
    expect(text).toContain(
      'Alpha File Manager 基于 Sigma File Manager 二次开发，'
      + '新增目录树、快速切换（文件对话框路径焦点同步）、批量重命名等实用能力，'
      + '对很多细节进行了优化，打造体验更完善的文件管理器。',
    );

    // 第二行:鸣谢 + 开发 + 官网链接
    expect(text).toContain('鸣谢原作者 Aleksey Hoffman。 开发：段燚 —— https://www.aiec.fun');
  });

  it('不再残留旧的去重正则产物:正文不会以引号包住品牌名开头', () => {
    const text = normalizedText(mountHeader());

    expect(text).not.toContain('"Alpha File Manager"');
  });

  it('官网链接指向 aiec.fun 且在新窗口打开', () => {
    const link = mountHeader().find('a.settings-header__link');

    expect(link.exists()).toBe(true);
    expect(link.attributes('href')).toBe('https://www.aiec.fun');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener noreferrer');
  });
});