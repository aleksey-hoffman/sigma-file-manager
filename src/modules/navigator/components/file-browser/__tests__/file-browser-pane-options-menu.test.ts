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
import { defineComponent, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import type { NavigatorFolderSettingsPatch, NavigatorOptionsTarget } from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import FileBrowserPaneOptionsMenu from '../file-browser-pane-options-menu.vue';

const FOLDER_PATH = 'C:/Users/aleks';

interface MenuNavigatorState {
  layout: {
    type: {
      title: string;
      name: 'list' | 'grid';
    };
  };
  listSortColumn: string;
  listSortDirection: string;
  gridSortColumn: string;
  gridSortDirection: string;
  showHiddenFiles: boolean;
  grouping: string;
  folderSettings: Record<string, Record<string, unknown>>;
}

const { holder, persistMock, clearMock } = vi.hoisted(() => ({
  holder: {
    state: null as { navigator: MenuNavigatorState } | null,
  },
  persistMock: vi.fn<(
    target: NavigatorOptionsTarget,
    patch: NavigatorFolderSettingsPatch,
  ) => Promise<void>>(),
  clearMock: vi.fn<(path: string) => Promise<void>>(),
}));

vi.mock('@/stores/storage/user-settings', () => {
  const state = reactive({
    navigator: {
      layout: {
        type: {
          title: 'listLayout',
          name: 'list' as const,
        },
      },
      listSortColumn: 'modified',
      listSortDirection: 'desc',
      gridSortColumn: 'name',
      gridSortDirection: 'asc',
      showHiddenFiles: true,
      grouping: 'none',
      folderSettings: {} as Record<string, Record<string, unknown>>,
    },
  });
  holder.state = state;

  return {
    useUserSettingsStore: () => ({
      userSettings: state,
    }),
  };
});

vi.mock('@/modules/navigator/utils/persist-navigator-folder-settings', () => ({
  persistNavigatorOptions: (
    target: NavigatorOptionsTarget,
    patch: NavigatorFolderSettingsPatch,
  ) => persistMock(target, patch),
  clearNavigatorFolderSettings: (path: string) => clearMock(path),
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const SlotStub = defineComponent({
  template: '<div><slot /></div>',
});

const MenuItemStub = defineComponent({
  props: {
    disabled: Boolean,
  },
  emits: ['select'],
  template: '<button type="button" :disabled="disabled" @click="$emit(\'select\', $event)"><slot /></button>',
});

function navigatorState(): MenuNavigatorState {
  if (!holder.state) {
    throw new Error('menu navigator state was not created');
  }

  return holder.state.navigator;
}

function findButton(wrapper: ReturnType<typeof mountMenu>, label: string) {
  const button = wrapper.findAll('button').find(candidate => candidate.text().includes(label));

  if (!button) {
    throw new Error(`missing button ${label}`);
  }

  return button;
}

function mountMenu() {
  return mount(FileBrowserPaneOptionsMenu, {
    props: {
      path: FOLDER_PATH,
    },
    global: {
      stubs: {
        Button: SlotStub,
        DropdownMenu: SlotStub,
        DropdownMenuTrigger: SlotStub,
        DropdownMenuContent: SlotStub,
        DropdownMenuItem: MenuItemStub,
        Tooltip: SlotStub,
        TooltipTrigger: SlotStub,
        TooltipContent: SlotStub,
        Switch: SlotStub,
        Select: SlotStub,
        SelectContent: SlotStub,
        SelectItem: SlotStub,
        SelectItemText: SlotStub,
        SelectTrigger: SlotStub,
        SelectValue: SlotStub,
        ScrollArea: SlotStub,
        Tabs: SlotStub,
        TabsList: SlotStub,
        TabsTrigger: SlotStub,
        Collapsible: SlotStub,
        CollapsibleContent: SlotStub,
        NavigatorLayoutSortControls: SlotStub,
      },
    },
  });
}

describe('file browser pane options menu saved confirmation', () => {
  beforeEach(() => {
    const navigator = navigatorState();
    navigator.grouping = 'none';
    navigator.layout.type.name = 'list';
    navigator.showHiddenFiles = true;
    navigator.listSortColumn = 'modified';
    navigator.listSortDirection = 'desc';
    navigator.folderSettings = {
      [FOLDER_PATH]: {
        grouping: 'kind',
      },
    };
    persistMock.mockReset();
    persistMock.mockImplementation(async (target, patch) => {
      if (target !== 'global') {
        return;
      }

      if (patch.grouping) {
        navigator.grouping = patch.grouping;
      }

      if (patch.layout) {
        navigator.layout.type.name = patch.layout;
      }
    });
    clearMock.mockReset();
    clearMock.mockImplementation(async () => {
      navigator.folderSettings = {};
    });
  });

  it('ignores reset and a second set-as-default click while the confirmation is showing', async () => {
    const wrapper = mountMenu();
    const setAsDefault = findButton(wrapper, 'settings.navigator.setAsDefault');
    const reset = findButton(wrapper, 'settings.navigator.useGlobalSettings');

    expect(reset.attributes('disabled')).toBeUndefined();

    await setAsDefault.trigger('click');
    await setAsDefault.trigger('click');
    await flushPromises();

    expect(persistMock).toHaveBeenCalledTimes(1);
    expect(persistMock).toHaveBeenCalledWith('global', expect.objectContaining({
      grouping: 'kind',
    }));
    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(wrapper.get('.file-browser-pane-options-menu__reset').classes()).toContain('is-collapsed');
    expect(reset.attributes('disabled')).toBeDefined();

    await reset.trigger('click');
    await flushPromises();

    expect(clearMock).toHaveBeenCalledTimes(1);
    expect(persistMock).toHaveBeenCalledTimes(1);

    wrapper.unmount();
  });

  it('shows reset again when a new override cancels the confirmation', async () => {
    const wrapper = mountMenu();

    await findButton(wrapper, 'settings.navigator.setAsDefault').trigger('click');
    await flushPromises();

    navigatorState().folderSettings = {
      [FOLDER_PATH]: {
        grouping: 'modified',
      },
    };
    await wrapper.vm.$nextTick();

    const reset = findButton(wrapper, 'settings.navigator.useGlobalSettings');
    expect(wrapper.get('.file-browser-pane-options-menu__reset').classes()).not.toContain('is-collapsed');
    expect(reset.attributes('disabled')).toBeUndefined();

    await reset.trigger('click');
    await flushPromises();

    expect(clearMock).toHaveBeenCalledTimes(2);

    wrapper.unmount();
  });
});
