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
  isFileBrowserFilterOpeningKey,
  isFileBrowserFilterTypingInProgress,
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

function pressKey(key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
  return event;
}

describe('isFileBrowserFilterOpeningKey', () => {
  it('accepts letters and numbers from non-English keyboard layouts', () => {
    expect(isFileBrowserFilterOpeningKey('ф')).toBe(true);
    expect(isFileBrowserFilterOpeningKey('Ж')).toBe(true);
    expect(isFileBrowserFilterOpeningKey('中')).toBe(true);
    expect(isFileBrowserFilterOpeningKey('文')).toBe(true);
    expect(isFileBrowserFilterOpeningKey('٥')).toBe(true);
  });

  it('accepts characters that file names often start with', () => {
    expect(isFileBrowserFilterOpeningKey('.')).toBe(true);
    expect(isFileBrowserFilterOpeningKey('_')).toBe(true);
    expect(isFileBrowserFilterOpeningKey('-')).toBe(true);
  });

  it('rejects non-text keys, spaces and other punctuation', () => {
    expect(isFileBrowserFilterOpeningKey('ArrowDown')).toBe(false);
    expect(isFileBrowserFilterOpeningKey('Backspace')).toBe(false);
    expect(isFileBrowserFilterOpeningKey(' ')).toBe(false);
    expect(isFileBrowserFilterOpeningKey('/')).toBe(false);
  });
});

describe('useFileBrowserFilter', () => {
  let mountedWrapper: VueWrapper | null = null;

  afterEach(() => {
    mountedWrapper?.unmount();
    mountedWrapper = null;
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it('keeps punctuation and spaces while typing a file name', async () => {
    const { wrapper, filter } = createFilterHarness();
    mountedWrapper = wrapper;

    for (const key of 'my report_v1-final (2).pdf') {
      pressKey(key);
    }

    expect(filter.filterQuery.value).toBe('my report_v1-final (2).pdf');
  });

  it('leaves space to quick view after a pause in typing', async () => {
    vi.useFakeTimers();
    const { wrapper, filter } = createFilterHarness();
    mountedWrapper = wrapper;
    pressKey('a');
    expect(isFileBrowserFilterTypingInProgress()).toBe(true);

    vi.advanceTimersByTime(1500);

    expect(isFileBrowserFilterTypingInProgress()).toBe(false);
    expect(pressKey(' ').defaultPrevented).toBe(false);
    expect(filter.filterQuery.value).toBe('a');
  });

  it('does not open quick search on space', async () => {
    const { wrapper, filter } = createFilterHarness();
    mountedWrapper = wrapper;

    pressKey(' ');

    expect(filter.isFilterOpen.value).toBe(false);
  });

  it('opens quick search when typing a Russian letter outside text fields', async () => {
    const { wrapper, filter } = createFilterHarness();
    mountedWrapper = wrapper;

    pressKey('ф');
    await nextTick();

    expect(filter.isFilterOpen.value).toBe(true);
    expect(filter.filterQuery.value).toBe('ф');
  });
});
