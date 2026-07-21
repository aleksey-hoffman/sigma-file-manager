// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type * as VueI18nModule from 'vue-i18n';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import DefaultFileManager from '@/modules/settings/ui/categories/experimental/default-file-manager.vue';
import { usePlatformStore } from '@/stores/runtime/platform';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@/modules/settings', () => ({
  SettingsItem: {
    props: ['title', 'description', 'icon'],
    template: `
      <section class="settings-view-item">
        <slot name="title-suffix" />
        <slot />
      </section>
    `,
  },
}));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof VueI18nModule>();

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

describe('default file manager setting', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(false);
  });

  it('shows an unavailable badge and disabled switch for Microsoft Store installations', () => {
    const platformStore = usePlatformStore();
    platformStore.currentPlatform = 'windows';
    platformStore.appUpdatesManagedExternally = true;
    platformStore.supportsDefaultFileManager = false;

    const wrapper = mount(DefaultFileManager);

    expect(wrapper.get('.default-file-manager__availability-badge').text()).toBe(
      'settings.experimental.defaultFileManager.unavailableInMicrosoftStore',
    );
    expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeDefined();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('keeps the switch interactive for direct Windows installations', async () => {
    const platformStore = usePlatformStore();
    platformStore.currentPlatform = 'windows';
    platformStore.appUpdatesManagedExternally = false;
    platformStore.supportsDefaultFileManager = true;

    const wrapper = mount(DefaultFileManager);
    await flushPromises();

    expect(wrapper.find('.default-file-manager__availability-badge').exists()).toBe(false);
    expect(wrapper.get('[role="switch"]').attributes('disabled')).toBeUndefined();
    expect(invokeMock).toHaveBeenCalledWith('is_default_file_manager');
  });

  it('does not show the Windows-only setting on other platforms', () => {
    const platformStore = usePlatformStore();
    platformStore.currentPlatform = 'linux';
    platformStore.supportsDefaultFileManager = false;

    const wrapper = mount(DefaultFileManager);

    expect(wrapper.find('.settings-view-item').exists()).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
