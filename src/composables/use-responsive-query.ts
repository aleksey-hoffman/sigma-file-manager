// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  toValue,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';
import { useElementSize, useMediaQuery } from '@vueuse/core';
import { UI_CONSTANTS } from '@/constants';

type ContainerQueryPredicate = (width: number) => boolean;

export const RESPONSIVE_MEDIA_QUERIES = {
  smallScreen: `(max-width: ${UI_CONSTANTS.SMALL_SCREEN_BREAKPOINT}px)`,
} as const;

export const RESPONSIVE_CONTAINER_WIDTHS = {
  fileBrowserToolbarAddressBarWrap: UI_CONSTANTS.FILE_BROWSER_TOOLBAR_ADDRESS_BAR_WRAP_WIDTH,
  fileBrowserToolbarNavCollapse: UI_CONSTANTS.FILE_BROWSER_TOOLBAR_NAV_COLLAPSE_WIDTH,
} as const;

export function useResponsiveMediaQuery(query: MaybeRefOrGetter<string>) {
  return useMediaQuery(query);
}

export function useIsSmallScreen() {
  return useResponsiveMediaQuery(RESPONSIVE_MEDIA_QUERIES.smallScreen);
}

export function useContainerWidthQuery(
  containerRef: Ref<HTMLElement | null>,
  predicate: ContainerQueryPredicate,
) {
  const { width } = useElementSize(containerRef);

  return computed(() => predicate(width.value));
}

export function useContainerMaxWidth(
  containerRef: Ref<HTMLElement | null>,
  maxWidth: MaybeRefOrGetter<number>,
) {
  return useContainerWidthQuery(containerRef, width => width < toValue(maxWidth));
}
