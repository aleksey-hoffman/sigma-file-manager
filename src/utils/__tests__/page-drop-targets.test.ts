// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 移植自 upstream `3eca4c17`（仪表盘重设计）里的 `src/utils/__tests__/page-drop-targets.test.ts`。

import { describe, expect, it } from 'vitest';
import {
  collectPageDropTargets,
  findPageDropTarget,
  getPageDropTargetKey,
} from '@/utils/page-drop-targets';

function createTarget(attributes: Record<string, string>): HTMLElement {
  const element = document.createElement('div');

  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }

  return element;
}

function stubRect(
  element: HTMLElement,
  rect: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  },
): void {
  element.getBoundingClientRect = () => ({
    left: rect.left,
    right: rect.right,
    top: rect.top,
    bottom: rect.bottom,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  });
}

describe('collectPageDropTargets', () => {
  it('collects path targets and ignores rows without a path', () => {
    const container = document.createElement('div');
    const pathTarget = createTarget({
      'data-drop-target': '',
      'data-entry-path': '/docs',
    });
    const ignoredTarget = createTarget({
      'data-drop-target': '',
      'data-tag-id': 'tag-work',
    });

    container.append(ignoredTarget, pathTarget);

    expect(collectPageDropTargets(container).map(target => target.path)).toEqual([
      '/docs',
    ]);
  });

  it('returns an empty list when the container has no drop targets', () => {
    const container = document.createElement('div');

    expect(collectPageDropTargets(container)).toEqual([]);
  });
});

describe('findPageDropTarget', () => {
  it('returns the first overlapping target', () => {
    const pathElement = createTarget({
      'data-drop-target': '',
      'data-entry-path': '/docs',
    });
    stubRect(pathElement, {
      left: 0,
      right: 40,
      top: 0,
      bottom: 20,
    });

    const container = document.createElement('div');
    container.append(pathElement);

    const target = findPageDropTarget(collectPageDropTargets(container), 10, 10);

    expect(getPageDropTargetKey(target)).toBe('/docs');
  });

  it('returns null when the pointer is outside every target', () => {
    const pathElement = createTarget({
      'data-drop-target': '',
      'data-entry-path': '/docs',
    });
    stubRect(pathElement, {
      left: 0,
      right: 40,
      top: 0,
      bottom: 20,
    });

    const container = document.createElement('div');
    container.append(pathElement);

    const target = findPageDropTarget(collectPageDropTargets(container), 500, 500);

    expect(target).toBeNull();
    expect(getPageDropTargetKey(target)).toBe('');
  });
});
