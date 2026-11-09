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
import ExternalClipboardWidget from '../external-clipboard-widget.vue';
import {
  externalClipboardContextKey,
  type ExternalClipboardContext,
  type ExternalClipboardPasteTarget,
} from '../external-clipboard-context';

const invokeMock = vi.hoisted(() => vi.fn());
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
  convertFileSrc: (path: string) => `asset://${path}`,
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
    t: (key: string, values?: Record<string, unknown>) => {
      if (key === 'fileBrowser.itemsPrepared') {
        return `${values?.count ?? 0} items`;
      }

      return key;
    },
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

const ItemsPopoverStub = defineComponent({
  props: {
    open: Boolean,
  },
  template: '<div class="items-popover-stub" :data-open="String(open)" />',
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

function createContext(pasteTargets: ExternalClipboardPasteTarget[]): ExternalClipboardContext {
  return {
    pasteTargets: ref(pasteTargets),
    pasteClipboard: vi.fn(() => Promise.resolve()),
    copyEntriesTo: vi.fn(() => Promise.resolve()),
    copyClipboardImageTo: vi.fn(() => Promise.resolve()),
  };
}

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

function mountWidget(context = createContext([{
  paneIndex: null,
  path: 'C:/Target',
}])) {
  return mount(ExternalClipboardWidget, {
    attachTo: document.body,
    global: {
      provide: {
        [externalClipboardContextKey as symbol]: context,
      },
      stubs: {
        ExternalClipboardItemsPopover: ItemsPopoverStub,
      },
    },
  });
}

function getPasteButtons(wrapper: ReturnType<typeof mountWidget>) {
  return wrapper.findAll('.external-clipboard-paste-button');
}

function getPaneMenuItems() {
  return Array.from(document.body.querySelectorAll<HTMLElement>('.external-clipboard-paste-menu__item'));
}

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

enableAutoUnmount(afterEach);

describe('external clipboard widget', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    clipboardSettingsMock.showToolbarForExternalImages = true;
    clipboardSettingsMock.showToolbarForExternalPaths = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden for copies made in the app', () => {
    const clipboardStore = useClipboardStore();
    clipboardStore.setClipboard('copy', [createDirEntry()], { syncToSystemClipboard: false });

    const wrapper = mountWidget();

    expect(wrapper.find('.external-clipboard-widget').exists()).toBe(false);
  });

  it('stays hidden when the settings turn off file paths copied in other apps', async () => {
    clipboardSettingsMock.showToolbarForExternalPaths = false;
    await setExternalFileClipboard([createDirEntry()]);

    const wrapper = mountWidget();

    expect(wrapper.find('.external-clipboard-widget').exists()).toBe(false);
  });

  it('shows only the item count at rest', async () => {
    await setExternalFileClipboard([createDirEntry(), createDirEntry({ path: 'C:/Source/two.txt' })]);

    const wrapper = mountWidget();

    expect(wrapper.find('.external-clipboard-widget__rest').text()).toBe('2');
    expect(wrapper.find('.external-clipboard-widget__pill--expanded').exists()).toBe(false);
  });

  it('expands into a pill with title, item count subtitle, paste and discard on hover', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setExternalFileClipboard([createDirEntry(), createDirEntry({ path: 'C:/Source/two.txt' })]);
    const wrapper = mountWidget();
    const pill = wrapper.find('.external-clipboard-widget__pill');

    await pill.trigger('mouseenter');

    expect(pill.classes()).toContain('external-clipboard-widget__pill--expanded');
    expect(wrapper.find('.external-clipboard-widget__title').text()).toBe('fileBrowser.copiedInAnotherApp');
    expect(wrapper.find('.external-clipboard-widget__subtitle').text()).toBe('2 items');
    expect(getPasteButtons(wrapper).map(button => button.text())).toEqual(['fileBrowser.actions.paste']);
    expect(wrapper.find('.external-clipboard-paste-button__chevron').exists()).toBe(false);
    expect(wrapper.find('.external-clipboard-widget__discard').attributes('aria-label')).toBe('fileBrowser.discardClipboard');

    await pill.trigger('mouseleave');
    vi.runAllTimers();
    await wrapper.vm.$nextTick();

    expect(pill.classes()).not.toContain('external-clipboard-widget__pill--expanded');
  });

  it('pastes the whole clipboard into the active pane', async () => {
    await setExternalFileClipboard([createDirEntry()]);
    const context = createContext([{
      paneIndex: null,
      path: 'C:/Target',
    }]);
    const wrapper = mountWidget(context);

    await getPasteButtons(wrapper)[0].trigger('click');

    expect(context.pasteClipboard).toHaveBeenCalledWith(null);
  });

  it('picks the pane from the paste dropdown in split view and stays expanded', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setExternalFileClipboard([createDirEntry()]);
    const context = createContext(splitViewTargets);
    const wrapper = mountWidget(context);
    const pill = wrapper.find('.external-clipboard-widget__pill');
    const pasteButtons = getPasteButtons(wrapper);

    expect(pasteButtons).toHaveLength(1);
    expect(pasteButtons[0].text()).toBe('fileBrowser.actions.paste');
    expect(pasteButtons[0].find('.external-clipboard-paste-button__chevron').exists()).toBe(true);

    await pill.trigger('mouseenter');
    await pasteButtons[0].trigger('click');
    await flushPromises();
    await pill.trigger('mouseleave');
    vi.runAllTimers();
    await wrapper.vm.$nextTick();

    expect(pill.classes()).toContain('external-clipboard-widget__pill--expanded');
    expect(getPaneMenuItems().map(item => item.textContent?.trim())).toEqual([
      'fileBrowser.actions.pasteToPane1',
      'fileBrowser.actions.pasteToPane2',
    ]);

    getPaneMenuItems()[1].click();
    await flushPromises();

    expect(context.pasteClipboard).toHaveBeenCalledWith(1);
    expect(getPaneMenuItems()).toHaveLength(0);
    expect(pill.classes()).toContain('external-clipboard-widget__pill--expanded');

    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(pill.classes()).not.toContain('external-clipboard-widget__pill--expanded');
  });

  it('labels a cut from another app as a cut and pastes it with the cut operation', async () => {
    const clipboardStore = await setExternalFileClipboard([createDirEntry()], 'move');
    const context = createContext([{
      paneIndex: null,
      path: 'C:/Target',
    }]);
    const wrapper = mountWidget(context);

    expect(wrapper.find('.external-clipboard-widget__title').text()).toBe('fileBrowser.cutInAnotherApp');
    expect(wrapper.find('.external-clipboard-widget__pill').classes()).toContain('external-clipboard-widget__pill--move');

    await getPasteButtons(wrapper)[0].trigger('click');

    expect(clipboardStore.isMoveOperation).toBe(true);
    expect(context.pasteClipboard).toHaveBeenCalledWith(null);
  });

  it('labels a copy from another app as a copy', async () => {
    await setExternalFileClipboard([createDirEntry()]);
    const wrapper = mountWidget();

    expect(wrapper.find('.external-clipboard-widget__title').text()).toBe('fileBrowser.copiedInAnotherApp');
    expect(wrapper.find('.external-clipboard-widget__pill').classes()).not.toContain('external-clipboard-widget__pill--move');
  });

  it('stays expanded while a control has keyboard focus', async () => {
    await setExternalFileClipboard([createDirEntry()]);
    const wrapper = mountWidget();
    const pill = wrapper.find('.external-clipboard-widget__pill');
    const discardButton = wrapper.find<HTMLButtonElement>('.external-clipboard-widget__discard');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    discardButton.element.focus();
    await wrapper.vm.$nextTick();

    expect(pill.classes()).toContain('external-clipboard-widget__pill--expanded');

    discardButton.element.blur();
    await wrapper.vm.$nextTick();

    expect(pill.classes()).not.toContain('external-clipboard-widget__pill--expanded');
  });

  it('does not stay expanded when a mouse click focuses a control', async () => {
    await setExternalFileClipboard([createDirEntry()]);
    const wrapper = mountWidget();
    const pill = wrapper.find('.external-clipboard-widget__pill');
    const summaryButton = wrapper.find<HTMLButtonElement>('.external-clipboard-widget__summary');

    summaryButton.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    summaryButton.element.focus();
    await wrapper.vm.$nextTick();

    expect(pill.classes()).not.toContain('external-clipboard-widget__pill--expanded');
  });

  it('disables a pane in the paste dropdown the clipboard cannot be pasted into', async () => {
    await setExternalFileClipboard([createDirEntry({ path: 'C:/Left/file.txt' })], 'move');
    const wrapper = mountWidget(createContext(splitViewTargets));

    await getPasteButtons(wrapper)[0].trigger('click');
    await flushPromises();

    expect(getPaneMenuItems()[0].hasAttribute('data-disabled')).toBe(true);
    expect(getPaneMenuItems()[1].hasAttribute('data-disabled')).toBe(false);
  });

  it('discards the clipboard from the X button', async () => {
    const clipboardStore = await setExternalFileClipboard([createDirEntry()]);
    const wrapper = mountWidget();

    await wrapper.find('.external-clipboard-widget__discard').trigger('click');

    expect(clipboardStore.hasItems).toBe(false);
    expect(wrapper.find('.external-clipboard-widget').exists()).toBe(false);
  });

  it('opens the items popover from the title and keeps the pill expanded', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    await setExternalFileClipboard([createDirEntry()]);
    const wrapper = mountWidget();
    const pill = wrapper.find('.external-clipboard-widget__pill');

    expect(wrapper.find('.items-popover-stub').attributes('data-open')).toBe('false');

    await pill.trigger('mouseenter');
    await wrapper.find('.external-clipboard-widget__summary').trigger('click');

    expect(wrapper.find('.items-popover-stub').attributes('data-open')).toBe('true');

    await pill.trigger('mouseleave');
    vi.runAllTimers();
    await wrapper.vm.$nextTick();

    expect(pill.classes()).toContain('external-clipboard-widget__pill--expanded');
  });
});
