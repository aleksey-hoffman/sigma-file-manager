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
import {
  defineComponent,
  h,
  ref,
  type PropType,
} from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import AddressBarEditorDialog from '../address-bar-editor-dialog.vue';
import type { AddressBarEditorMode, AddressBarSuggestion } from '../address-bar-editor-utils';
import type { DirContents, DirEntry } from '@/types/dir-entry';

const userStatsMock = vi.hoisted(() => ({
  sortedHistory: [] as Array<{
    path: string;
    isFile: boolean;
    openedAt: number;
  }>,
  taggedItems: [],
  tags: [],
  removeFromHistory: vi.fn(),
}));

const invokeMock = vi.hoisted(() => vi.fn());
const matchesShortcutMock = vi.hoisted(() => vi.fn());
const userPathsMock = vi.hoisted(() => ({
  homeDir: 'C:/Users/aleks',
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      locale: {
        value: 'en',
      },
      t: (key: string) => key,
    },
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      dateTime: {
        showRelativeDates: false,
        month: 'long',
        hour12: false,
        autoDetectRegionalFormat: true,
        regionalFormat: null,
        properties: {
          showSeconds: false,
          showMilliseconds: false,
        },
      },
    },
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    userPaths: userPathsMock,
  }),
}));

vi.mock('@/stores/storage/user-stats', () => ({
  useUserStatsStore: () => userStatsMock,
}));

vi.mock('@/stores/runtime/platform', () => ({
  usePlatformStore: () => ({
    isWindows: true,
    currentPlatform: 'windows',
  }),
}));

vi.mock('@/stores/runtime/dir-sizes', () => ({
  useDirSizesStore: () => ({}),
}));

vi.mock('@/stores/runtime/shortcuts', () => ({
  matchesShortcut: matchesShortcutMock,
  useShortcutsStore: () => ({
    getShortcutLabel: (shortcutId: string) => shortcutId,
    getShortcutKeys: (shortcutId: string) => {
      if (shortcutId === 'goUpDirectory') {
        return {
          alt: true,
          key: 'ArrowUp',
        };
      }

      if (shortcutId === 'navigateHistoryBack') {
        return {
          alt: true,
          key: 'ArrowLeft',
        };
      }

      if (shortcutId === 'navigateHistoryForward') {
        return {
          alt: true,
          key: 'ArrowRight',
        };
      }

      return {};
    },
  }),
}));

vi.mock('@/modules/home/composables', () => ({
  useUserDirectories: () => ({
    userDirectories: ref([]),
    refresh: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock('../composables/use-address-bar-stable-drive-list', () => ({
  useAddressBarStableDriveList: () => ({
    stableDriveListSnapshot: ref([]),
    seedStableDriveListSnapshotFromLiveCache: vi.fn(),
    hydrateStableDriveListSnapshotFromRust: vi.fn().mockResolvedValue(undefined),
    clearStableDriveListSnapshotForAddressBar: vi.fn(),
  }),
}));

const CommandDialogStub = defineComponent({
  props: {
    open: Boolean,
    commandResetSearchTermOnBlur: Boolean,
  },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () => props.open
      ? h('div', {
          'role': 'dialog',
          'data-reset-search-on-blur': String(props.commandResetSearchTermOnBlur),
        }, slots.default?.())
      : null;
  },
});

const CommandInputStub = defineComponent({
  inheritAttrs: false,
  props: {
    modelValue: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    return () => h('input', {
      ...attrs,
      value: props.modelValue,
      onInput: (event: Event) => {
        emit('update:modelValue', (event.target as HTMLInputElement).value);
      },
    });
  },
});

const ScrollAreaRootStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h('div', attrs, slots.default?.());
  },
});

const ScrollAreaViewportStub = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, expose, slots }) {
    const viewportElement = ref<HTMLElement | null>(null);
    expose({ viewportElement });
    return () => h('div', {
      ...attrs,
      ref: viewportElement,
    }, slots.default?.());
  },
});

