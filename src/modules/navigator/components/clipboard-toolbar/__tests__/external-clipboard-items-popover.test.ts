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
import {
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';
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
    restFootprintPx: ref(0),
    pasteClipboard: vi.fn(() => Promise.resolve()),
    transferEntriesTo: vi.fn(() => Promise.resolve(true)),
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

function getPaneMenuItems() {
  return Array.from(document.body.querySelectorAll<HTMLElement>('.external-clipboard-paste-menu__item'));
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

enableAutoUnmount(afterEach);

describe('external clipboard items popover', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    convertFileSrcMock.mockClear();
    invokeMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    useFileBrowserDragSession().cancelDrag();
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
    expect(cards[0].attributes('title')).toBeUndefined();
    expect(cards[0].findAll('button')).toHaveLength(1);
    expect(cards[0].find('button').text()).toBe('fileBrowser.actions.paste');
    expect(wrapper.text()).not.toContain('fileBrowser.removeFromClipboard');
  });

  it('pastes one card into the active pane without removing it from the list', async () => {
    const entry = createDirEntry({ path: 'C:/Source/one.txt' });
    const clipboardStore = await setExternalFileClipboard([entry, createDirEntry({ path: 'C:/Source/two.txt' })]);
    const context = createContext(singlePaneTargets);
    const wrapper = mountPopover(context);

    await wrapper.find('.external-clipboard-paste-button').trigger('click');

    expect(context.transferEntriesTo).toHaveBeenCalledWith([entry], 'C:/Target', 'copy');
    expect(context.pasteClipboard).not.toHaveBeenCalled();
    expect(clipboardStore.clipboardItems.map(item => item.path)).toEqual(['C:/Source/one.txt', 'C:/Source/two.txt']);
  });

  it('picks the pane from the card paste dropdown in split view', async () => {
    const entry = createDirEntry({ path: 'C:/Source/one.txt' });
    const clipboardStore = await setExternalFileClipboard([entry]);
    const context = createContext(splitViewTargets);
    const wrapper = mountPopover(context);
    const pasteButtons = wrapper.findAll('.external-clipboard-paste-button');

    expect(pasteButtons).toHaveLength(1);
    expect(pasteButtons[0].text()).toBe('fileBrowser.actions.paste');
    expect(pasteButtons[0].find('.external-clipboard-paste-button__chevron').exists()).toBe(true);

    await pasteButtons[0].trigger('click');
    await flushPromises();

    expect(getPaneMenuItems().map(item => item.querySelector('.external-clipboard-paste-menu__item-label')?.textContent?.trim())).toEqual([
      'fileBrowser.actions.pasteToPane1',
      'fileBrowser.actions.pasteToPane2',
    ]);
    expect(getPaneMenuItems().map(item => item.querySelector('.external-clipboard-paste-menu__item-folder')?.textContent?.trim())).toEqual([
      'Left',
      'Right',
    ]);

    getPaneMenuItems()[1].click();
    await flushPromises();

    expect(context.transferEntriesTo).toHaveBeenCalledWith([entry], 'C:/Right', 'copy');
    expect(getPaneMenuItems()).toHaveLength(0);
    expect(clipboardStore.clipboardItems).toEqual([entry]);
  });

  it('moves a cut card and removes only that item from the clipboard', async () => {
    const firstEntry = createDirEntry({ path: 'C:/Left/one.txt' });
    const secondEntry = createDirEntry({ path: 'C:/Left/two.txt' });
    const clipboardStore = await setExternalFileClipboard([firstEntry, secondEntry], 'move');
    const context = createContext(splitViewTargets);
    const wrapper = mountPopover(context);

    await wrapper.findAll('.external-clipboard-paste-button')[0].trigger('click');
    await flushPromises();

    expect(getPaneMenuItems()[0].hasAttribute('data-disabled')).toBe(true);
    expect(getPaneMenuItems()[1].hasAttribute('data-disabled')).toBe(false);

    getPaneMenuItems()[1].click();
    await flushPromises();

    expect(context.transferEntriesTo).toHaveBeenCalledWith([firstEntry], 'C:/Right', 'move');
    expect(clipboardStore.clipboardItems.map(item => item.path)).toEqual(['C:/Left/two.txt']);
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

    await wrapper.find('.external-clipboard-paste-button').trigger('click');
    await flushPromises();

    expect(getPaneMenuItems()[0].hasAttribute('data-disabled')).toBe(true);
    expect(getPaneMenuItems()[1].hasAttribute('data-disabled')).toBe(false);
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

    await wrapper.find('.external-clipboard-paste-button').trigger('click');

    expect(context.copyClipboardImageTo).toHaveBeenCalledWith('C:/Target');
    expect(clipboardStore.hasImageContent).toBe(true);
  });

  it('displays the source app icon and name on item cards when known', () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboardImage(
      {
        width: 252,
        height: 358,
        sizeBytes: 360864,
        tempPath: 'C:/Temp/clipboard-image.png',
        tempVersion: 42,
        savedSizeBytes: 7864320,
      },
      'external',
      {
        processName: 'chrome.exe',
        processIconUrl: 'data:image/png;base64,chrome',
      },
    );

    const wrapper = mountPopover(createContext(singlePaneTargets));

    expect(wrapper.find('.external-clipboard-card__source-icon').attributes('src')).toBe('data:image/png;base64,chrome');
    expect(wrapper.find('.external-clipboard-card__details').text()).toBe('Chrome\u00A0· 252 x 358 · 7.5 MB');
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

    expect(context.transferEntriesTo).toHaveBeenCalledWith([entry], 'C:/Right', 'copy');
    expect(clipboardStore.clipboardItems).toEqual([entry]);
    expect(wrapper.findAll('.external-clipboard-card')).toHaveLength(1);
  });

  it('drags a cut card as a locked move and removes it after transfer', async () => {
    const firstEntry = createDirEntry({ path: 'C:/Source/one.txt' });
    const secondEntry = createDirEntry({ path: 'C:/Source/two.txt' });
    const clipboardStore = await setExternalFileClipboard([firstEntry, secondEntry], 'move');
    const context = createContext(splitViewTargets);
    const wrapper = mountPopover(context);
    const dragSession = useFileBrowserDragSession();
    document.elementFromPoint = vi.fn(() => null);

    await wrapper.findAll('.external-clipboard-card')[0].trigger('mousedown', {
      button: 0,
      clientX: 10,
      clientY: 10,
    });
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 40,
      clientY: 40,
    }));
    await wrapper.vm.$nextTick();

    expect(dragSession.dragState.value.operationType).toBe('move');
    expect(dragSession.dragState.value.isOperationLocked).toBe(true);

    dragSession.dropOn('C:/Right', 'copy');
    await flushPromises();

    expect(context.transferEntriesTo).toHaveBeenCalledWith([firstEntry], 'C:/Right', 'move');
    expect(clipboardStore.clipboardItems.map(item => item.path)).toEqual(['C:/Source/two.txt']);
  });

  it('shows a search filter when five or more items are in the external clipboard', async () => {
    const entries = Array.from({ length: 5 }, (_, index) => createDirEntry({
      name: `item-${index + 1}.txt`,
      path: `C:/Source/item-${index + 1}.txt`,
    }));
    await setExternalFileClipboard(entries);
    const wrapper = mountPopover(createContext(singlePaneTargets));

    const filterInput = wrapper.find('.external-clipboard-items-popover__filter-input');
    expect(filterInput.exists()).toBe(true);

    await filterInput.setValue('item-4');

    expect(wrapper.findAll('.external-clipboard-card')).toHaveLength(1);
    expect(wrapper.find('.external-clipboard-card__name').text()).toBe('item-4.txt');
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

    await wrapper.find('.external-clipboard-paste-button').trigger('mousedown', {
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
