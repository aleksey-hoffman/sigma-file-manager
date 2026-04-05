// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, onUnmounted, ref, toValue, watch } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { useDocumentVisibility } from '@vueuse/core';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { isRelativeDateDisplayEnabled } from '@/utils/relative-date-display';

export function useRelativeDateDisplay(relativeDisplay: MaybeRefOrGetter<boolean> = true) {
  const userSettingsStore = useUserSettingsStore();

  const isEnabled = computed(() => {
    return isRelativeDateDisplayEnabled(
      userSettingsStore.userSettings.dateTime.showRelativeDates,
      toValue(relativeDisplay),
    );
  });

  return { isEnabled };
}

export function useRelativeDateDisplayClock(trackRelativeTime: MaybeRefOrGetter<boolean> = true) {
  const documentVisibility = useDocumentVisibility();
  const clockRef = ref(Date.now());
  let intervalId: ReturnType<typeof setInterval> | undefined;
  const { isEnabled } = useRelativeDateDisplay(trackRelativeTime);

  function clearClockInterval(): void {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
  }

  const shouldRunRelativeClock = computed(() => {
    return isEnabled.value && documentVisibility.value === 'visible';
  });

  watch(
    shouldRunRelativeClock,
    (enabled) => {
      clearClockInterval();

      if (enabled) {
        clockRef.value = Date.now();
        intervalId = setInterval(() => {
          clockRef.value = Date.now();
        }, 1000);
      }
    },
    { immediate: true },
  );

  onUnmounted(() => {
    clearClockInterval();
  });

  return { clockRef, isEnabled, shouldRunRelativeClock };
}
