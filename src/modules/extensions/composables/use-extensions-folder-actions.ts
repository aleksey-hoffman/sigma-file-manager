// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { useRouter } from 'vue-router';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useI18n } from 'vue-i18n';
import { openNavigatorPath } from '@/utils/open-navigator-directory';

export function useExtensionsFolderActions() {
  const router = useRouter();
  const { t } = useI18n();

  async function navigateToExtensionsFolder(): Promise<void> {
    const extensionsDir = await invoke<string>('get_extensions_dir');

    if (extensionsDir) {
      openNavigatorPath(router, extensionsDir);
    }
  }

  async function pickExtensionFolderPath(): Promise<string | undefined> {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('extensions.selectExtensionFolder'),
    });

    if (selected && typeof selected === 'string') {
      return selected;
    }

    return undefined;
  }

  return {
    navigateToExtensionsFolder,
    pickExtensionFolderPath,
  };
}
