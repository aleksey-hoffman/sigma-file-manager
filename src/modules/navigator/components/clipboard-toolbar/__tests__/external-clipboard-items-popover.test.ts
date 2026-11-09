// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent, ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import { useFileBrowserDragSession } from '@/modules/navigator/components/file-browser/composables/use-file-browser-drag-session';
import ExternalClipboardItemsPopover from '../external-clipboard-items-popover.vue';
import {
  externalClipboardContextKey,
  type ExternalClipboardContext,
  type ExternalClipboardPasteTarget,
} from '../external-clipboard-context';

const invokeMock = vi.hoisted(() => vi.fn());
const convertFileSrcMock = vi.hoisted(() => vi.fn((path: string) => `asset://${path}`));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      clipboard: {
        showToolbarForExternalImages: true,
        showToolbarForExternalPaths: true,
      },
    },
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => convertFileSrcMock(path),
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@tauri-apps/api/path', () => ({
  resolveResource: vi.fn(() => Promise.resolve('icon.png')),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    onFocusChanged: vi.fn(() => Promise.resolve(() => {})),
  }),
}));

vi.mock('@crabnebula/tauri-plugin-drag', () => ({
  startDrag: vi.fn(),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => (key === 'image' ? 'Image' : key),
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

const SlotStub = defineComponent({
  template: '<div><slot /></div>',
});

type SavedClipboardImage = {
  path: string;
  sizeBytes: number;
};

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

function createContext(pasteTargets: ExternalClipboardPasteTarget[]): ExternalClipboardContext {
  return {
    pasteTargets: ref(pasteTargets),
    pasteClipboard: vi.fn(() => Promise.resolve()),
    copyEntriesTo: vi.fn(() => Promise.resolve()),
    copyClipboardImageTo: vi.fn(() => Promise.resolve()),
  };
}

const singlePaneTargets: ExternalClipboardPasteTarget[] = [{
  paneIndex: null,
  path: 'C:/Target',
}];

const splitViewTargets: ExternalClipboardPasteTarget[] = [
  {
    paneIndex: 0,
    path: 'C:/Left',
  },
  {
    paneIndex: 1,
    path: 'C:/Right',
  },
];

async function setExternalFileClipboard(entries: DirEntry[], operation: 'copy' | 'move' = 'copy') {
  invokeMock.mockImplementation(async (commandName: string, args?: { path?: string }) => {
    if (commandName === 'read_system_clipboard_files') {
      return {
        paths: entries.map(entry => entry.path),
        operation,
      };
    }

    if (commandName === 'paths_are_directories') {
      return entries.map(entry => entry.is_dir);
    }

    if (commandName === 'get_dir_entry_with_timeout') {
      return entries.find(entry => entry.path === args?.path);
    }

    return undefined;
  });

  const clipboardStore = useClipboardStore();
  await clipboardStore.syncFromSystemClipboard();
  return clipboardStore;
}

function mountPopover(context: ExternalClipboardContext, open = true) {
  return mount(ExternalClipboardItemsPopover, {
    attachTo: document.body,
    props: { open },
    global: {
      provide: {
        [externalClipboardContextKey as symbol]: context,
      },
      stubs: {
        PopoverContent: SlotStub,
        ScrollArea: SlotStub,
      },
    },
  });
}

describe('external clipboard items popover', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    convertFileSrcMock.mockClear();
    invokeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    useFileBrowserDragSession().cancelDrag();
    document.body.innerHTML = '';
  });

  it('renders each item as a card with one paste button and no discard', async () => {
    await setExternalFileClipboard([
      createDirEntry({
        name: 'infusion-demo.mp4',
        ext: 'mp4',
        path: 'C:/Users/aleks/Videos/infusion-demo.mp4',
        mime: 'video/mp4',
      }),
      createDirEntry({
        name: 'notes.md',
        path: 'C:/Users/aleks/Documents/notes.md',
      }),
    ]);

    const wrapper = mountPopover(createContext(singlePaneTargets));
    const cards = wrapper.findAll('.external-clipboard-card');

    expect(cards).toHaveLength(2);
    expect(cards[0].find('.external-clipboard-card__name').text()).toBe('infusion-demo.mp4');
    expect(cards[0].find('.external-clipboard-card__details').text()).toBe('Videos · 100 B');
    expect(cards[0].attributes('title')).toBe('C:/Users/aleks/Videos/infusion-demo.mp4');
    expect(cards[0].findAll('button')).toHaveLength(1);
    expect(cards[0].find('button').attributes('aria-label')).toBe('fileBrowser.actions.paste');
    expect(wrapper.text()).not.toContain('fileBrowser.removeFromClipboard');
  });

  it('pastes one card into the active pane without removing it from the list', async () => {
    const entry = createDirEntry({ path: 'C:/Source/one.txt' });
    const clipboardStore = await setExternalFileClipboard([entry, createDirEntry({ path: 'C:/Source/two.txt' })]);
    const context = createContext(singlePaneTargets);
    const wrapper = mountPopover(context);

    await wrapper.find('.external-clipboard-card__paste').trigger('click');

    expect(context.copyEntriesTo).toHaveBeenCalledWith([entry], 'C:/Target');
    expect(context.pasteClipboard).not.toHaveBeenCalled();
    expect(clipboardStore.clipboardItems.map(item => item.path)).toEqual(['C:/Source/one.txt', 'C:/Source/two.txt']);
  });

  it('shows one paste button per pane in split view and targets that pane', async () => {
    const entry = createDirEntry({ path: 'C:/Source/one.txt' });
    await setExternalFileClipboard([entry]);
    const context = createContext(splitViewTargets);
    const wrapper = mountPopover(context);
    const pasteButtons = wrapper.findAll('.external-clipboard-card__paste');

    expect(pasteButtons.map(button => button.attributes('aria-label'))).toEqual([
      'fileBrowser.actions.pasteToPane1',
      'fileBrowser.actions.pasteToPane2',
    ]);
    expect(pasteButtons.map(button => button.text())).toEqual(['1', '2']);

    await pasteButtons[1].trigger('click');

    expect(context.copyEntriesTo).toHaveBeenCalledWith([entry], 'C:/Right');
  });

  it('disables a pane paste target that is inside the copied folder', async () => {
    await setExternalFileClipboard([
      createDirEntry({
        name: 'Left',
        path: 'C:/Left',
        is_dir: true,
        is_file: false,
      }),
    ]);

    const wrapper = mountPopover(createContext(splitViewTargets));
    const pasteButtons = wrapper.findAll('.external-clipboard-card__paste');

    expect(pasteButtons[0].attributes('disabled')).toBeDefined();
    expect(pasteButtons[1].attributes('disabled')).toBeUndefined();
  });

  it('renders image clipboard content and copies it without discarding', async () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboardImage({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      tempPath: 'C:/Temp/clipboard-image.png',
      tempVersion: 42,
      savedSizeBytes: 7864320,
    });
    const context = createContext(singlePaneTargets);
    const wrapper = mountPopover(context);

    expect(wrapper.find('.external-clipboard-card__name').text()).toBe('Image');
    expect(wrapper.find('.external-clipboard-card__details').text()).toBe('252 x 358 · 7.5 MB');
    expect(wrapper.find('.external-clipboard-card__preview-image').attributes('src')).toBe('asset://C:/Temp/clipboard-image.png?v=42');

    await wrapper.find('.external-clipboard-card__paste').trigger('click');

    expect(context.copyClipboardImageTo).toHaveBeenCalledWith('C:/Target');
    expect(clipboardStore.hasImageContent).toBe(true);
  });

  it('saves a new clipboard image preview while the popover stays open', async () => {
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

    const wrapper = mountPopover(createContext(singlePaneTargets));

    clipboardStore.setClipboardImage({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      clipboardSequence: 2,
    });
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.external-clipboard-card__details').text()).toBe('252 x 358');
    expect(wrapper.find('.external-clipboard-card__preview-image').exists()).toBe(false);

    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find('.external-clipboard-card__details').text()).toBe('252 x 358 · 7.5 MB');
    expect(wrapper.find('.external-clipboard-card__preview-image').attributes('src')).toContain(
      'asset://C:/Temp/clipboard-image.png',
    );
  });

  it('drags a card as a locked copy and keeps it in the list after the drop', async () => {
    const entry = createDirEntry({ path: 'C:/Source/one.txt' });
    const clipboardStore = await setExternalFileClipboard([entry]);
    const context = createContext(splitViewTargets);
    const wrapper = mountPopover(context);
    const dragSession = useFileBrowserDragSession();
    document.elementFromPoint = vi.fn(() => null);

    await wrapper.find('.external-clipboard-card').trigger('mousedown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 40,
      clientY: 40,
    }));
    await wrapper.vm.$nextTick();

    expect(dragSession.dragState.value.isActive).toBe(true);
    expect(dragSession.dragState.value.items).toEqual([entry]);
    expect(dragSession.dragState.value.operationType).toBe('copy');
    expect(dragSession.dragState.value.isOperationLocked).toBe(true);
    expect(wrapper.find('.external-clipboard-items-popover--dragging').exists()).toBe(true);

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 60,
      clientY: 60,
    }));

    expect(dragSession.dragState.value.operationType).toBe('copy');

    dragSession.dropOn('C:/Right', 'move');
    await flushPromises();

    expect(context.copyEntriesTo).toHaveBeenCalledWith([entry], 'C:/Right');
    expect(clipboardStore.clipboardItems).toEqual([entry]);
    expect(wrapper.findAll('.external-clipboard-card')).toHaveLength(1);
  });

  it('waits for the clipboard image file before dragging an image card', async () => {
    let resolveImageSave: (savedImage: SavedClipboardImage) => void = () => {};

    invokeMock.mockImplementation((commandName: string) => {
      if (commandName === 'save_system_clipboard_image_to_temp') {
        return new Promise((resolve) => {
          resolveImageSave = resolve;
        });
      }

      return Promise.resolve(undefined);
    });
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboardImage({
      width: 252,
      height: 358,
      sizeBytes: 360864,
      clipboardSequence: 3,
    });
    const wrapper = mountPopover(createContext(singlePaneTargets));
    const dragSession = useFileBrowserDragSession();
    document.elementFromPoint = vi.fn(() => null);

    await wrapper.find('.external-clipboard-card').trigger('mousedown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 40,
      clientY: 40,
    }));

    expect(dragSession.dragState.value.isActive).toBe(false);

    resolveImageSave({
      path: 'C:/Temp/clipboard-image.png',
      sizeBytes: 7864320,
    });
    await flushPromises();
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 50,
      clientY: 50,
    }));

    expect(dragSession.dragState.value.isActive).toBe(true);
    expect(dragSession.dragState.value.items.map(item => item.path)).toEqual(['C:/Temp/clipboard-image.png']);
  });

  it('does not start a drag from the paste buttons', async () => {
    await setExternalFileClipboard([createDirEntry()]);
    const wrapper = mountPopover(createContext(singlePaneTargets));
    const dragSession = useFileBrowserDragSession();

    await wrapper.find('.external-clipboard-card__paste').trigger('mousedown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 40,
      clientY: 40,
    }));

    expect(dragSession.dragState.value.isActive).toBe(false);
  });
});
