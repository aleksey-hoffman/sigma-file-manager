<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Infusion } from './index';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useHomeBannerMedia } from '@/modules/home/composables/use-home-banner-media';
import { DEFAULT_INFUSION_BACKGROUND_FILE_NAME } from '@/data/home-banner-media';
import type { InfusionPage } from '@/types/user-settings';

const userSettingsStore = useUserSettingsStore();
const route = useRoute();
const { allMediaItems, getPositionKey, getMediaUrl } = useHomeBannerMedia();

const infusionSettings = computed(() => userSettingsStore.userSettings.infusion);

const currentRouteName = computed(() => (route.name as InfusionPage) || '');

const effectivePageSettings = computed(() => {
  const settings = infusionSettings.value;

  if (settings.sameSettingsForAllPages) {
    return settings.pages[''];
  }

  return settings.pages[currentRouteName.value] || settings.pages[''];
});

function getInfusionMediaFromBackground(background: { index?: number;
  mediaId?: string; }) {
  const mediaId = (typeof background.mediaId === 'string' && background.mediaId.trim())
    ? background.mediaId
    : DEFAULT_INFUSION_BACKGROUND_FILE_NAME;

  const items = allMediaItems.value;
  const item = items.find(i => getPositionKey(i) === mediaId);

  if (item) {
    return {
      url: getMediaUrl(item),
      type: item.kind === 'builtin' ? item.data.type : item.type,
    };
  }

  const fallback = items.find(
    i => i.kind === 'builtin' && i.data.fileName === DEFAULT_INFUSION_BACKGROUND_FILE_NAME,
  ) ?? items[0];

  if (fallback) {
    return {
      url: getMediaUrl(fallback),
      type: fallback.kind === 'builtin' ? fallback.data.type : fallback.type,
    };
  }

  return {
    url: '',
    type: 'image' as const,
  };
}

const infusionSrc = computed(() => getInfusionMediaFromBackground(effectivePageSettings.value.background).url);
const infusionType = computed(() => getInfusionMediaFromBackground(effectivePageSettings.value.background).type);

const infusionOpacity = computed(() => effectivePageSettings.value.opacity / 100);
const infusionBlur = computed(() => effectivePageSettings.value.blur);
const infusionNoise = computed(() => effectivePageSettings.value.noise / 100);
const infusionNoiseScale = computed(() => effectivePageSettings.value.noiseScale);
const infusionEnabled = computed(() => infusionSettings.value.enabled);
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
  />
</template>
