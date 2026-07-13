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
import type { DirContents } from '@/types/dir-entry';

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
  invoke: vi.fn().mockResolvedValue(true),
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
  matchesShortcut: () => false,
  useShortcutsStore: () => ({
    getShortcutLabel: (shortcutId: string) => shortcutId,
    getShortcutKeys: () => [],
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

function mountAddressBarEditor() {
  return mount(AddressBarEditorDialog, {
    attachTo: document.body,
    props: {
      currentPath: 'C:/Folder',
      currentDirContents: createCurrentDirContents(),
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

describe('address bar editor dialog', () => {
  beforeEach(() => {
    userStatsMock.sortedHistory = [];
    userStatsMock.removeFromHistory.mockReset();
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
});
