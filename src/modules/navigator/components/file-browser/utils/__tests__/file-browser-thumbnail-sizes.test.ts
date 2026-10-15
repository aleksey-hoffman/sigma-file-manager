// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求 3.6 缩略图四档重定（2026-10-14）。
// 这张表是四个消费方的唯一事实来源，改这里等于改全局。

import { describe, expect, it } from 'vitest';
import type { ThumbnailSize } from '../../types';
import {
  FILE_BROWSER_THUMBNAIL_METRICS,
  GRID_DIR_ENTRY_HEIGHT,
  GRID_DIR_ENTRY_HEIGHT_FLOOR,
  GRID_FILE_ENTRY_HEIGHT,
  GRID_FILE_ENTRY_ICON_PX,
  GRID_FILE_ENTRY_INFO_BLOCK_PX,
  GRID_MEDIA_ENTRY_HEIGHT_FLOOR,
  LIST_FILE_ENTRY_HEIGHT,
  LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
  resolveThumbnailCssVariables,
  resolveThumbnailMetrics,
} from '../file-browser-thumbnail-sizes';

describe('FILE_BROWSER_THUMBNAIL_METRICS', () => {
  // FORK-MODIFICATION: 反馈 2（2026-10-15）新增 gridFileEntryHeight。
  // 这四条期望值是逐字对照，不是「≥ 下限」那种弱断言 —— 反馈 2 要的就是
  // 非媒体卡四档同高，弱断言会把这个要求放过去。
  it.each([
    [
      'small',
      {
        listThumbnailPx: 32,
        listRowHeight: 48,
        listRowHeightWithDescription: 62,
        listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
        listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
        gridEntryHeight: 120,
        gridDirEntryHeight: 52,
        gridFileEntryHeight: 86,
        gridMinColumnWidth: 170,
      },
    ],
    [
      'medium',
      {
        listThumbnailPx: 48,
        listRowHeight: 64,
        listRowHeightWithDescription: 78,
        listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
        listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
        gridEntryHeight: 180,
        gridDirEntryHeight: 52,
        gridFileEntryHeight: 86,
        gridMinColumnWidth: 225,
      },
    ],
    [
      'large',
      {
        listThumbnailPx: 64,
        listRowHeight: 80,
        listRowHeightWithDescription: 94,
        listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
        listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
        gridEntryHeight: 240,
        gridDirEntryHeight: 52,
        gridFileEntryHeight: 86,
        gridMinColumnWidth: 300,
      },
    ],
    [
      'xlarge',
      {
        listThumbnailPx: 80,
        listRowHeight: 96,
        listRowHeightWithDescription: 110,
        listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
        listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
        gridEntryHeight: 300,
        gridDirEntryHeight: 52,
        gridFileEntryHeight: 86,
        gridMinColumnWidth: 420,
      },
    ],
  ] as Array<[ThumbnailSize, Record<string, number>]>)(
    'defines every metric for %s',
    (size, expected) => {
      expect(FILE_BROWSER_THUMBNAIL_METRICS[size]).toEqual(expected);
    },
  );

  it('keeps the description row exactly 14 px taller than the plain row', () => {
    for (const metrics of Object.values(FILE_BROWSER_THUMBNAIL_METRICS)) {
      expect(metrics.listRowHeightWithDescription - metrics.listRowHeight).toBe(14);
    }
  });

  // FORK-MODIFICATION: 验收反馈 2026-10-15 —— 第一版把网格四档按 0.667:1:1.333:1.667 缩放，
  // 「小」落到 80 / 35，低于卡片自身写死的内边距与字号能容纳的下限：
  // 目录卡的说明行被垂直裁掉一半，文档卡的 48px 图标压在文件名上。
  // 纯数值表的断言拦不住这种回归 —— 表里的 80 / 35 完全自洽，只有"装不下"这件事是错的。
  // 所以这里把下限钉成不变量：任何一档掉到下限以下，这条就红。
  it('keeps every grid card tall enough to hold its own content', () => {
    for (const [size, metrics] of Object.entries(FILE_BROWSER_THUMBNAIL_METRICS)) {
      // 文档 / 图片 / 视频卡：48px 图标 + 8px 外边距 + 底部信息层
      expect(
        metrics.gridEntryHeight,
        `${size} 的 gridEntryHeight 低于卡片内容下限，图标会压住文件名`,
      ).toBeGreaterThanOrEqual(GRID_MEDIA_ENTRY_HEIGHT_FLOOR);

      // 目录卡：上下各 8px 内边距 + 上下各 1px 边框 + 两行字形
      expect(
        metrics.gridDirEntryHeight,
        `${size} 的 gridDirEntryHeight 低于卡片内容下限，说明行会被裁掉`,
      ).toBeGreaterThanOrEqual(GRID_DIR_ENTRY_HEIGHT_FLOOR);

      // FORK-MODIFICATION: 反馈 2 —— 非媒体卡（--other，--icon-full 形态）
      // 的下限是它自己的：图标缩到 24px 后，图标块与信息层各占一头，
      // 合起来就是 GRID_FILE_ENTRY_HEIGHT。用媒体卡的 110 去卡它会把
      // 「图标缩小」这个要求静默撤销掉，所以这里必须用非媒体自己的下限。
      expect(
        metrics.gridFileEntryHeight,
        `${size} 的 gridFileEntryHeight 低于卡片内容下限，图标会压住文件名`,
      ).toBeGreaterThanOrEqual(GRID_FILE_ENTRY_HEIGHT);
    }
  });

  // 反馈 2 的核心要求：**非媒体文件调档时高度不变，仅宽度变**。
  // 「四档同值」是需求本身，不是实现细节 —— 上面那张逐字表已经钉住了具体数字，
  // 这条再钉一次「同一个值被复用」这个事实：任何人把某档改成另一个数字，
  // 上面那条会红；把常量拆成四份分别赋值，上面那条不红但这条会红。
  it('gives non-media file cards one height across all four sizes', () => {
    const fileHeights = Object.values(FILE_BROWSER_THUMBNAIL_METRICS)
      .map(metrics => metrics.gridFileEntryHeight);

    expect(new Set(fileHeights).size).toBe(1);
    expect(fileHeights[0]).toBe(GRID_FILE_ENTRY_HEIGHT);
  });

  // 反馈 2 追加要求（图标缩到 24px）之后，非媒体卡的高度必须**低于**媒体卡的最小档，
  // 否则「进一步减小网格卡的高度」没有发生 —— 数值表自洽地停在 110 也能让上面那些
  // 断言全绿。这条把「缩小」这个意图钉成可执行的不等式。
  it('gives non-media cards a lower height than the smallest media card', () => {
    expect(GRID_FILE_ENTRY_HEIGHT).toBeLessThan(FILE_BROWSER_THUMBNAIL_METRICS.small.gridEntryHeight);
  });

  // 反过来也要钉住：媒体卡**必须**跟着档位缩放，否则「非媒体固定高」就变成了
  // 「所有卡都固定高」，等于把反馈 2 做成了另一件事。
  it('still scales media card heights with the thumbnail size', () => {
    const mediaHeights = Object.values(FILE_BROWSER_THUMBNAIL_METRICS)
      .map(metrics => metrics.gridEntryHeight);

    expect(new Set(mediaHeights).size).toBe(4);
  });

  // 反馈 2 续（2026-10-15）：用户实测发现**目录卡**也还在随档位长高
  // （52 / 78 / 104 / 130），要求「保持和小的时候高度一致」。
  // 目录卡里没有缩略图，字号与内边距都是写死的，长出来的那截全是空白。
  it('gives directory cards one height across all four sizes', () => {
    const dirHeights = Object.values(FILE_BROWSER_THUMBNAIL_METRICS)
      .map(metrics => metrics.gridDirEntryHeight);

    expect(new Set(dirHeights).size).toBe(1);
    expect(dirHeights[0]).toBe(GRID_DIR_ENTRY_HEIGHT);
    // 「和小的时候一致」= 等于小档当初的 52。
    expect(dirHeights[0]).toBe(GRID_DIR_ENTRY_HEIGHT_FLOOR);
  });

  // FORK-MODIFICATION: 反馈 4（2026-10-15）——列表视图的目录 / 非媒体文件行。
  // 用户原话：「目录和非媒体文件行，在修改缩略图大小时，也不要更改高度，保持默认高度」。
  // 这与上面两条是同一个道理在列表里的第二处：这些行里没有缩略图，
  // 行高却跟着档位从 48 长到 96，长出来的全是空白。
  it('gives directory and non-media list rows one height across all four sizes', () => {
    const heights = Object.values(FILE_BROWSER_THUMBNAIL_METRICS)
      .map(metrics => metrics.listFileEntryHeight);

    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBe(LIST_FILE_ENTRY_HEIGHT);
  });

  // 「保持默认高度」锚的是**出厂默认档位**，不是「小」档。
  // navigator.thumbnailSize 的默认值是 medium（src/stores/storage/user-settings.ts），
  // 而 medium 的 listRowHeight 就是 64 —— 常量和默认档位必须绑死，
  // 否则「默认」二字在代码里就没有确定的含义了。
  // 注意这与网格取 52（= small）**故意不同**：那次的原话是「和小的时候高度一致」。
  it('pins the fixed list height to the default thumbnail size', () => {
    expect(LIST_FILE_ENTRY_HEIGHT).toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium.listRowHeight);
    expect(LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION)
      .toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium.listRowHeightWithDescription);
  });

  // 带说明行的差值仍然是 14（11 字号 * 1.5 + 2 gap）。
  it('keeps the fixed list height exactly 14 px taller with a description', () => {
    expect(LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION - LIST_FILE_ENTRY_HEIGHT).toBe(14);

    for (const metrics of Object.values(FILE_BROWSER_THUMBNAIL_METRICS)) {
      expect(metrics.listFileEntryHeightWithDescription - metrics.listFileEntryHeight).toBe(14);
    }
  });

  // --navigator-list-view-entry-height 是 .file-browser-list-view__entry 的 min-height。
  // 它必须是**本档最短的那种行**：钉成任何一种具体行高都会踩坑 ——
  // 钉成 64（无缩略图行的行高）时 small 档的媒体行 height=48 会被 min-height 顶回 64；
  // 钉成 listRowHeight 时 xlarge 档的无缩略图行 height=64 会被顶回 96。
  // 下面两条分别钉住这两头。
  it('injects the row min-height floor as the shortest row of each size', () => {
    const floors = (['small', 'medium', 'large', 'xlarge'] as ThumbnailSize[])
      .map(size => Number(
        resolveThumbnailCssVariables(size)['--navigator-list-view-entry-height'].replace('px', ''),
      ));

    // small 档媒体行 48 < 无缩略图行 64，所以地板取 48；
    // 其余三档无缩略图行 64 是最短的，地板取 64。
    expect(floors).toEqual([48, 64, 64, 64]);
  });

  it('never lets the row min-height floor exceed a row the layout can produce', () => {
    for (const size of ['small', 'medium', 'large', 'xlarge'] as ThumbnailSize[]) {
      const metrics = resolveThumbnailMetrics(size);
      const floor = Number(
        resolveThumbnailCssVariables(size)['--navigator-list-view-entry-height'].replace('px', ''),
      );

      // 两条都是「地板不许把任何一行顶高」的判据。少了任一条，
      // 对应档位的缩略图档位就会静默失效 —— 而那正是反馈 4 的回归形态。
      expect(floor, `${size} 的地板高于媒体行`).toBeLessThanOrEqual(metrics.listRowHeight);
      expect(floor, `${size} 的地板高于无缩略图行`).toBeLessThanOrEqual(metrics.listFileEntryHeight);
    }
  });

  // 下限本身也要有出处，否则它只是把一个魔数换了个地方放。
  it('pins the content floors to the card box model they came from', () => {
    // 全局 line-height 1.5（src/styles/preflight.css）：名称行 13*1.5，说明行 11*1.5。
    const nameLine = 13 * 1.5;
    const metaLine = 11 * 1.5;

    // --icon-full 卡：图标 48 + margin 8 = 56；底部信息层 8 + 名称行 + 2 + 说明行 + 8。
    // 这个下限是硬推导 —— 低于它，48px 图标一定会压到文件名上。
    expect(GRID_MEDIA_ENTRY_HEIGHT_FLOOR).toBe(56 + (8 + nameLine + 2 + metaLine + 8));

    // 目录卡的下限不是硬推导：行盒叠上 padding 8*2 + border 1*2 要 56px，
    // 但字形比行盒矮约 5.5px，可见字形只需 50.5px。
    // 52px 的依据是「第一版 medium 档就是 52px，验收通过且从未被报为截断」，
    // 而不是某次专门的截断测试 —— 小档沿用它是为了满足"小 = 原中档尺寸"的需求。
    // 所以这里钉住 52，同时钉住它不低于字形下限 50.5。
    expect(GRID_DIR_ENTRY_HEIGHT_FLOOR).toBe(52);
    expect(GRID_DIR_ENTRY_HEIGHT_FLOOR).toBeGreaterThanOrEqual(8 * 2 + 1 * 2 + (nameLine + 2 + metaLine) - 5.5);

    // 反馈 2：非媒体卡的下限是同一套推导法，只是图标从 48 缩到 24（与目录卡同尺寸）。
    // 图标块 = margin 8 + 24 = 32，信息块与媒体卡完全一样。
    // 钉住这两个分量，免得「图标缩了但卡高没跟着降」这种半截改动混过去。
    expect(GRID_FILE_ENTRY_ICON_PX).toBe(24);
    expect(GRID_FILE_ENTRY_INFO_BLOCK_PX).toBe(8 + nameLine + 2 + metaLine + 8);
    expect(GRID_FILE_ENTRY_HEIGHT).toBe(8 + 24 + (8 + nameLine + 2 + metaLine + 8));
    // 注意：「非媒体图标 == 目录图标」这条**没有**在这里钉住 ——
    // 目录那个 24 是 file-browser-grid-card.vue 模板里的字面量 `:size="24"`，
    // 导不出常量，凭空造一个只在本测试里出现的 24 是自欺。
    // 这条由真机像素验收量两个图标的实际高度来守。
  });
});

