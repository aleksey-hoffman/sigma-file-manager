// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, watch } from 'vue';
import { getVersion } from '@tauri-apps/api/app';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { i18n } from '@/localization';
import changelogContentEn from '@/../CHANGELOG.md?raw';

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
          currentFeatureContent.push(/^\s*-\s/.test(line) ? line : trimmedLine);
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

const releasesEn = parseChangelog(changelogContentEn);
const releases = ref<Release[]>(releasesEn);
const isOpen = ref(false);
const appVersion = ref<string>('');
const isInitialized = ref(false);
const loadedLocale = ref<string>('en');
const fetchCache = new Map<string, Release[]>();

fetchCache.set('en', releasesEn);

async function fetchLocalizedChangelog(locale: string): Promise<Release[] | null> {
  if (fetchCache.has(locale)) {
    return fetchCache.get(locale)!;
  }

  try {
    const response = await fetch(`/changelog/${locale}/changelog.md`);

    if (!response.ok) {
      return null;
    }

    const markdown = await response.text();
    const parsed = parseChangelog(markdown);

    if (parsed.length === 0) {
      return null;
    }

    fetchCache.set(locale, parsed);
    return parsed;
  }
  catch {
    return null;
  }
}

async function loadChangelogForLocale(locale: string) {
  if (locale === loadedLocale.value) {
    return;
  }

  const localized = await fetchLocalizedChangelog(locale);

  if (localized) {
    releases.value = localized;
    loadedLocale.value = locale;
  }
  else {
    releases.value = releasesEn;
    loadedLocale.value = 'en';
  }
}

watch(
  () => i18n.global.locale.value,
  (newLocale) => {
    loadChangelogForLocale(newLocale);
  },
);

export function useChangelog() {
  const userSettingsStore = useUserSettingsStore();

  const currentRelease = computed(() => {
    return releases.value.find(release => release.version === appVersion.value) || releases.value[0];
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
      appVersion.value = releases.value[0]?.version || '2.0.0-alpha.5';
      isInitialized.value = true;
    }

    await loadChangelogForLocale(i18n.global.locale.value);
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
