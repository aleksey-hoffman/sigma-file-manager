// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

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
});

describe('findPageDropTarget', () => {
  it('returns the first overlapping target', () => {
    const pathElement = createTarget({
      'data-drop-target': '',
      'data-entry-path': '/docs',
    });
    pathElement.getBoundingClientRect = () => ({
      left: 0,
      right: 40,
      top: 0,
      bottom: 20,
      width: 40,
      height: 20,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const target = findPageDropTarget(
      collectPageDropTargets((() => {
        const container = document.createElement('div');
        container.append(pathElement);
        return container;
      })()),
      10,
      10,
    );

    expect(getPageDropTargetKey(target)).toBe('/docs');
  });
});
