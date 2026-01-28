// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import changelogContent from '@/../CHANGELOG.md?raw';

export interface ReleaseFeature {
  title: string;
  description: string;
}

export interface Release {
  version: string;
  date: string;
  summary: string;
  features: ReleaseFeature[];
}

function parseChangelog(markdown: string): Release[] {
  const releases: Release[] = [];
  const releasePattern = /^## \[([^\]]+)\] - (.+)$/gm;
  const releaseMatches = [...markdown.matchAll(releasePattern)];

  for (let releaseIndex = 0; releaseIndex < releaseMatches.length; releaseIndex++) {
    const match = releaseMatches[releaseIndex];
    const version = match[1];
    const date = match[2];
    const startIndex = match.index! + match[0].length;
    const endIndex = releaseMatches[releaseIndex + 1]?.index ?? markdown.length;
    const releaseContent = markdown.slice(startIndex, endIndex).trim();

    const lines = releaseContent.split('\n');
    let summary = '';
    const features: ReleaseFeature[] = [];

    let currentFeatureTitle = '';
    let currentFeatureContent: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === '---') {
        continue;
      }

      const featureMatch = trimmedLine.match(/^### (.+)$/);

      if (featureMatch) {
        if (currentFeatureTitle) {
          features.push(parseFeature(currentFeatureTitle, currentFeatureContent.join('\n')));
        }

        currentFeatureTitle = featureMatch[1];
        currentFeatureContent = [];
        continue;
      }

      if (currentFeatureTitle) {
        if (trimmedLine) {
          currentFeatureContent.push(trimmedLine);
        }
      }
      else if (trimmedLine && !summary) {
        summary = trimmedLine;
      }
    }

    if (currentFeatureTitle) {
      features.push(parseFeature(currentFeatureTitle, currentFeatureContent.join('\n')));
    }

    releases.push({
      version,
      date,
      summary,
      features,
    });
  }

  return releases;
}

function parseFeature(title: string, content: string): ReleaseFeature {
  return {
    title,
    description: content,
  };
}

const releases = parseChangelog(changelogContent);
const isOpen = ref(false);
const appVersion = ref<string>('');
const isInitialized = ref(false);

export function useChangelog() {
  const userSettingsStore = useUserSettingsStore();

  const currentRelease = computed(() => {
    return releases.find(release => release.version === appVersion.value) || releases[0];
  });

  const hasUnseenUpdate = computed(() => {
    if (!appVersion.value) {
      return false;
    }

    const lastSeenVersion = userSettingsStore.userSettings.changelog?.lastSeenVersion;
    return lastSeenVersion !== appVersion.value;
  });

  const shouldAutoShow = computed(() => {
    return userSettingsStore.userSettings.changelog?.showOnUpdate ?? true;
  });

  async function init() {
    if (isInitialized.value) {
      return;
    }

    try {
      appVersion.value = await getVersion();
      isInitialized.value = true;
    }
    catch (error) {
      console.error('Failed to get app version:', error);
      appVersion.value = releases[0]?.version || '2.0.0-alpha.5';
      isInitialized.value = true;
    }
  }

  function open() {
    isOpen.value = true;
  }

  function close() {
    isOpen.value = false;
  }

  async function markAsSeen() {
    if (appVersion.value) {
      await userSettingsStore.set('changelog.lastSeenVersion', appVersion.value);
    }
  }

  async function checkAndShowChangelog() {
    await init();

    if (shouldAutoShow.value && hasUnseenUpdate.value) {
      open();
      await markAsSeen();
    }
  }

  return {
    isOpen,
    appVersion,
    releases,
    currentRelease,
    hasUnseenUpdate,
    shouldAutoShow,
    init,
    open,
    close,
    markAsSeen,
    checkAndShowChangelog,
  };
}
