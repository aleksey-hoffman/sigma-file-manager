// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import router from '@/router';
import { useSettingsStore } from '@/stores/runtime/settings';

export async function openSettingsTab(tabName?: string): Promise<void> {
  const settingsStore = useSettingsStore();
  settingsStore.clearSearch();

  if (tabName) {
    settingsStore.setCurrentTab(tabName);
  }

  await router.push({ name: 'settings' });
}
