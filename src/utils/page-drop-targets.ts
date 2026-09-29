// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type PageDropTarget = {
  path: string;
  element: Element;
};

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

export function getPageDropTargetKey(target: PageDropTarget | null): string {
  if (!target) {
    return '';
  }

  return target.path;
}
