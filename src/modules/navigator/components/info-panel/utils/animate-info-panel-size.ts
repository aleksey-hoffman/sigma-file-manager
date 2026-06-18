// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { INFO_PANEL_LAYOUT } from '@/modules/navigator/constants/info-panel';

export type AnimatablePanelInstance = {
  getSize: () => number;
  resize: (size: number) => void;
};

function getInfoPanelResizeEaseProgress(progress: number): number {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  if (clampedProgress === 1) {
    return 1;
  }

  const overshoot = INFO_PANEL_LAYOUT.SIZE_TRANSITION_BACK_OVERSHOOT;
  const overshootPlusOne = overshoot + 1;

  return 1
    + overshootPlusOne * (clampedProgress - 1) ** 3
    + overshoot * (clampedProgress - 1) ** 2;
}

function runPanelSizeAnimation(
  panel: AnimatablePanelInstance,
  targetSize: number,
  durationMs: number,
): Promise<void> {
  const startSize = panel.getSize();
  const roundedTarget = Math.round(targetSize);

  if (Math.abs(startSize - roundedTarget) < 1) {
    panel.resize(roundedTarget);
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      const easedProgress = getInfoPanelResizeEaseProgress(progress);
      const delta = roundedTarget - startSize;
      const overshootAllowance = Math.abs(delta) * 0.1;
      const minSize = Math.min(startSize, roundedTarget) - overshootAllowance;
      const maxSize = Math.max(startSize, roundedTarget) + overshootAllowance;
      const currentSize = Math.min(
        maxSize,
        Math.max(0, minSize, startSize + delta * easedProgress),
      );

      panel.resize(currentSize);

      if (progress < 1) {
        requestAnimationFrame(step);
        return;
      }

      panel.resize(roundedTarget);
      resolve();
    }

    requestAnimationFrame(step);
  });
}

export function animatePanelSize(
  panel: AnimatablePanelInstance | null | undefined,
  targetSize: number,
  durationMs = INFO_PANEL_LAYOUT.SIZE_TRANSITION_MS,
): Promise<void> {
  if (panel == null) {
    return Promise.resolve();
  }

  return runPanelSizeAnimation(panel, targetSize, durationMs);
}

export function animatePanelSizes(
  animations: Array<{
    panel: AnimatablePanelInstance | null | undefined;
    targetSize: number;
  }>,
  durationMs = INFO_PANEL_LAYOUT.SIZE_TRANSITION_MS,
): Promise<void> {
  return Promise.all(
    animations.map(({ panel, targetSize }) => animatePanelSize(panel, targetSize, durationMs)),
  ).then(() => undefined);
}
