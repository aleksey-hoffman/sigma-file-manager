// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getPanelSizeEaseProgress } from '../animate-info-panel-size';

describe('getPanelSizeEaseProgress', () => {
  it('stays on the target once the animation finishes', () => {
    expect(getPanelSizeEaseProgress(0)).toBe(0);
    expect(getPanelSizeEaseProgress(1)).toBe(1);
  });

  it('moves in one direction and does not pass the target', () => {
    let previous = 0;

    for (let step = 0; step <= 20; step += 1) {
      const progress = getPanelSizeEaseProgress(step / 20);

      expect(progress).toBeGreaterThanOrEqual(previous);
      expect(progress).toBeLessThanOrEqual(1);
      previous = progress;
    }
  });
});
