// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type StaggerAnimationOptions = {
  stepMs?: number;
  initialDelayMs?: number;
  maxStaggeredItems?: number;
};

export const STAGGER_SLIDE_UP_CLASS = 'animate-stagger-slide-up';

const defaultStepMs = 48;
const defaultInitialDelayMs = 0;
const defaultMaxStaggeredItems = 48;

export function getStaggerAnimationDelayMs(
  index: number,
  options?: StaggerAnimationOptions,
): number {
  const stepMs = options?.stepMs ?? defaultStepMs;
  const initialDelayMs = options?.initialDelayMs ?? defaultInitialDelayMs;
  const maxStaggeredItems = options?.maxStaggeredItems ?? defaultMaxStaggeredItems;
  const clampedIndex = Math.min(Math.max(0, index), maxStaggeredItems);
  return initialDelayMs + clampedIndex * stepMs;
}

export function getStaggerAnimationStyle(
  index: number,
  options?: StaggerAnimationOptions,
): { animationDelay: string } {
  return {
    animationDelay: `${getStaggerAnimationDelayMs(index, options)}ms`,
  };
}

export function getStaggerSlideUpBinding(
  index: number,
  options?: StaggerAnimationOptions,
): {
  class: string;
  style: { animationDelay: string };
} {
  return {
    class: STAGGER_SLIDE_UP_CLASS,
    style: getStaggerAnimationStyle(index, options),
  };
}

export const DASHBOARD_CONTENT_ENTRANCE_CLASS = 'animate-dashboard-content';
export const DASHBOARD_CONTENT_ENTRANCE_DELAY_MS = 40;
export const DASHBOARD_CONTENT_ENTRANCE_DURATION_MS = 160;

export const DASHBOARD_CARD_ENTRANCE: StaggerAnimationOptions = {
  initialDelayMs: DASHBOARD_CONTENT_ENTRANCE_DELAY_MS + DASHBOARD_CONTENT_ENTRANCE_DURATION_MS,
  stepMs: defaultStepMs,
};

export function getDashboardContentEntranceBinding(): {
  class: string;
  style: { animationDelay: string; animationDuration: string };
} {
  return {
    class: DASHBOARD_CONTENT_ENTRANCE_CLASS,
    style: {
      animationDelay: `${DASHBOARD_CONTENT_ENTRANCE_DELAY_MS}ms`,
      animationDuration: `${DASHBOARD_CONTENT_ENTRANCE_DURATION_MS}ms`,
    },
  };
}
