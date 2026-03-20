<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Infusion } from './index';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useAppStateStore } from '@/stores/runtime/app-state';
import { useAppWindowStore } from '@/stores/runtime/app-window';
import { useBackgroundMedia } from '@/modules/home/composables/use-background-media';
import { backgroundMedia, DEFAULT_INFUSION_BACKGROUND_FILE_NAME } from '@/data/background-media';
import type { InfusionPage } from '@/types/user-settings';

const userSettingsStore = useUserSettingsStore();
const appStateStore = useAppStateStore();
const appWindowStore = useAppWindowStore();
const route = useRoute();
const { getMediaUrl, ensureMediaCached, resolveMediaSelection } = useBackgroundMedia();

const infusionSettings = computed(() => userSettingsStore.userSettings.infusion);

const currentRouteName = computed(() => (route.name as InfusionPage) || '');

const effectivePageSettings = computed(() => {
  const settings = infusionSettings.value;

  if (settings.sameSettingsForAllPages) {
    return settings.pages[''];
  }

  return settings.pages[currentRouteName.value] || settings.pages[''];
});

const infusionMediaSelectionOptions = {
  defaultMediaId: DEFAULT_INFUSION_BACKGROUND_FILE_NAME,
  resolveMediaIdFromIndex: (index: number) => {
    return backgroundMedia[index]?.fileName ?? null;
  },
};

function getInfusionMediaFromBackground(background: { index?: number;
  mediaId?: string; }) {
  const selection = resolveMediaSelection(background, infusionMediaSelectionOptions);

  if (selection) {
    return {
      url: getMediaUrl(selection.item),
      type: selection.type,
    };
  }

  return {
    url: '',
    type: 'image' as const,
  };
}

const infusionMediaInfo = computed(() => getInfusionMediaFromBackground(effectivePageSettings.value.background));

const infusionSrc = computed(() => infusionMediaInfo.value.url);
const infusionType = computed(() => infusionMediaInfo.value.type);

watch(
  () => resolveMediaSelection(
    effectivePageSettings.value.background,
    infusionMediaSelectionOptions,
  )?.item ?? null,
  (selectionItem) => {
    if (selectionItem) {
      ensureMediaCached(selectionItem);
    }
  },
  { immediate: true },
);

const infusionOpacity = computed(() => effectivePageSettings.value.opacity / 100);
const infusionBlur = computed(() => effectivePageSettings.value.blur);
const infusionNoise = computed(() => effectivePageSettings.value.noise / 100);
const infusionNoiseScale = computed(() => effectivePageSettings.value.noiseScale);
const infusionBlendMode = computed(() => effectivePageSettings.value.mixBlendMode);
const infusionEnabled = computed(() => infusionSettings.value.enabled);

const pauseOverlayBackgroundVideo = computed(() => {
  if (infusionType.value !== 'video') {
    return false;
  }

  if (!infusionSettings.value.pauseVideoWhenIdle) {
    return false;
  }

  return appStateStore.isUserIdle || appWindowStore.isMainWindowMinimized;
});
</script>

<template>
  <Infusion
    v-if="infusionEnabled"
    :src="infusionSrc"
    :type="infusionType"
    :opacity="infusionOpacity"
    :opacity-dark="infusionOpacity"
    :blur="infusionBlur"
    :noise-opacity="infusionNoise"
    :noise-scale="infusionNoiseScale"
    :blend-mode="infusionBlendMode"
    :pause-playback="pauseOverlayBackgroundVideo"
  />
</template>
