// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { toast } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { getStartupStorageRecovery } from '@/stores/storage/utils/startup-storage-bootstrap';

const STORAGE_RECOVERY_NOTICE_DURATION_MS = 15000;

export async function showStartupStorageRecoveryNotice() {
  const recovery = await getStartupStorageRecovery();

  if (recovery === 'restoredFromBackup') {
    toast(i18n.global.t('notifications.storageRestoredFromBackup'), {
      description: i18n.global.t('notifications.storageRestoredFromBackupDescription'),
      duration: STORAGE_RECOVERY_NOTICE_DURATION_MS,
    });
  }
  else if (recovery === 'resetToDefaults') {
    toast(i18n.global.t('notifications.storageResetToDefaults'), {
      description: i18n.global.t('notifications.storageResetToDefaultsDescription'),
      duration: STORAGE_RECOVERY_NOTICE_DURATION_MS,
    });
  }
}
