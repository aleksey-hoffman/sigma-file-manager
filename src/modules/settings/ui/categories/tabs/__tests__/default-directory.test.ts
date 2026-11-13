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
import { defineComponent, h } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import DefaultDirectorySettings from '../default-directory.vue';

const setMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const invokeMock = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const openMock = vi.hoisted(() => vi.fn());
const userSettingsState = vi.hoisted(() => ({
  navigator: {
    defaultDirectory: {
      kind: 'custom' as const,
      customPath: '',
    },
  },
}));
const userPathsState = vi.hoisted(() => ({
  homeDir: '/home/user',
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: openMock,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: userSettingsState,
    set: setMock,
  }),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    userPaths: userPathsState,
  }),
}));

vi.mock('@/modules/settings', async () => {
  const { defineComponent, h } = await import('vue');

  return {
    SettingsItem: defineComponent({
      name: 'SettingsItem',
      setup(_, { slots }) {
        return () => h('div', [
          slots.default?.(),
          slots.nested?.(),
        ]);
      },
    }),
  };
});

const PassthroughStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

function mountDefaultDirectory() {
  return mount(DefaultDirectorySettings, {
    global: {
      stubs: {
        Select: PassthroughStub,
        SelectContent: PassthroughStub,
        SelectItem: PassthroughStub,
        SelectItemText: PassthroughStub,
        SelectTrigger: PassthroughStub,
        SelectValue: PassthroughStub,
        Tooltip: PassthroughStub,
        TooltipContent: PassthroughStub,
        TooltipTrigger: PassthroughStub,
      },
    },
  });
}

describe('custom default directory path', () => {
  beforeEach(() => {
    setMock.mockReset();
    setMock.mockResolvedValue(undefined);
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(true);
    openMock.mockReset();
    userSettingsState.navigator.defaultDirectory.kind = 'custom';
    userSettingsState.navigator.defaultDirectory.customPath = '';
    userPathsState.homeDir = '/home/user';
  });

  it('stores an expanded path and rewrites the field on blur', async () => {
    const wrapper = mountDefaultDirectory();
    const input = wrapper.get('#default-directory-custom-path');

    await input.setValue('~/Desktop');
    await flushPromises();

    expect(setMock).toHaveBeenCalledWith(
      'navigator.defaultDirectory.customPath',
      '/home/user/Desktop',
    );
    expect(invokeMock).toHaveBeenCalledWith('path_exists', {
      path: '/home/user/Desktop',
    });
    expect((input.element as HTMLInputElement).value).toBe('~/Desktop');

    await input.trigger('blur');
    await flushPromises();

    expect((input.element as HTMLInputElement).value).toBe('/home/user/Desktop');
    wrapper.unmount();
  });

  it('expands a windows tilde path when home has a trailing slash', async () => {
    userPathsState.homeDir = 'C:/Users/aleks/';
    const wrapper = mountDefaultDirectory();
    const input = wrapper.get('#default-directory-custom-path');

    await input.setValue('~\\Desktop');
    await flushPromises();

    expect(setMock).toHaveBeenLastCalledWith(
      'navigator.defaultDirectory.customPath',
      'C:/Users/aleks/Desktop',
    );
    wrapper.unmount();
  });

  it('does not turn ~/Desktop into /Desktop when home is empty', async () => {
    userPathsState.homeDir = '';
    const wrapper = mountDefaultDirectory();
    const input = wrapper.get('#default-directory-custom-path');

    await input.setValue('~/Desktop');
    await flushPromises();

    expect(setMock).toHaveBeenCalledWith(
      'navigator.defaultDirectory.customPath',
      '~/Desktop',
    );
    expect(invokeMock).toHaveBeenCalledWith('path_exists', {
      path: '~/Desktop',
    });
    wrapper.unmount();
  });

  it('leaves ~user and shell variables unchanged', async () => {
    const wrapper = mountDefaultDirectory();
    const input = wrapper.get('#default-directory-custom-path');

    await input.setValue('~user');
    await flushPromises();
    expect(setMock).toHaveBeenLastCalledWith(
      'navigator.defaultDirectory.customPath',
      '~user',
    );

    await input.setValue('$HOME/Desktop');
    await flushPromises();
    expect(setMock).toHaveBeenLastCalledWith(
      'navigator.defaultDirectory.customPath',
      '$HOME/Desktop',
    );
    wrapper.unmount();
  });

  it('passes the expanded path to the folder picker', async () => {
    openMock.mockResolvedValue('/home/user/Projects');
    const wrapper = mountDefaultDirectory();
    const input = wrapper.get('#default-directory-custom-path');

    await input.setValue('~/Projects');
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await flushPromises();

    expect(openMock).toHaveBeenCalledWith(expect.objectContaining({
      defaultPath: '/home/user/Projects',
      directory: true,
    }));
    expect((input.element as HTMLInputElement).value).toBe('/home/user/Projects');
    wrapper.unmount();
  });
});
