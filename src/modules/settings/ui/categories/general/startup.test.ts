// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type * as VueI18nModule from 'vue-i18n';
import { reactive } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import StartupSettings from '@/modules/settings/ui/categories/general/startup.vue';
import { usePlatformStore } from '@/stores/runtime/platform';

const {
  applyLaunchAtStartupPreferenceMock,
  userSettingsSetMock,
  userSettingsMock,
} = vi.hoisted(() => ({
  applyLaunchAtStartupPreferenceMock: vi.fn(),
  userSettingsSetMock: vi.fn(),
  userSettingsMock: {
    launchAtStartup: false,
    launchAtStartupHidden: false,
  },
}));

vi.mock('@/utils/autostart-sync', () => ({
  applyLaunchAtStartupPreference: applyLaunchAtStartupPreferenceMock,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: reactive(userSettingsMock),
    set: userSettingsSetMock,
  }),
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

describe('startup settings', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    applyLaunchAtStartupPreferenceMock.mockReset().mockResolvedValue(undefined);
    userSettingsSetMock.mockReset().mockResolvedValue(undefined);
    userSettingsMock.launchAtStartup = false;
    userSettingsMock.launchAtStartupHidden = false;
  });

  it('shows an unavailable badge and disables both switches in the portable version', () => {
    const platformStore = usePlatformStore();
    platformStore.isPortable = true;
    userSettingsMock.launchAtStartup = true;

    const wrapper = mount(StartupSettings);

    expect(wrapper.get('.settings-availability-badge').text()).toBe(
      'settings.unavailableInPortableVersion',
    );
    expect(wrapper.get('#launch-at-startup').attributes('disabled')).toBeDefined();
    expect(wrapper.get('#launch-at-startup-hidden').attributes('disabled')).toBeDefined();
  });

  it('applies the launch at startup preference in the installed version', async () => {
    const wrapper = mount(StartupSettings);

    expect(wrapper.find('.settings-availability-badge').exists()).toBe(false);

    await wrapper.get('#launch-at-startup').trigger('click');
    await flushPromises();

    expect(applyLaunchAtStartupPreferenceMock).toHaveBeenCalledWith(true);
    expect(userSettingsSetMock).toHaveBeenCalledWith('launchAtStartup', true);
  });
});
