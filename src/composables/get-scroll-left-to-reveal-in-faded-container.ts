// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function getScrollLeftToRevealInFadedContainer(params: {
  containerScrollLeft: number;
  containerClientWidth: number;
  containerScrollWidth: number;
  elementOffsetLeft: number;
  elementWidth: number;
  fadeWidth: number;
}): number {
  const maxScrollLeft = Math.max(0, params.containerScrollWidth - params.containerClientWidth);
  const fadeWidth = Math.max(0, params.fadeWidth);
  const elementRight = params.elementOffsetLeft + params.elementWidth;
  const hasLeftFade = params.containerScrollLeft > 0;
  const hasRightFade = params.containerScrollLeft < maxScrollLeft;
  const unfadedLeft = params.containerScrollLeft + (hasLeftFade ? fadeWidth : 0);
  const unfadedRight = params.containerScrollLeft + params.containerClientWidth
    - (hasRightFade ? fadeWidth : 0);

  if (params.elementOffsetLeft >= unfadedLeft && elementRight <= unfadedRight) {
    return params.containerScrollLeft;
  }

  if (params.elementOffsetLeft < unfadedLeft) {
    return clampScrollLeft(params.elementOffsetLeft - fadeWidth, maxScrollLeft);
  }

  return clampScrollLeft(
    elementRight + fadeWidth - params.containerClientWidth,
    maxScrollLeft,
  );
}

function clampScrollLeft(scrollLeft: number, maxScrollLeft: number): number {
  return Math.min(maxScrollLeft, Math.max(0, scrollLeft));
}
