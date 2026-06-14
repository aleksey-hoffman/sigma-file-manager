// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import { getLanguage } from '@/localization/data';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

export function useTextDirection() {
  const userSettingsStore = useUserSettingsStore();

  const isRtl = computed(() => {
    const locale = userSettingsStore.userSettings.language.locale;
    return getLanguage(locale)?.isRtl ?? userSettingsStore.userSettings.language.isRtl ?? false;
  });
  const textDirection = computed(() => isRtl.value ? 'rtl' : 'ltr');
  const inlineStartSide = computed(() => isRtl.value ? 'right' : 'left');
  const inlineEndSide = computed(() => isRtl.value ? 'left' : 'right');

  return {
    isRtl,
    textDirection,
    inlineStartSide,
    inlineEndSide,
  };
}
