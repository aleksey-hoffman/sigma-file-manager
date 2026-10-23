// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 移植自 upstream `3eca4c17`（仪表盘重设计）里的 `src/utils/page-drop-targets.ts`。
//
// ## 为什么搬这个
//
// 页面拖放（把文件拖到页面上的某个卡片上）的「找出所有可放置目标」这段逻辑，
// 本仓原本**内联**在 `src/composables/use-page-drop-zone.ts` 里。
// upstream 的仪表盘重设计把它抽成了独立模块并补了单测 —— 这一步本身是好的，
// 与它那套 UI 改造无关，所以单独搬过来。
//
// 抽出来之后，`use-page-drop-zone.ts` 只剩「事件怎么来、拖起来什么样式」这类
// 胶水代码，而「哪些元素算放置目标、鼠标在不在某个目标上」变成可以单测的纯函数。

export type PageDropTarget = {
  path: string;
  element: Element;
};

/** 收集容器内所有声明了 `data-entry-path` 的放置目标。 */
export function collectPageDropTargets(container: Element): PageDropTarget[] {
  const pathTargets: PageDropTarget[] = [];

  for (const element of container.querySelectorAll('[data-drop-target]')) {
    const path = element.getAttribute('data-entry-path');

    if (path) {
      pathTargets.push({
        path,
        element,
      });
    }
  }

  return pathTargets;
}

/** 找出鼠标位置落在哪个放置目标上；没有命中返回 null。 */
export function findPageDropTarget(
  targets: PageDropTarget[],
  clientX: number,
  clientY: number,
): PageDropTarget | null {
  for (const target of targets) {
    const rect = target.element.getBoundingClientRect();

    if (
      clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
    ) {
      return target;
    }
  }

  return null;
}

/** 放置目标的稳定标识；没有目标时返回空串。 */
export function getPageDropTargetKey(target: PageDropTarget | null): string {
  if (!target) {
    return '';
  }

  return target.path;
}
