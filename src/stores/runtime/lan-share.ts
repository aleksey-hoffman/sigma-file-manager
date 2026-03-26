// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { LanShareMode, LanSharePendingReplace } from '@/types/lan-share';

export type LanShareActiveSession = {
  address: string;
  mdnsAddress?: string;
  iosAddress?: string;
  mode: LanShareMode;
  sharedPath: string;
  originalPath: string;
  isFile: boolean;
  hubPaths?: string[];
};

export const useLanShareStore = defineStore('lan-share', () => {
  const activeSession = ref<LanShareActiveSession | null>(null);
  const isPopoverOpen = ref(false);
  const qrDataUrl = ref<string | null>(null);
  const replaceShareDialogOpen = ref(false);
  const pendingReplaceShare = ref<LanSharePendingReplace | null>(null);

  function setActiveSession(session: LanShareActiveSession | null) {
    activeSession.value = session;

    if (!session) {
      qrDataUrl.value = null;
    }
  }

  function setQrDataUrl(dataUrl: string | null) {
    qrDataUrl.value = dataUrl;
  }

  function openReplaceShareDialog(pending: LanSharePendingReplace) {
    pendingReplaceShare.value = pending;
    replaceShareDialogOpen.value = true;
  }

  function closeReplaceShareDialog() {
    pendingReplaceShare.value = null;
    replaceShareDialogOpen.value = false;
  }

  return {
    activeSession,
    isPopoverOpen,
    qrDataUrl,
    replaceShareDialogOpen,
    pendingReplaceShare,
    setActiveSession,
    setQrDataUrl,
    openReplaceShareDialog,
    closeReplaceShareDialog,
  };
});
