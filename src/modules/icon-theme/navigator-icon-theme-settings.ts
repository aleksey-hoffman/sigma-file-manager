// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';
import { iconThemeReferencesExtension } from './extension-icon-themes';

export async function resetNavigatorIconThemesForExtension(extensionId: string): Promise<void> {
  const userSettingsStore = useUserSettingsStore();
  const resetTasks: Array<Promise<void>> = [];

  if (iconThemeReferencesExtension(userSettingsStore.userSettings.navigator.folderIconTheme, extensionId)) {
    resetTasks.push(userSettingsStore.set('navigator.folderIconTheme', BUILTIN_NAVIGATOR_ICON_THEME_IDS.system));
  }

  if (iconThemeReferencesExtension(userSettingsStore.userSettings.navigator.fileIconTheme, extensionId)) {
    resetTasks.push(userSettingsStore.set('navigator.fileIconTheme', BUILTIN_NAVIGATOR_ICON_THEME_IDS.system));
  }

  await Promise.all(resetTasks);
}