const ScrollBarStub = defineComponent({
  setup() {
    return () => h('div', {
      class: 'sigma-ui-scroll-area-scrollbar',
      tabindex: 0,
    });
  },
});

const SuggestionRowStub = defineComponent({
  props: {
    itemIndex: {
      type: Number,
      required: true,
    },
    selected: Boolean,
    suggestion: {
      type: Object as PropType<AddressBarSuggestion>,
      required: true,
    },
  },
  emits: ['activate', 'removeRecentEntry'],
  setup(props) {
    return () => h('div', {
      'class': 'address-bar-editor-suggestion-row',
      'data-address-bar-editor-index': props.itemIndex,
      'data-selected': props.selected ? 'true' : undefined,
    }, props.suggestion.name);
  },
});

const EmptyStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

function createCurrentDirContents(): DirContents {
  return {
    path: 'C:/Folder',
    entries: [
      {
        name: 'child.txt',
        ext: 'txt',
        path: 'C:/Folder/child.txt',
        size: 10,
        item_count: null,
        modified_time: 1,
        accessed_time: 1,
        created_time: 1,
        mime: 'text/plain',
        is_file: true,
        is_dir: false,
        is_symlink: false,
        is_hidden: false,
      },
    ],
    total_count: 1,
    dir_count: 0,
    file_count: 1,
    opened_directory_times: {
      modified_time: 1,
      accessed_time: 1,
      created_time: 1,
    },
  };
}

function mountAddressBarEditor(currentPath = 'C:/Folder') {
  return mount(AddressBarEditorDialog, {
    attachTo: document.body,
    props: {
      currentPath,
      currentDirContents: currentPath === 'C:/Folder'
        ? createCurrentDirContents()
        : emptyDirectory(currentPath),
    },
    global: {
      stubs: {
        AddressBarSuggestionRow: SuggestionRowStub,
        ChevronDownIcon: EmptyStub,
        ChevronRightIcon: EmptyStub,
        ClockIcon: EmptyStub,
        CommandDialog: CommandDialogStub,
        CommandInput: CommandInputStub,
        FolderIcon: EmptyStub,
        HardDriveIcon: EmptyStub,
        MapPinIcon: EmptyStub,
        ScrollAreaCorner: EmptyStub,
        ScrollAreaRoot: ScrollAreaRootStub,
        ScrollAreaViewport: ScrollAreaViewportStub,
        ScrollBar: ScrollBarStub,
        Separator: EmptyStub,
        TagIcon: EmptyStub,
      },
    },
  });
}

async function openEditor(
  wrapper: ReturnType<typeof mountAddressBarEditor>,
  mode: AddressBarEditorMode,
) {
  const editor = wrapper.vm as unknown as {
    open: (editorMode: AddressBarEditorMode) => Promise<void>;
  };
  await editor.open(mode);
  await flushPromises();
}

async function waitForAnimationFrame() {
  await new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => resolveFrame());
  });
}

function directoryEntryForPath(path: string): DirEntry {
  const name = path.split('/').filter(Boolean).pop() ?? path;

  return {
    name,
    ext: null,
    path,
    size: 0,
    item_count: 0,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: false,
    is_dir: true,
    is_symlink: false,
    is_hidden: false,
  };
}

function emptyDirectory(path: string): DirContents {
  return {
    path,
    entries: [],
    total_count: 0,
    dir_count: 0,
    file_count: 0,
    opened_directory_times: {
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
    },
  };
}

function mockAddressBarInvoke(homeEntries: DirEntry[] = []) {
  invokeMock.mockImplementation(async (command: string, args?: { path?: string }) => {
    if (command === 'read_dir' && args?.path === 'C:/Users/aleks' && homeEntries.length > 0) {
      return {
        ...emptyDirectory('C:/Users/aleks'),
        entries: homeEntries,
        total_count: homeEntries.length,
        dir_count: homeEntries.length,
        file_count: 0,
      };
    }

    if (command === 'read_dir') {
      return emptyDirectory(args?.path ?? '');
    }

    if (command === 'get_dir_entry_with_timeout') {
      return directoryEntryForPath(args?.path ?? '');
    }

    return true;
  });
}

