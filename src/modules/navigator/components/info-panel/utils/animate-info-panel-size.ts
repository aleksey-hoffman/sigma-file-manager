// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { INFO_PANEL_LAYOUT, INFO_PANEL_VISIBILITY_EASE } from '@/modules/navigator/constants/info-panel';

export type AnimatablePanelInstance = {
  getSize: () => number;
  resize: (size: number) => void;
};

function sampleCubicBezierCoordinate(time: number, control1: number, control2: number): number {
  const inverse = 1 - time;

  return (3 * inverse * inverse * time * control1)
    + (3 * inverse * time * time * control2)
    + (time * time * time);
}

export function getPanelSizeEaseProgress(progress: number): number {
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  if (clampedProgress === 0 || clampedProgress === 1) {
    return clampedProgress;
  }

  let rangeStart = 0;
  let rangeEnd = 1;
  let time = clampedProgress;

  for (let step = 0; step < 12; step += 1) {
    const x = sampleCubicBezierCoordinate(time, INFO_PANEL_VISIBILITY_EASE.x1, INFO_PANEL_VISIBILITY_EASE.x2);

    if (Math.abs(x - clampedProgress) < 0.0001) {
      break;
    }

    if (x < clampedProgress) {
      rangeStart = time;
    }
    else {
      rangeEnd = time;
    }

    time = (rangeStart + rangeEnd) / 2;
  }

  return sampleCubicBezierCoordinate(time, INFO_PANEL_VISIBILITY_EASE.y1, INFO_PANEL_VISIBILITY_EASE.y2);
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
      const easedProgress = getPanelSizeEaseProgress(progress);
      const currentSize = Math.max(0, startSize + (roundedTarget - startSize) * easedProgress);

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
