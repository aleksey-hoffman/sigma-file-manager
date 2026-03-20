// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MixBlendMode } from '@/types/user-settings';

export const useDropOverlayStore = defineStore('dropOverlay', () => {
  const isBackgroundManagerOpen = ref(false);
  const mixBlendModePreview = ref<MixBlendMode | null>(null);

  function setBackgroundManagerOpen(isOpen: boolean) {
    isBackgroundManagerOpen.value = isOpen;
  }

  function setMixBlendModePreview(mode: MixBlendMode | null) {
    mixBlendModePreview.value = mode;
  }

  return {
    isBackgroundManagerOpen,
    mixBlendModePreview,
    setBackgroundManagerOpen,
    setMixBlendModePreview,
  };
});
