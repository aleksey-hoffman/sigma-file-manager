// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 缩略图四档的唯一度量来源（需求 3.6，2026-10-14）。
// 缩略图像素、列表行高、网格卡高、网格最小列宽全部从这里取。
// 以前这些数字散在组件 props、虚拟布局常量、CSS 变量三处各存一份，
// CSS 与虚拟布局不一致时虚拟滚动的行高会算错 —— 那比"数字漂移"隐蔽得多。

import type { ThumbnailSize } from '../types';

export interface FileBrowserThumbnailMetrics {
  /** 列表视图中缩略图的边长（像素） */
  listThumbnailPx: number;
  /** 列表行高（缩略图 + 16 留白） */
  listRowHeight: number;
  /** 带说明行的列表行高（行高 + 14 说明行） */
  listRowHeightWithDescription: number;
  /** 列表视图中目录 / 非媒体文件（**没有缩略图**）的行高 —— 四档同值，不随档位缩放 */
  listFileEntryHeight: number;
  /** 同上，带说明行 */
  listFileEntryHeightWithDescription: number;
  /** 网格视图媒体/文档卡片高度 */
  gridEntryHeight: number;
  /** 网格视图目录卡片高度 */
  gridDirEntryHeight: number;
  /** 网格视图非媒体文件（文档/代码/压缩包等）卡片高度 —— 四档同值，不随档位缩放 */
  gridFileEntryHeight: number;
  /** 网格视图最小列宽（决定列数） */
  gridMinColumnWidth: number;
}

// FORK-MODIFICATION: 网格卡不能按比例往下缩（验收反馈 2026-10-15）。
// 第一版四档按 0.667 : 1 : 1.333 : 1.667 缩放，把「小」压到了 80 / 35，
// 而 file-browser-grid-card.vue 的卡片内边距与字号是写死的固定值，不跟着档位走。
// 全局 line-height 1.5（src/styles/preflight.css），所以名称行 13*1.5 = 19.5、
// 说明行 11*1.5 = 16.5：
//   目录卡（flex row，上下各 8px 内边距 + 上下各 1px 边框 = 18）：
//     内容区只剩 35 - 18 = 17px，而两行字形合计要 19.5 + 2 + 16.5 - 5.5 = 32.5px。
//     align-items: center 把两行垂直居中后上下同时被裁：名称行还能勉强认出，
//     说明行只剩上半截 —— 截图里 "3 项 · 19.8 MB" 的 MB 只剩顶部一条。
//   文档卡（--icon-full，48px 图标 + 8px 外边距 = 56；底部信息层 8 + 19.5 + 2 + 16.5 + 8 = 54）：
//     80px 装不下 56 + 54 = 110px，图标直接压在文件名上。
// 所以「小」不再是一个更小的排版，而是把「中」原来的尺寸整体上移一档，
// 下面的四档依次再放大一档。改这几个数之前先看下面两个下限。
// GRID_DIR_ENTRY_HEIGHT_FLOOR 的依据是「第一版 medium 档就是 52px，验收通过且
// 从未被报为截断」，不是一次专门的截断测试 —— 小档沿用它是为了满足"小 = 原中档尺寸"。
export const GRID_MEDIA_ENTRY_HEIGHT_FLOOR = 110;
export const GRID_DIR_ENTRY_HEIGHT_FLOOR = 52;

// FORK-MODIFICATION: 反馈 2 续（2026-10-15）——**目录卡**也固定高度。
// 用户原话：「调整缩略图大小时，目录和非媒体文件的网格，高度仍然会增加，
// 请保持和小的时候高度一致」。
//
// 改之前目录卡是 52 / 78 / 104 / 130 四档递增，和媒体卡一样跟着档位长。
// 但目录卡里没有缩略图 —— 它是一行图标加两行字，字号与内边距在
// file-browser-grid-card.vue 里是写死的固定值，本来就不随档位变。
// 让一个内容尺寸不变的盒子随档位长高，长出来的全是空白。
// 取 52 是「小」档当下的值，也就是用户说的"和小的时候一致"。
//
// 与 GRID_FILE_ENTRY_HEIGHT 一样写成常量：用户要的是「不随档位变」，
// 常量让这件事在代码里自证，将来谁想分档会先看到这里写着不允许。
export const GRID_DIR_ENTRY_HEIGHT = GRID_DIR_ENTRY_HEIGHT_FLOOR;

