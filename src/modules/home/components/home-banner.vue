<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RefreshCwIcon } from 'lucide-vue-next';
import { homeBannerMedia } from '@/data/home-banner-media';
import type { BannerMedia } from '@/data/home-banner-media';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

const bannerImages = import.meta.glob('@/assets/media/home-banner/*.jpg', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const bannerVideos = import.meta.glob('@/assets/media/home-banner/*.mp4', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const currentIndex = computed(() => {
  const index = userSettingsStore.userSettings.homeBannerIndex;

  if (index >= 0 && index < homeBannerMedia.length) {
    return index;
  }

  return 0;
});

const currentBanner = computed<BannerMedia>(() => {
  return homeBannerMedia[currentIndex.value];
});

const currentMediaUrl = computed(() => {
  const fileName = currentBanner.value.fileName;
  const mediaMap = currentBanner.value.type === 'video' ? bannerVideos : bannerImages;
  const key = Object.keys(mediaMap).find(path => path.includes(fileName));
  return key ? mediaMap[key] : '';
});

const imageStyle = computed(() => ({
  objectPosition: `${currentBanner.value.positionX}% ${currentBanner.value.positionY}%`,
}));

const setPreviousBackgroundShortcutText = computed(() => {
  return `Alt+${t('click')}`;
});

async function nextBanner() {
  const newIndex = (currentIndex.value + 1) % homeBannerMedia.length;
  await userSettingsStore.set('homeBannerIndex', newIndex);
}

async function previousBanner() {
  const newIndex = currentIndex.value === 0
    ? homeBannerMedia.length - 1
    : currentIndex.value - 1;
  await userSettingsStore.set('homeBannerIndex', newIndex);
}

async function handleClick(event: MouseEvent) {
  if (event.altKey) {
    await previousBanner();
  }
  else {
    await nextBanner();
  }
}
</script>

<template>
  <div class="home-banner">
    <div class="home-banner__media-container">
      <img
        v-if="currentBanner.type === 'image'"
        :src="currentMediaUrl"
        :style="imageStyle"
        class="home-banner__media"
        alt=""
      >
      <video
        v-else-if="currentBanner.type === 'video'"
        :src="currentMediaUrl"
        :style="imageStyle"
        class="home-banner__media"
        autoplay
        loop
        muted
        playsinline
      />
    </div>

    <div class="home-banner__overlay home-banner__overlay--top" />
    <div class="home-banner__overlay home-banner__overlay--bottom" />

    <div class="home-banner__actions">
      <span class="home-banner__title">
        {{ t('pages.home') }}
      </span>

      <Tooltip :delay-duration="0">
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="home-banner__action-button"
            @click="handleClick($event)"
          >
            <RefreshCwIcon
              :size="16"
              class="home-banner__action-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <div>{{ t('home.setNextBackground') }}</div>
          <div class="home-banner__tooltip-shortcut">
            {{ t('home.setPreviousBackground') }}
            <kbd class="shortcut">{{ setPreviousBackgroundShortcutText }}</kbd>
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<style>
.home-banner {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 50vh;
  min-height: 300px;
  max-height: 500px;
}

.home-banner__media-container {
  width: 100%;
  height: 100%;
  padding: 6px;
  padding-left: 0;
  border-radius: var(--radius-sm);
}

.home-banner__media {
  overflow: hidden;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-sm);
  object-fit: cover;
  transition: opacity 0.5s ease;
}

.home-banner__overlay {
  position: absolute;
  left: 0;
  width: 100%;
  pointer-events: none;
}

.home-banner__overlay--top {
  top: 0;
  height: 100px;
  background: linear-gradient(
    to bottom,
    hsl(var(--background-3)) 0%,
    hsl(var(--background-3) / 80%) 20%,
    hsl(var(--background-3) / 50%) 40%,
    hsl(var(--background-3) / 20%) 70%,
    transparent 100%
  );
}

.home-banner__overlay--bottom {
  bottom: 0;
  height: 150px;
  background: linear-gradient(
    to top,
    hsl(var(--background-3)) 0%,
    hsl(var(--background-3) / 95%) 20%,
    hsl(var(--background-3) / 70%) 40%,
    hsl(var(--background-3) / 30%) 70%,
    transparent 100%
  );
}

.home-banner__actions {
  position: absolute;
  z-index: 3;
  bottom: 12px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-banner__title {
  margin-left: 8px;
  color: hsl(var(--foreground));
  font-size: 20px;
  font-weight: 600;
  text-shadow: 0 1px 3px hsl(0deg 0% 0% / 50%);
}

.home-banner__action-button {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  margin-top: 4px;
  backdrop-filter: blur(4px);
  background-color: hsl(var(--background) / 10%);
}

.home-banner__action-button:hover {
  background-color: hsl(var(--background) / 50%);
}

.home-banner__action-icon {
  stroke: hsl(var(--foreground));
}

.home-banner__tooltip-shortcut {
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
