<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { Infusion } from './index';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { homeBannerMedia } from '@/data/home-banner-media';
import type { InfusionPage } from '@/types/user-settings';

const userSettingsStore = useUserSettingsStore();
const route = useRoute();

const bannerImages = import.meta.glob('@/assets/media/home-banner/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const bannerVideos = import.meta.glob('@/assets/media/home-banner/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const infusionSettings = computed(() => userSettingsStore.userSettings.infusion);

const currentRouteName = computed(() => (route.name as InfusionPage) || '');

const effectivePageSettings = computed(() => {
  const settings = infusionSettings.value;

  if (settings.sameSettingsForAllPages) {
    return settings.pages[''];
  }

  return settings.pages[currentRouteName.value] || settings.pages[''];
});

function getMediaUrl(fileName: string, type: 'image' | 'video'): string {
  const mediaMap = type === 'video' ? bannerVideos : bannerImages;
  const key = Object.keys(mediaMap).find(path => path.includes(fileName));
  return key ? mediaMap[key] : '';
}

const infusionSrc = computed(() => {
  const background = effectivePageSettings.value.background;
  const media = homeBannerMedia[background.index];

  if (!media) {
    const fallbackMedia = homeBannerMedia[0];
    return getMediaUrl(fallbackMedia.fileName, fallbackMedia.type);
  }

  return getMediaUrl(media.fileName, media.type);
});

const infusionType = computed(() => {
  const background = effectivePageSettings.value.background;
  const media = homeBannerMedia[background.index];
  return media?.type || 'image';
});

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
