// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import {
  hasAnyBinaryInstallInProgress,
  isBinaryInstallInProgress,
  useBinaryInstallActivity,
} from '@/modules/extensions/api/binary-install-activity';
import { useExtensionsStore } from '@/stores/runtime/extensions';

export function isBinaryEditingBlocked(): boolean {
  const extensionsStore = useExtensionsStore();
  return extensionsStore.isAnyInstallInProgress || hasAnyBinaryInstallInProgress();
}

export function isBinaryRowEditingBlocked(binaryId: string): boolean {
  return isBinaryEditingBlocked() || isBinaryInstallInProgress(binaryId);
}

export function useBinaryEditAvailability() {
  const extensionsStore = useExtensionsStore();
  const { hasAnyBinaryInstallInProgress: anyBinaryInstalling } = useBinaryInstallActivity();

  const isBinaryEditBlocked = computed(() => {
    return extensionsStore.isAnyInstallInProgress || anyBinaryInstalling.value;
  });

  function isBinaryRowEditBlocked(binaryId: string): boolean {
    return isBinaryEditBlocked.value || isBinaryInstallInProgress(binaryId);
  }

  return {
    isBinaryEditBlocked,
    isBinaryRowEditBlocked,
  };
}
