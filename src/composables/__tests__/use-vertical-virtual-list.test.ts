// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  computed,
  defineComponent,
  h,
  ref,
  type ComponentPublicInstance,
  type Ref,
} from 'vue';
import {
  computeVerticalVirtualRange,
  createVerticalVirtualItems,
  useVerticalVirtualList,
} from '@/composables/use-vertical-virtual-list';

describe('createVerticalVirtualItems', () => {
  it('positions variable-height items consecutively', () => {
    const items = createVerticalVirtualItems(
      [
        {
          id: 'heading',
          height: 28,
        },
        {
          id: 'first',
          height: 32,
        },
        {
          id: 'second',
          height: 32,
        },
      ],
      item => item.height,
    );

    expect(items).toEqual([
      {
        index: 0,
        item: {
          id: 'heading',
          height: 28,
        },
        size: 28,
        start: 0,
      },
      {
        index: 1,
        item: {
          id: 'first',
          height: 32,
        },
        size: 32,
        start: 28,
      },
      {
        index: 2,
        item: {
          id: 'second',
          height: 32,
        },
        size: 32,
        start: 60,
      },
    ]);
  });
});

describe('computeVerticalVirtualRange', () => {
  const items = createVerticalVirtualItems(
    Array.from({ length: 100 }, (_, index) => index),
    () => 32,
  );

  it('returns only rows near the viewport', () => {
    expect(computeVerticalVirtualRange({
      items,
      overscanPx: 0,
      scrollTop: 320,
      viewportHeight: 96,
    })).toEqual({
      start: 10,
      end: 13,
    });
  });

  it('includes pixel overscan on both sides', () => {
    expect(computeVerticalVirtualRange({
      items,
      overscanPx: 64,
      scrollTop: 320,
      viewportHeight: 96,
    })).toEqual({
      start: 8,
      end: 15,
    });
  });

  it('clamps stale scroll positions after the list shrinks', () => {
    const shortItems = items.slice(0, 3);

    expect(computeVerticalVirtualRange({
      items: shortItems,
      overscanPx: 0,
      scrollTop: 320,
      viewportHeight: 96,
    })).toEqual({
      start: 0,
      end: 3,
    });
  });
});

describe('useVerticalVirtualList', () => {
  it('resolves an exposed scroll-area viewport and limits rendered items', () => {
    const viewport = document.createElement('div');
    Object.defineProperty(viewport, 'clientHeight', {
      configurable: true,
      value: 320,
    });

    const viewportComponent = {
      viewportElement: ref(viewport),
    } as unknown as ComponentPublicInstance & {
      viewportElement: Ref<HTMLElement | null>;
    };

    const wrapper = mount(defineComponent({
      setup() {
        const items = computed(() =>
          Array.from({ length: 5_000 }, (_, index) => index));
        const virtualList = useVerticalVirtualList({
          items,
          getItemSize: () => 32,
        });

        virtualList.setScrollViewportRef(viewportComponent);

        return () => h(
          'div',
          virtualList.visibleItems.value.map(item =>
            h('div', {
              key: item.index,
              class: 'virtual-row',
            })),
        );
      },
    }));

    expect(wrapper.findAll('.virtual-row').length).toBeGreaterThan(0);
    expect(wrapper.findAll('.virtual-row').length).toBeLessThan(30);

    wrapper.unmount();
  });
});
