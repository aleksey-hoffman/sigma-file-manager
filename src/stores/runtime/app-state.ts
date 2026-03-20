// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';

const IDLE_THRESHOLD_MS = 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 10 * 1000;

export const useAppStateStore = defineStore('appState', () => {
  const lastActivityTime = ref(Date.now());
  const isUserIdle = ref(false);
  const idleCheckIntervalId = ref<ReturnType<typeof setInterval> | null>(null);
  let onIdleIntervalTick: (() => void) | null = null;

  function recordActivity() {
    lastActivityTime.value = Date.now();
    isUserIdle.value = false;
  }

  function getIsUserIdle() {
    return (Date.now() - lastActivityTime.value) > IDLE_THRESHOLD_MS;
  }

  function tickIdleState() {
    isUserIdle.value = getIsUserIdle();
  }

  function startUserIdleDetection(onIntervalTick?: () => void) {
    onIdleIntervalTick = onIntervalTick ?? null;

    if (idleCheckIntervalId.value !== null) {
      return;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true });
    });

    idleCheckIntervalId.value = setInterval(() => {
      tickIdleState();
      onIdleIntervalTick?.();
    }, IDLE_CHECK_INTERVAL_MS);
  }

  function stopUserIdleDetection() {
    if (idleCheckIntervalId.value !== null) {
      clearInterval(idleCheckIntervalId.value);
      idleCheckIntervalId.value = null;
    }

    onIdleIntervalTick = null;
    isUserIdle.value = false;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((event) => {
      window.removeEventListener(event, recordActivity);
    });
  }

  return {
    isUserIdle,
    getIsUserIdle,
    startUserIdleDetection,
    stopUserIdleDetection,
  };
});
