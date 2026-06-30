// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';

export function getScrollRestorationKey(...parts: Array<number | string | null | undefined>): string {
  return parts
    .filter(part => part !== null && part !== undefined)
    .map(part => encodeURIComponent(String(part)))
    .join(':');
}

export const useScrollRestorationStore = defineStore('scrollRestoration', () => {
  const scrollPositions = ref<Record<string, number>>({});
  const activeTabs = ref<Record<string, string>>({});
  const resetVersions = ref<Record<string, number>>({});

  function getScrollTop(stateKey: string | null | undefined): number {
    return stateKey ? scrollPositions.value[stateKey] ?? 0 : 0;
  }

  function setScrollTop(stateKey: string | null | undefined, scrollTop: number) {
    if (!stateKey) {
      return;
    }

    scrollPositions.value[stateKey] = Math.max(0, scrollTop);
  }

  function getResetVersion(namespace: string): number {
    return resetVersions.value[namespace] ?? 0;
  }

  function resetScrollNamespace(namespace: string) {
    const namespacePrefix = `${getScrollRestorationKey(namespace)}:`;

    for (const stateKey of Object.keys(scrollPositions.value)) {
      if (stateKey.startsWith(namespacePrefix)) {
        delete scrollPositions.value[stateKey];
      }
    }

    resetVersions.value[namespace] = getResetVersion(namespace) + 1;
  }

  function getActiveTab(stateKey: string | null | undefined): string | undefined {
    return stateKey ? activeTabs.value[stateKey] : undefined;
  }

  function setActiveTab(stateKey: string | null | undefined, activeTab: string) {
    if (!stateKey) {
      return;
    }

    activeTabs.value[stateKey] = activeTab;
  }

  return {
    scrollPositions,
    activeTabs,
    resetVersions,
    getScrollTop,
    setScrollTop,
    getResetVersion,
    resetScrollNamespace,
    getActiveTab,
    setActiveTab,
  };
});
