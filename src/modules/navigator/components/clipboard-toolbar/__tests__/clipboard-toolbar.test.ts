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
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import ClipboardToolbar from '../clipboard-toolbar.vue';

const invokeMock = vi.hoisted(() => vi.fn());
const convertFileSrcMock = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));
const clipboardSettingsMock = vi.hoisted(() => ({
  showToolbarForExternalImages: true,
  showToolbarForExternalPaths: true,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      clipboard: clipboardSettingsMock,
    },
  }),
}));

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
    expect(wrapper.text()).toContain('252 x 358');
    expect(wrapper.text()).toContain('7.5 MB');
    expect(wrapper.find('.clipboard-items-popover__preview-image').attributes('src')).toBe('asset://C:/Temp/clipboard-image.png?v=42');
    expect(wrapper.find('.clipboard-items-popover__item-path').text()).toBe('252 x 358');
    expect(wrapper.find('.clipboard-items-popover__item-size').text()).toBe('7.5 MB');
  });

  it('renders the parent directory so file paths stay readable', () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboard('copy', [
      createDirEntry({
        name: 'infusion-demo.mp4',
        ext: 'mp4',
        path: 'C:/Users/aleks/Videos/infusion-demo.mp4',
        mime: 'video/mp4',
      }),
    ]);

    const wrapper = mountToolbar();

    expect(wrapper.find('.clipboard-items-popover__item-name').text()).toBe('infusion-demo.mp4');
    expect(wrapper.find('.clipboard-items-popover__item-path').text()).toBe('C:/Users/aleks/Videos');
    expect(wrapper.find('.clipboard-items-popover__item-size').text()).toBe('100 B');
    expect(wrapper.find('.clipboard-items-popover__item-path').attributes('title')).toBe(
      'C:/Users/aleks/Videos/infusion-demo.mp4',
    );
    expect(wrapper.find('.clipboard-items-popover__filter').exists()).toBe(false);
  });

  it('renders a cached folder size without requesting a new calculation', () => {
    const folderPath = 'C:/Users/aleks/Videos';
    const dirSizesStore = useDirSizesStore();
    dirSizesStore.sizes.set(folderPath, {
      size: 1048576,
      status: 'Complete',
      fileCount: 3,
      dirCount: 1,
      calculatedAt: 1,
    });

    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboard('copy', [
      createDirEntry({
        name: 'Videos',
        path: folderPath,
        size: 0,
        is_file: false,
        is_dir: true,
      }),
    ]);

    const wrapper = mountToolbar();

    expect(wrapper.find('.clipboard-items-popover__item-size').text()).toBe('1.0 MB');
    expect(invokeMock).not.toHaveBeenCalledWith('get_dir_size', expect.anything());
    expect(invokeMock).not.toHaveBeenCalledWith('get_dir_sizes_batch', expect.anything());
  });

  it('shows the filter when more than one clipboard item is prepared', () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboard('copy', [
      createDirEntry({
        name: 'one.txt',
        path: 'C:/Users/aleks/Documents/one.txt',
      }),
      createDirEntry({
        name: 'two.txt',
        path: 'C:/Users/aleks/Downloads/two.txt',
      }),
    ]);

    const wrapper = mountToolbar();

    expect(wrapper.find('.clipboard-items-popover__filter').exists()).toBe(true);
    expect(wrapper.findAll('.clipboard-items-popover__item-path').map(path => path.text())).toEqual([
      'C:/Users/aleks/Documents',
      'C:/Users/aleks/Downloads',
    ]);
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

  it('saves a new clipboard image preview while the items menu stays open', async () => {
    invokeMock.mockImplementation((commandName: string) => {
      if (commandName === 'save_system_clipboard_image_to_temp') {
        return Promise.resolve({
          path: 'C:/Temp/clipboard-image.png',
          sizeBytes: 7864320,
        });
      }

      return Promise.resolve(undefined);
    });

    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboardImage({
      width: 100,
      height: 80,
      sizeBytes: 1200,
      clipboardSequence: 1,
      tempPath: 'C:/Temp/old-clipboard-image.png',
      tempVersion: 7,
      savedSizeBytes: 2400,
    });

    const wrapper = mountToolbar();
    const showItemsButton = wrapper.findAll('button').find(button => button.text().includes('showItems'));

    if (!showItemsButton) {
      throw new Error('Show items button was not rendered');
    }

    await showItemsButton.trigger('click');

    clipboardStore.setClipboardImage({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      clipboardSequence: 2,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.clipboard-items-popover__item-path').text()).toBe('252 x 358');
    expect(wrapper.find('.clipboard-items-popover__item-size').exists()).toBe(false);
    expect(wrapper.find('.clipboard-items-popover__preview-image').exists()).toBe(false);

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.clipboard-items-popover__item-size').text()).toBe('7.5 MB');
    expect(wrapper.find('.clipboard-items-popover__preview-image').attributes('src')).toContain(
      'asset://C:/Temp/clipboard-image.png',
    );
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

    expect(wrapper.find('.clipboard-items-popover__preview-image').attributes('src')).toBe('asset://C:/Thumbs/photo.png');
  });
});
