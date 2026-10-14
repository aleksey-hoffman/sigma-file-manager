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
//   3. 随后追加「英文界面开发者名用 kizemo」「分隔符改两个空格」「加 GitHub 链接」。
//
// 这条测试刻意不 mock 语言包内容,而是直接读真实的 ch.json / en.json ——
// 只有这样才能同时覆盖「语言包的值」和「模板的结构」两端。
// 用 key 回显式的 t() 只能验证模板结构,验不出文案本身被改坏。
//
// 为什么要区分 rawText 和 normalizedText:
//   分隔符要求「两个空格」,但 JS 正则的 \s 也匹配不换行空格 U+00A0,
//   normalizedText 把 \s+ 压成一个空格之后,一个空格和两个空格长得一模一样,
//   断言会平凡通过。所以「两个空格」这条必须查 rawText。
//

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import SettingsHeader from '../header.vue';
import chMessages from '@/localization/messages/ch.json';
import enMessages from '@/localization/messages/en.json';

// 扁平化语言包,让 t(key) 能按点号路径取到真实值。
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
const EN = flatten(enMessages as unknown as Record<string, unknown>);

// vi.mock 的工厂会被提升到文件顶部,必须用 vi.hoisted 把可变引用提出来,
// 否则工厂闭包读不到模块级的 let。
const { MESSAGES } = vi.hoisted(() => ({
  MESSAGES: { current: null as Record<string, string> | null },
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const value = MESSAGES.current?.[key];

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

type HeaderWrapper = VueWrapper;

function mountSettingsHeader(messages: Record<string, string> = CH): HeaderWrapper {
  MESSAGES.current = messages;
  return mount(SettingsHeader);
}

beforeEach(() => {
  MESSAGES.current = CH;
});

// 原始文本:不做任何空白归一,用于断言「两个不换行空格」这类要求。
function rawText(wrapper: HeaderWrapper): string {
  return wrapper.text();
}

// 模板里的换行/缩进在 HTML 里会折叠成空白,比对长句前统一压成单空格。
function normalizedText(wrapper: HeaderWrapper): string {
  return wrapper.text().replace(/\s+/g, ' ').trim();
}

// 两个不换行空格的字面量。模板里写的是 &nbsp;&nbsp;,渲染出来就是 U+00A0 U+00A0。
const NBSP2 = '\u00a0\u00a0';

describe('settings header 简介文案', () => {
  it('品牌名在整个简介里只出现一次(历史上出现过两次)', () => {
    const text = normalizedText(mountSettingsHeader());
    const occurrences = text.split('Alpha File Manager').length - 1;

    expect(occurrences).toBe(1);
  });

  it('品牌名加粗、正文紧随其后', () => {
    const wrapper = mountSettingsHeader();
    const strong = wrapper.find('strong');

    expect(strong.exists()).toBe(true);
    expect(strong.text()).toBe('Alpha File Manager');
  });

  it('渲染出用户指定的完整中文简介', () => {
    const wrapper = mountSettingsHeader();

    // 第一行:加粗品牌名 + 正文(长句比对,空白归一后再比)
    expect(normalizedText(wrapper)).toContain(
      'Alpha File Manager 基于 Sigma File Manager 二次开发，'
      + '新增目录树、快速切换（文件对话框路径焦点同步）、批量重命名等实用能力，'
      + '对很多细节进行了优化，打造体验更完善的文件管理器。',
    );

    // 第二行:鸣谢 + 开发(名字是官网链接) + 仓库地址。
    // 这里必须用 rawText —— normalizedText 把 \s+ 压成一个空格,
    // 而 \s 也匹配 NBSP,归一之后再断言 NBSP2 等于断言一个普通空格,会平凡通过。
    const raw = rawText(wrapper);

    expect(raw).toContain(
      `鸣谢原作者 Aleksey Hoffman。${NBSP2}开发：段燚${NBSP2}https://github.com/kizemo/alpha-file-manager`,
    );
  });

  it('官网地址不再作为可见文本出现(链接挂在人名上)', () => {
    const wrapper = mountSettingsHeader();

    expect(rawText(wrapper)).not.toContain('https://www.aiec.fun');
    expect(normalizedText(wrapper)).not.toContain('https://www.aiec.fun');

    // 但它必须仍然是「段燚」这个链接的 href
    const nameLink = wrapper.findAll('a.settings-header__link')[0];

    expect(nameLink.text()).toBe('段燚');
    expect(nameLink.attributes('href')).toBe('https://www.aiec.fun');
  });

  it('不再残留旧的去重正则产物:正文不会以引号包住品牌名开头', () => {
    const text = normalizedText(mountSettingsHeader());

    expect(text).not.toContain('"Alpha File Manager"');
  });

  it('分隔符是两个不换行空格,而不是会被 HTML 折叠成一个的半角空格', () => {
    const text = rawText(mountSettingsHeader());

    // 「鸣谢… 。 开发」之间两个空格
    expect(text).toContain(`Aleksey Hoffman。${NBSP2}开发：`);
    // 「段燚」与仓库地址之间两个空格
    expect(text).toContain(`段燚${NBSP2}https://github.com/kizemo/alpha-file-manager`);

    // 反向断言:确认模板里没有退回到半角空格方案(两个半角空格会被折叠成一个)。
    expect(text).not.toContain('开发：段燚 https');
    // 旧的「——」分隔符已移除。
    expect(text).not.toContain('——');
  });

  it('人名与仓库两个链接的 href / target / rel 都正确', () => {
    const links = mountSettingsHeader().findAll('a.settings-header__link');

    expect(links).toHaveLength(2);

    // 第一个:官网链接,文本是人名本身
    expect(links[0].attributes('href')).toBe('https://www.aiec.fun');
    expect(links[0].text()).toBe('段燚');

    // 第二个:仓库链接,地址既做 href 也做可见文本
    expect(links[1].attributes('href')).toBe('https://github.com/kizemo/alpha-file-manager');
    expect(links[1].text()).toBe('https://github.com/kizemo/alpha-file-manager');

    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank');
      expect(link.attributes('rel')).toBe('noopener noreferrer');
    }
  });

  it('英文界面把开发者名渲染为 GitHub handle kizemo,而不是中文名', () => {
    const text = rawText(mountSettingsHeader(EN));

    expect(text).toContain(`Developed by kizemo${NBSP2}`);
    expect(text).not.toContain('Duan Yi');
    expect(text).not.toContain('段燚');
    // 官网地址同样不作为可见文本出现
    expect(text).not.toContain('https://www.aiec.fun');
  });

  it('英文界面同样输出仓库链接与两个空格分隔', () => {
    const text = rawText(mountSettingsHeader(EN));

    expect(text).toContain(`Credits to the original author Aleksey Hoffman.${NBSP2}Developed by kizemo${NBSP2}`);
    expect(text).toContain(`kizemo${NBSP2}https://github.com/kizemo/alpha-file-manager`);
  });

  it('英文界面同样只有一个品牌名', () => {
    const text = normalizedText(mountSettingsHeader(EN));

    expect(text.split('Alpha File Manager').length - 1).toBe(1);
  });
});