// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-23：**标签分组的纯逻辑**（移植自 upstream `3eca4c17`）。
//
// ## 为什么搬这个
//
// 仪表盘页原本把这个循环**内联**在 `dashboard.vue` 里：
//
// ```ts
// for (const tag of tags.value) {
//   const itemsForTag = taggedItems.value.filter(item => item.tagIds.includes(tag.id));
//   if (itemsForTag.length === 0) continue;
//   sections.push({ tag, items: itemsForTag, staggerBase });
//   staggerBase += itemsForTag.length;
// }
// ```
//
// 逻辑本身是对的，但它藏在 800 多行的页面组件里，**没有任何测试能碰到它**。
// upstream 的仪表盘重设计把它抽成了独立模块并补了单测 —— 这一步本身是好的，
// 与它那套 UI 改造无关，所以单独搬过来。
//
// ## 为什么没搬 upstream 的「孤立条目」那一套
//
// upstream 的同名模块还带一组「孤立标签」处理
// （`getOrphanedTaggedItems` / `createOrphanedTagSection` / `isOrphanedTagId` /
// `getDashboardTagSections`），用来把「标签已被删除、条目还在」的条目收进一个
// 专门的「未分类」分组。
//
// **本仓不会出现这种条目**，所以那组函数搬进来就是死代码：
//
// 1. 本仓的 `userStats.deleteTag()`（`src/stores/storage/user-stats.ts`）
//    在删标签时**同步剥掉所有条目上的该 tagId**，并清掉因此变空的条目 ——
//    这正是 upstream `removeTagFromAllItems` 的语义，只是本仓把它内联在删除流程里。
// 2. 本仓还有 `reconcileMissingTagDefinitions()` 兜底：即使数据来自旧版本、
//    外部写入或异常中断导致标签定义缺失，启动时也会**按条目反推重建**标签定义
//    （文案用 `tags.recoveredTag`），所以条目不会变成无家可归。
//
// upstream 的 `removeTagFromAllItems` / `removeTaggedItem` 本仓也没有 ——
// 但那是**它的 UI 需要**（新界面里「删标签」和「删分组」是两个独立入口），
// 本仓的删除入口只有一个，走 `deleteTag()` 已经够用。

import type { ItemTag, TaggedItem } from '@/types/user-stats';

export type TaggedSection = {
  tag: ItemTag;
  items: TaggedItem[];
};

export type GetTaggedSectionsOptions = {
  /** 是否保留「一个条目都没有」的标签。默认 false。 */
  includeEmpty?: boolean;
};

/**
 * 把标签列表与已标记条目列表配成「每个标签一个分组」。
 *
 * - 只保留 `tags` 里的标签，顺序跟 `tags` 一致；
 * - 一个条目可以同时属于多个分组（条目带多个 tagId 时会出现在多个分组里）；
 * - 条目引用的标签如果不在 `tags` 里，该条目不会出现在任何分组中。
 */
export function getTaggedSections(
  tags: ItemTag[],
  taggedItems: TaggedItem[],
  options?: GetTaggedSectionsOptions,
): TaggedSection[] {
  const sections: TaggedSection[] = [];
  const includeEmpty = options?.includeEmpty === true;

  for (const tag of tags) {
    const items = taggedItems.filter(item => item.tagIds.includes(tag.id));

    if (items.length === 0 && !includeEmpty) {
      continue;
    }

    sections.push({
      tag,
      items,
    });
  }

  return sections;
}
