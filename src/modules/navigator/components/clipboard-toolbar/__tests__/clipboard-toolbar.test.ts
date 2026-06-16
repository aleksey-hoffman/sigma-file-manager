// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import ClipboardToolbar from '../clipboard-toolbar.vue';

const invokeMock = vi.hoisted(() => vi.fn());
const convertFileSrcMock = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => convertFileSrcMock(path),
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'fileBrowser.itemsPrepared') {
        return `${values?.count ?? 0} items`;
      }

      if (key === 'image') {
        return 'Image';
      }

      return key;
    },
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: (key: string, values?: Record<string, unknown>) => {
        if (key === 'fileBrowser.itemsPrepared') {
          return `${values?.count ?? 0} items`;
        }

        return key;
      },
    },
  },
}));

vi.mock('@/stores/runtime/shortcuts', () => ({
  useShortcutsStore: () => ({
    getShortcutLabel: (shortcutId: string) => shortcutId,
  }),
}));

const SlotStub = defineComponent({
  template: '<div><slot /></div>',
});

const ButtonStub = defineComponent({
  template: '<button v-bind="$attrs"><slot /></button>',
});

const InputStub = defineComponent({
  template: '<input />',
});

function createDirEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'file.txt',
    ext: 'txt',
    path: 'C:/Source/file.txt',
    size: 100,
    item_count: null,
    modified_time: 1,
    accessed_time: 1,
    created_time: 1,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
    ...overrides,
  };
}

function mountToolbar() {
  return mount(ClipboardToolbar, {
    props: {
      currentPath: 'C:/Target',
    },
    global: {
      stubs: {
        Button: ButtonStub,
        ContextMenuShortcut: SlotStub,
        DropdownMenu: SlotStub,
        DropdownMenuContent: SlotStub,
        DropdownMenuItem: SlotStub,
        DropdownMenuTrigger: SlotStub,
        Input: InputStub,
        PopoverContent: SlotStub,
        ScrollArea: SlotStub,
        Tooltip: SlotStub,
        TooltipContent: SlotStub,
        TooltipTrigger: SlotStub,
        Transition: false,
      },
    },
  });
}

describe('clipboard toolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    convertFileSrcMock.mockClear();
    invokeMock.mockResolvedValue(undefined);
  });

  it('renders image clipboard content with dimensions', () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboardImage({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      tempPath: 'C:/Temp/clipboard-image.png',
      tempVersion: 42,
      savedSizeBytes: 7864320,
    });

    const wrapper = mountToolbar();

    expect(wrapper.text()).toContain('fileBrowser.preparedForCopying');
    expect(wrapper.text()).toContain('1 items');
    expect(wrapper.text()).toContain('Image');
    expect(wrapper.text()).toContain('252 x 358 · 7.5 MB');
    expect(wrapper.find('.clipboard-toolbar__item-preview-image').attributes('src')).toBe('asset://C:/Temp/clipboard-image.png?v=42');
  });

  it('toggles the items popover from the show items button', async () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboard('copy', [createDirEntry()]);
    const wrapper = mountToolbar();
    const showItemsButton = wrapper.findAll('button').find(button => button.text().includes('showItems'));

    if (!showItemsButton) {
      throw new Error('Show items button was not rendered');
    }

    expect(showItemsButton.attributes('aria-expanded')).toBe('false');

    await showItemsButton.trigger('click');
    expect(showItemsButton.attributes('aria-expanded')).toBe('true');

    await showItemsButton.trigger('click');
    expect(showItemsButton.attributes('aria-expanded')).toBe('false');
  });

  it('renders generated previews for image file clipboard entries', async () => {
    invokeMock.mockImplementation((commandName: string) => {
      if (commandName === 'generate_image_thumbnail') {
        return Promise.resolve('C:/Thumbs/photo.png');
      }

      return Promise.resolve(undefined);
    });

    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboard('copy', [
      createDirEntry({
        name: 'photo.png',
        ext: 'png',
        path: 'C:/Source/photo.png',
        mime: 'image/png',
      }),
    ]);

    const wrapper = mountToolbar();
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.clipboard-toolbar__item-preview-image').attributes('src')).toBe('asset://C:/Thumbs/photo.png');
  });
});
