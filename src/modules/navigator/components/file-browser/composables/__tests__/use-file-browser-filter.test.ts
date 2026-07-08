// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, nextTick } from 'vue';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  isFileBrowserFilterTypingKey,
  useFileBrowserFilter,
} from '../use-file-browser-filter';

function createDismissalLayerStore() {
  return {
    registerLayer: vi.fn(() => 'filter-layer'),
    unregisterLayer: vi.fn(),
    layers: new Map(),
    hasLayerOfType: vi.fn(() => false),
  };
}

function createFilterHarness() {
  const dismissalLayerStore = createDismissalLayerStore();
  const globalSearchStore = {
    isOpen: false,
  };
  let filter = {} as ReturnType<typeof useFileBrowserFilter>;

  const wrapper = mount(defineComponent({
    setup() {
      filter = useFileBrowserFilter({
        dismissalLayerStore,
        globalSearchStore,
        isDefaultPane: true,
      });

      return {};
    },
    template: '<div />',
  }));

  return {
    wrapper,
    filter,
  };
}

describe('isFileBrowserFilterTypingKey', () => {
  it('accepts letters and numbers from non-English keyboard layouts', () => {
    expect(isFileBrowserFilterTypingKey('ф')).toBe(true);
    expect(isFileBrowserFilterTypingKey('Ж')).toBe(true);
    expect(isFileBrowserFilterTypingKey('中')).toBe(true);
    expect(isFileBrowserFilterTypingKey('文')).toBe(true);
    expect(isFileBrowserFilterTypingKey('٥')).toBe(true);
  });

  it('rejects non-text keys and punctuation', () => {
    expect(isFileBrowserFilterTypingKey('ArrowDown')).toBe(false);
    expect(isFileBrowserFilterTypingKey('Backspace')).toBe(false);
    expect(isFileBrowserFilterTypingKey(' ')).toBe(false);
    expect(isFileBrowserFilterTypingKey('-')).toBe(false);
  });
});

describe('useFileBrowserFilter', () => {
  let mountedWrapper: VueWrapper | null = null;

  afterEach(() => {
    mountedWrapper?.unmount();
    mountedWrapper = null;
    document.body.replaceChildren();
  });

  it('opens quick search when typing a Russian letter outside text fields', async () => {
    const { wrapper, filter } = createFilterHarness();
    mountedWrapper = wrapper;

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ф',
      bubbles: true,
      cancelable: true,
    }));
    await nextTick();

    expect(filter.isFilterOpen.value).toBe(true);
    expect(filter.filterQuery.value).toBe('ф');
  });
});
