// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { openBinarySetupForExtension } from '@/modules/extensions/utils/extension-binary-setup-state';
import { isBinaryEditingBlocked } from '@/modules/extensions/utils/binary-edit-availability';
import { showBinaryEditBlockedToast } from '@/modules/extensions/utils/toast-utils';

export function useExtensionBinarySetupRoute() {
  const route = useRoute();
  const storageStore = useExtensionsStorageStore();
  const extensionsStore = useExtensionsStore();

  async function handleEditBinariesQuery(extensionId: string): Promise<void> {
    const extensionData = storageStore.extensionsData.installedExtensions[extensionId];

    if (!extensionData || extensionData.installPendingDependencies) {
      return;
    }

    if (isBinaryEditingBlocked()) {
      showBinaryEditBlockedToast();
      return;
    }

    openBinarySetupForExtension(
      extensionId,
      extensionData.manifest.name || extensionId,
      extensionData.manifest,
      async () => {
        const installedExtension = storageStore.extensionsData.installedExtensions[extensionId];

        if (!installedExtension?.enabled) {
          return;
        }

        try {
          await extensionsStore.unloadExtension(extensionId);
          await extensionsStore.loadExtension(extensionId, 'onStartup');
        }
        catch (error) {
          console.error(`Failed to reload extension ${extensionId} after binary edit:`, error);
        }
      },
    );
  }

  function processRouteQuery(): void {
    const editBinariesExtensionId = route.query.editBinaries;

    if (typeof editBinariesExtensionId === 'string' && editBinariesExtensionId.length > 0) {
      void handleEditBinariesQuery(editBinariesExtensionId);
    }
  }

  onMounted(() => {
    processRouteQuery();
  });

  watch(
    () => route.query.editBinaries,
    (editBinariesExtensionId) => {
      if (typeof editBinariesExtensionId === 'string' && editBinariesExtensionId.length > 0) {
        void handleEditBinariesQuery(editBinariesExtensionId);
      }
    },
  );
}