type ShortcutMatchEvent = {
  altKey?: boolean;
  key?: string;
};

type ShortcutMatchKeys = {
  alt?: boolean;
  key?: string;
};

function enableAddressBarHistoryShortcuts() {
  matchesShortcutMock.mockImplementation((event: ShortcutMatchEvent, keys: ShortcutMatchKeys) => {
    if (!event.altKey || !keys.alt) {
      return false;
    }

    return event.key === keys.key;
  });
}

async function waitForSuggestionDebounce() {
  await new Promise((resolveDelay) => {
    setTimeout(resolveDelay, 200);
  });
  await flushPromises();
}

describe('address bar editor dialog', () => {
  beforeEach(() => {
    userStatsMock.sortedHistory = [];
    userStatsMock.removeFromHistory.mockReset();
    userPathsMock.homeDir = 'C:/Users/aleks';
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(true);
    matchesShortcutMock.mockReset();
    matchesShortcutMock.mockReturnValue(false);
  });

  it('keeps a collapsed group item count', async () => {
    userStatsMock.sortedHistory = [
      {
        path: 'C:/first.txt',
        isFile: true,
        openedAt: 2,
      },
      {
        path: 'C:/second.txt',
        isFile: true,
        openedAt: 1,
      },
    ];
    const wrapper = mountAddressBarEditor();
    await openEditor(wrapper, 'entry');
    const groupTrigger = wrapper.get('.address-bar-editor__group-trigger');

    expect(groupTrigger.get('.address-bar-editor__group-count').text()).toBe('2');

    await groupTrigger.trigger('click');

    expect(groupTrigger.get('.address-bar-editor__group-count').text()).toBe('2');
    wrapper.unmount();
  });

  it('preserves query and selection after scrollbar interaction', async () => {
    const wrapper = mountAddressBarEditor();
    await openEditor(wrapper, 'path');
    const input = wrapper.get('input');
    const selectedIndexBefore = wrapper.get('[data-selected]').attributes('data-address-bar-editor-index');
    const queryBefore = (input.element as HTMLInputElement).value;
    const scrollbar = wrapper.get('.sigma-ui-scroll-area-scrollbar');

    expect(wrapper.get('[role="dialog"]').attributes('data-reset-search-on-blur')).toBe('false');

    (input.element as HTMLInputElement).focus();
    await scrollbar.trigger('pointerdown');
    (scrollbar.element as HTMLElement).focus();
    await waitForAnimationFrame();

    expect(document.activeElement).toBe(input.element);
    expect((input.element as HTMLInputElement).value).toBe(queryBefore);
    expect(wrapper.get('[data-selected]').attributes('data-address-bar-editor-index')).toBe(selectedIndexBefore);
    wrapper.unmount();
  });

  it('keeps a typed ~/ query while suggesting home children', async () => {
    mockAddressBarInvoke([directoryEntryForPath('C:/Users/aleks/Desktop')]);

    const wrapper = mountAddressBarEditor();
    await openEditor(wrapper, 'path');
    const input = wrapper.get('input');
    await input.setValue('~/de');
    await waitForSuggestionDebounce();

    expect((input.element as HTMLInputElement).value).toBe('~/de');
    expect(invokeMock).toHaveBeenCalledWith('read_dir', expect.objectContaining({
      path: 'C:/Users/aleks',
    }));
    expect(wrapper.text()).toContain('Desktop');
    wrapper.unmount();
  });

  it('rewrites ~ to an absolute path when going up and restores that path from history', async () => {
    mockAddressBarInvoke();
    enableAddressBarHistoryShortcuts();

    const wrapper = mountAddressBarEditor();
    await openEditor(wrapper, 'path');
    const input = wrapper.get('input');
    (input.element as HTMLInputElement).focus();
    await input.setValue('~');
    await input.trigger('keydown', {
      key: 'ArrowUp',
      altKey: true,
    });
    await flushPromises();
    await waitForAnimationFrame();

    const inputElement = input.element as HTMLInputElement;
    expect(inputElement.value).toBe('C:/Users/');
    expect(inputElement.selectionStart).toBe(inputElement.value.length);

    await input.trigger('keydown', {
      key: 'ArrowLeft',
      altKey: true,
    });
    await flushPromises();
    expect(inputElement.value).toBe('C:/Users/aleks');

    await input.trigger('keydown', {
      key: 'ArrowLeft',
      altKey: true,
    });
    await flushPromises();
    expect(inputElement.value).toBe('C:/Folder/');

    await input.trigger('keydown', {
      key: 'ArrowRight',
      altKey: true,
    });
    await flushPromises();
    expect(inputElement.value).toBe('C:/Users/aleks');
    wrapper.unmount();
  });

  it('seeds a bare tilde typed from search as the home listing', async () => {
    mockAddressBarInvoke();
    enableAddressBarHistoryShortcuts();

    const wrapper = mountAddressBarEditor();
    await openEditor(wrapper, 'entry');
    const input = wrapper.get('input');
    const inputElement = input.element as HTMLInputElement;

    await input.setValue('~');
    await waitForSuggestionDebounce();
    inputElement.focus();
    await input.trigger('keydown', {
      key: 'ArrowUp',
      altKey: true,
    });
    await flushPromises();

    expect(inputElement.value).toBe('C:/Users/');

    await input.trigger('keydown', {
      key: 'ArrowLeft',
      altKey: true,
    });
    await flushPromises();

    expect(inputElement.value).toBe('C:/Users/aleks/');
    wrapper.unmount();
  });

  it('goes up from ~ in home and returns to the home listing', async () => {
    mockAddressBarInvoke();
    enableAddressBarHistoryShortcuts();

    const wrapper = mountAddressBarEditor('C:/Users/aleks');
    await openEditor(wrapper, 'path');
    const input = wrapper.get('input');
    const inputElement = input.element as HTMLInputElement;

    expect(inputElement.value).toBe('C:/Users/aleks/');

    inputElement.focus();
    await input.setValue('~');
    await input.trigger('keydown', {
      key: 'ArrowUp',
      altKey: true,
    });
    await flushPromises();

    expect(inputElement.value).toBe('C:/Users/');

    await input.trigger('keydown', {
      key: 'ArrowLeft',
      altKey: true,
    });
    await flushPromises();

    expect(inputElement.value).toBe('C:/Users/aleks/');
    wrapper.unmount();
  });

  it('rewrites ~/de to an absolute directory on tab', async () => {
    mockAddressBarInvoke([directoryEntryForPath('C:/Users/aleks/Desktop')]);
    enableAddressBarHistoryShortcuts();

    const wrapper = mountAddressBarEditor();
    await openEditor(wrapper, 'entry');
    const input = wrapper.get('input');
    const inputElement = input.element as HTMLInputElement;

    await input.setValue('~/de');
    await waitForSuggestionDebounce();
    await input.trigger('keydown', {
      key: 'Tab',
    });
    await flushPromises();

    expect(inputElement.value).toBe('C:/Users/aleks/Desktop/');

    inputElement.focus();
    await input.trigger('keydown', {
      key: 'ArrowUp',
      altKey: true,
    });
    await flushPromises();
    expect(inputElement.value).toBe('C:/Users/aleks/');

    await input.trigger('keydown', {
      key: 'ArrowLeft',
      altKey: true,
    });
    await flushPromises();
    expect(inputElement.value).toBe('C:/Users/aleks/Desktop/');
    wrapper.unmount();
  });
});