describe('resolveThumbnailMetrics', () => {
  it('falls back to medium for an unknown or dirty configured size', () => {
    expect(resolveThumbnailMetrics('huge' as ThumbnailSize))
      .toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium);
  });

  // 常量表是普通对象字面量，会继承 Object.prototype，
  // 所以 constructor / toString / __proto__ 这些键取值并不是 undefined，
  // 用 `?? ` 兜底会被绕过、悄悄把原型对象当度量用。
  it.each([
    '__proto__',
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
  ])('falls back to medium for the inherited key %s', (key) => {
    const metrics = resolveThumbnailMetrics(key as ThumbnailSize);

    // 用 `toBe` 锁定"返回的就是 medium 那一档对象本身，不是新拷贝"，
    // 再钉住具体数值，避免断言退化成"没抛异常就算过"。
    expect(metrics).toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium);
    expect(metrics).not.toBe(Object.prototype);
    expect(metrics.listThumbnailPx).toBe(48);
    expect(metrics.listRowHeight).toBe(64);
  });
});

describe('resolveThumbnailCssVariables', () => {
  // FORK-MODIFICATION: 反馈 2 —— 变量从三个变四个。`toEqual` 是整表比对，
  // 少注入或多注入一个都会红，所以这些断言天然钉住了「注入的集合」本身。
  it('emits the four CSS variables consumed by list and grid views', () => {
    expect(resolveThumbnailCssVariables('large')).toEqual({
      '--navigator-list-view-entry-height': '64px',
      '--navigator-grid-view-entry-height': '240px',
      '--navigator-grid-view-dir-entry-height': '52px',
      '--navigator-grid-view-file-entry-height': '86px',
    });
  });

  it('emits the medium fallback values for a dirty configured size', () => {
    expect(resolveThumbnailCssVariables('huge' as ThumbnailSize)).toEqual({
      '--navigator-list-view-entry-height': '64px',
      '--navigator-grid-view-entry-height': '180px',
      '--navigator-grid-view-dir-entry-height': '52px',
      '--navigator-grid-view-file-entry-height': '86px',
    });
  });

  // 兜底一旦被原型键绕过，产物就是 `${undefined}px` 这种静默失效的 CSS 声明，
  // 所以这里逐值断言，不接受"字符串里带 px 就算过"。
  it('never emits undefined px for inherited keys', () => {
    const inheritedKeys: string[] = ['__proto__', 'constructor', 'toString'];

    for (const key of inheritedKeys) {
      expect(resolveThumbnailCssVariables(key as ThumbnailSize)).toEqual({
        '--navigator-list-view-entry-height': '64px',
        '--navigator-grid-view-entry-height': '180px',
        '--navigator-grid-view-dir-entry-height': '52px',
        '--navigator-grid-view-file-entry-height': '86px',
      });
    }
  });

  // 反馈 2 的判别性断言：CSS 变量这一层也必须四档同值。
  // 只断言「表里是 86」不够 —— 表对了但 CSS 变量没接上，卡片照样按媒体高度走，
  // 而那条路径没有任何数值测试能看见（它全靠 CSS 生效）。
  it('emits the same non-media height for every thumbnail size', () => {
    const sizes: ThumbnailSize[] = ['small', 'medium', 'large', 'xlarge'];
    const emitted = sizes.map(
      size => resolveThumbnailCssVariables(size)['--navigator-grid-view-file-entry-height'],
    );

    expect(new Set(emitted).size).toBe(1);
    expect(emitted[0]).toBe(`${GRID_FILE_ENTRY_HEIGHT}px`);
  });
});