// FORK-MODIFICATION: 反馈 2（2026-10-15）——网格视图区分媒体与非媒体文件。
// 调「缩略图大小」时，**非媒体文件保持高度不变，只改宽度**（宽度由
// gridMinColumnWidth 决定列数，仍然跟着档位走）。
//
// 卡高怎么来的：非媒体卡是 `--icon-full` 形态，卡内两块东西各占一头 ——
//   预览区（absolute，inset 0，flex-start）：图标 margin 8 + 图标本身
//   信息层（absolute，bottom 0，padding 8px 10px）：名称行 + 2 + 说明行
// 两块挨着放，所以下限就是「图标块 + 信息块」，和上面 GRID_MEDIA_ENTRY_HEIGHT_FLOOR
// 用的是同一个推导法（56 + 54 = 110）。
//
// 反馈 2 追加要求后图标从 48px 缩到 24px（与目录卡图标同尺寸）：非媒体卡本来
// 就没有缩略图，占着 48px 图标只是让固定卡高下不去。图标块随之从 56 降到 32，
// 下限 110 → 86。
//
// 为什么是一个常量而不是四档各填一个数：用户要的就是「不随档位变」。
// 写成常量是为了让这件事在代码里自证 —— 将来谁想给它分档，
// 会先看到这里写着不允许，而不是悄悄填四个不同的数字。
export const GRID_FILE_ENTRY_ICON_PX = 24;
/** `--icon-full .__icon` 的 margin（上下左右都是 8，但只有上边距参与高度计算） */
export const GRID_FILE_ENTRY_ICON_MARGIN_PX = 8;
/**
 * 底部信息层高度：padding 8 + 名称行 13*1.5 + gap 2 + 说明行 11*1.5 + padding 8。
 * line-height 1.5 是全局的（src/styles/preflight.css），字号写死在
 * file-browser-grid-card.vue 的 __name / __meta 上。
 */
export const GRID_FILE_ENTRY_INFO_BLOCK_PX = 8 + 13 * 1.5 + 2 + 11 * 1.5 + 8;

export const GRID_FILE_ENTRY_HEIGHT = GRID_FILE_ENTRY_ICON_MARGIN_PX
  + GRID_FILE_ENTRY_ICON_PX
  + GRID_FILE_ENTRY_INFO_BLOCK_PX;

// FORK-MODIFICATION: 反馈 4（2026-10-15）——**列表视图**的目录 / 非媒体文件行同样固定高度。
// 用户原话：「目录和非媒体文件行，在修改缩略图大小时，也不要更改高度，保持默认高度」。
// 与网格同一件事的第二处：这些行里根本没有缩略图（FileBrowserListEntryThumbnail 对
// 非图片/视频返回空，行内只剩一个 19px 的文件图标），字号与行内边距也是写死的，
// 行高跟着档位从 48 长到 96，长出来的全是空白。
//
// 取「默认高度」= 64，即 navigator.thumbnailSize 的出厂默认值 medium 那一档
// （src/stores/storage/user-settings.ts 的 thumbnailSize: 'medium'）。
// 注意这里与网格取 52（= small 档）**故意不同** —— 网格那次用户说的是
// 「保持和小的时候高度一致」，这次说的是「保持默认高度」，两句话锚的是不同的档。
// 一旦改了这个数，file-browser-thumbnail-sizes.test.ts 里有断言把两边钉在一起，
// 改了一边忘了另一边会立刻红。
export const LIST_FILE_ENTRY_HEIGHT = 64;
/** 带说明行：行高 + 14 说明行（14 = 11 字号 * 1.5 行高 + 2 gap） */
export const LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION = LIST_FILE_ENTRY_HEIGHT + 14;

