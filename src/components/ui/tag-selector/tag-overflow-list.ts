// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const TAG_OVERFLOW_GAP_PX = 4;

export interface TagOverflowItem {
  id: string;
  name: string;
  color?: string;
  style?: Record<string, string>;
}

export interface TagOverflowVisibleCount {
  visibleCount: number;
  hiddenCount: number;
}

export function getTagOverflowVisibleCount(options: {
  tagWidths: number[];
  moreBadgeWidth: number;
  availableWidth: number;
  gap?: number;
}): TagOverflowVisibleCount {
  const tagWidths = options.tagWidths;
  const tagCount = tagWidths.length;
  const gap = options.gap ?? TAG_OVERFLOW_GAP_PX;

  if (tagCount === 0) {
    return {
      visibleCount: 0,
      hiddenCount: 0,
    };
  }

  if (options.availableWidth <= 0) {
    return {
      visibleCount: tagCount,
      hiddenCount: 0,
    };
  }

  let totalWidth = gap * Math.max(0, tagCount - 1);

  for (const tagWidth of tagWidths) {
    totalWidth += tagWidth;
  }

  if (totalWidth <= options.availableWidth) {
    return {
      visibleCount: tagCount,
      hiddenCount: 0,
    };
  }

  let usedWidth = 0;
  let visibleCount = 0;

  for (const tagWidth of tagWidths) {
    if (visibleCount === 0) {
      usedWidth = tagWidth;
      visibleCount = 1;
      continue;
    }

    const widthWithTagAndMore = usedWidth + gap + tagWidth + gap + options.moreBadgeWidth;

    if (widthWithTagAndMore <= options.availableWidth) {
      usedWidth += gap + tagWidth;
      visibleCount += 1;
      continue;
    }

    break;
  }

  return {
    visibleCount,
    hiddenCount: tagCount - visibleCount,
  };
}