export const FILE_BROWSER_THUMBNAIL_METRICS: Record<ThumbnailSize, FileBrowserThumbnailMetrics> = {
  small: {
    listThumbnailPx: 32,
    listRowHeight: 48,
    listRowHeightWithDescription: 62,
    listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
    listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
    gridEntryHeight: 120,
    gridDirEntryHeight: GRID_DIR_ENTRY_HEIGHT,
    gridFileEntryHeight: GRID_FILE_ENTRY_HEIGHT,
    gridMinColumnWidth: 170,
  },
  medium: {
    listThumbnailPx: 48,
    listRowHeight: 64,
    listRowHeightWithDescription: 78,
    listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
    listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
    gridEntryHeight: 180,
    gridDirEntryHeight: GRID_DIR_ENTRY_HEIGHT,
    gridFileEntryHeight: GRID_FILE_ENTRY_HEIGHT,
    gridMinColumnWidth: 225,
  },
  large: {
    listThumbnailPx: 64,
    listRowHeight: 80,
    listRowHeightWithDescription: 94,
    listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
    listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
    gridEntryHeight: 240,
    gridDirEntryHeight: GRID_DIR_ENTRY_HEIGHT,
    gridFileEntryHeight: GRID_FILE_ENTRY_HEIGHT,
    gridMinColumnWidth: 300,
  },
  xlarge: {
    listThumbnailPx: 80,
    listRowHeight: 96,
    listRowHeightWithDescription: 110,
    listFileEntryHeight: LIST_FILE_ENTRY_HEIGHT,
    listFileEntryHeightWithDescription: LIST_FILE_ENTRY_HEIGHT_WITH_DESCRIPTION,
    gridEntryHeight: 300,
    gridDirEntryHeight: GRID_DIR_ENTRY_HEIGHT,
    gridFileEntryHeight: GRID_FILE_ENTRY_HEIGHT,
    gridMinColumnWidth: 420,
  },
};

// 用户设置可能来自被手改过的配置文件，运行时不能假定它一定落在四档内，
// 因此这里按 string 索引并显式回落，而不是让 TS 的 Record 类型掩盖脏数据。
// 关键：必须先判自有属性再取值，不能写成 `THUMBNAIL_METRICS_BY_SIZE[size] ?? …`。
// 常量表是普通对象字面量，继承 Object.prototype，constructor / toString / __proto__
// 这些键取值不是 undefined，`?? ` 永不触发，会把原型对象当度量用，
// 顺着 resolveThumbnailCssVariables 出去就是 `${undefined}px` 这种静默失效的 CSS 声明。
// 也不能改用 typeof 判断：`__proto__` 取到的 Object.prototype 恰好也是 object，会漏掉一半坏值。
const THUMBNAIL_METRICS_BY_SIZE = FILE_BROWSER_THUMBNAIL_METRICS as Record<
  string,
  FileBrowserThumbnailMetrics | undefined
>;

export function resolveThumbnailMetrics(size: ThumbnailSize): FileBrowserThumbnailMetrics {
  if (!Object.hasOwn(THUMBNAIL_METRICS_BY_SIZE, size)) {
    return FILE_BROWSER_THUMBNAIL_METRICS.medium;
  }

  return THUMBNAIL_METRICS_BY_SIZE[size] as FileBrowserThumbnailMetrics;
}

/**
 * 列表行的 CSS 地板：`.file-browser-list-view__entry` 的 `min-height`。
 *
 * 必须是**本档里最短的那种行**，不能是任何一个具体类别的行高。踩过的坑：
 * 直接喂 `LIST_FILE_ENTRY_HEIGHT`（64）时，small 档的媒体行本该是 48，
 * 却被 min-height 顶回 64 —— 虚拟布局给的 48 只是 `height`，而 `min-height`
 * 会赢。large / xlarge 看着正常，因为它们的媒体行 height 大于 64，
 * 地板不生效 —— 也就是说这个 bug 只在「某档的行比地板矮」时显形。
 *
 * 取 min(两种行高) 之后地板永远不生效：每一种行的显式 height 都 ≥ 它，
 * min-height 退化成「布局算出来之前先有个高度」，正是它原本的作用。
 */
function resolveListEntryHeightFloorPx(
  listRowHeight: number,
  listFileEntryHeight: number,
): number {
  return Math.min(listRowHeight, listFileEntryHeight);
}

export function resolveThumbnailCssVariables(size: ThumbnailSize): Record<string, string> {
  const metrics = resolveThumbnailMetrics(size);

  return {
    '--navigator-list-view-entry-height': `${
      resolveListEntryHeightFloorPx(metrics.listRowHeight, metrics.listFileEntryHeight)}px`,
    '--navigator-grid-view-entry-height': `${metrics.gridEntryHeight}px`,
    '--navigator-grid-view-dir-entry-height': `${metrics.gridDirEntryHeight}px`,
    // FORK-MODIFICATION: 反馈 2（2026-10-15）——非媒体文件卡的固定高度（见 GRID_FILE_ENTRY_HEIGHT）。
    '--navigator-grid-view-file-entry-height': `${metrics.gridFileEntryHeight}px`,
  };
}
