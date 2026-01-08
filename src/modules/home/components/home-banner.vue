<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  RefreshCwIcon,
  SettingsIcon,
  MoveIcon,
  RotateCcwIcon,
} from 'lucide-vue-next';
import { homeBannerMedia } from '@/data/home-banner-media';
import type { BannerMedia } from '@/data/home-banner-media';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

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

const videoRef = ref<HTMLVideoElement | null>(null);
const isDropdownOpen = ref(false);
const isPositionPopoverOpen = ref(false);
const wasVideoPlaying = ref(false);

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

const customPosition = computed(() => {
  return userSettingsStore.userSettings.homeBannerPositions[currentIndex.value];
});

const positionX = computed(() => customPosition.value?.positionX ?? currentBanner.value.positionX);
const positionY = computed(() => customPosition.value?.positionY ?? currentBanner.value.positionY);
const zoom = computed(() => customPosition.value?.zoom ?? 100);

const positionXArray = computed({
  get: () => [positionX.value],
  set: (value: number[]) => updateSetting('positionX', value[0]),
});

const positionYArray = computed({
  get: () => [positionY.value],
  set: (value: number[]) => updateSetting('positionY', value[0]),
});

const zoomArray = computed({
  get: () => [zoom.value],
  set: (value: number[]) => updateSetting('zoom', value[0]),
});

const mediaStyle = computed(() => ({
  objectPosition: `${positionX.value}% ${positionY.value}%`,
  transform: `scale(${zoom.value / 100})`,
  transformOrigin: `${positionX.value}% ${positionY.value}%`,
}));

const setPreviousBackgroundShortcutText = computed(() => {
  return `Alt+${t('click')}`;
});

const isVideo = computed(() => currentBanner.value.type === 'video');

async function updateSetting(property: 'positionX' | 'positionY' | 'zoom', value: number) {
  const currentPositions = { ...userSettingsStore.userSettings.homeBannerPositions };
  const existingPosition = currentPositions[currentIndex.value] ?? {
    positionX: currentBanner.value.positionX,
    positionY: currentBanner.value.positionY,
    zoom: 100,
  };

  currentPositions[currentIndex.value] = {
    ...existingPosition,
    [property]: value,
  };

  await userSettingsStore.set('homeBannerPositions', currentPositions);
}

async function resetPosition() {
  const currentPositions = { ...userSettingsStore.userSettings.homeBannerPositions };
  delete currentPositions[currentIndex.value];
  await userSettingsStore.set('homeBannerPositions', currentPositions);
}

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

function handleDropdownOpenChange(open: boolean) {
  if (!open && isPositionPopoverOpen.value) {
    return;
  }

  isDropdownOpen.value = open;
}

function handlePositionPopoverOpenChange(open: boolean) {
  isPositionPopoverOpen.value = open;

  if (!open) {
    isDropdownOpen.value = false;
  }
}

function preventPopoverClose(event: Event) {
  event.preventDefault();
}

watch(isPositionPopoverOpen, (isOpen) => {
  if (!videoRef.value) {
    return;
  }

  if (isOpen && isVideo.value) {
    wasVideoPlaying.value = !videoRef.value.paused;
    videoRef.value.pause();
  }
  else if (!isOpen && wasVideoPlaying.value) {
    videoRef.value.play();
  }
});
</script>

<template>
  <div class="home-banner">
    <div class="home-banner__media-container">
      <img
        v-if="currentBanner.type === 'image'"
        :src="currentMediaUrl"
        :style="mediaStyle"
        class="home-banner__media"
        alt=""
      >
      <video
        v-else-if="currentBanner.type === 'video'"
        ref="videoRef"
        :src="currentMediaUrl"
        :style="mediaStyle"
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

      <DropdownMenu
        :open="isDropdownOpen"
        @update:open="handleDropdownOpenChange"
      >
        <Tooltip :delay-duration="0">
          <TooltipTrigger as-child>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon"
                class="home-banner__action-button"
              >
                <SettingsIcon
                  :size="16"
                  class="home-banner__action-icon"
                />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
          >
            <Popover
              :open="isPositionPopoverOpen"
              :modal="false"
              @update:open="handlePositionPopoverOpenChange"
            >
              <PopoverTrigger as-child>
                <DropdownMenuItem
                  class="home-banner__menu-item"
                  @select.prevent
                >
                  <MoveIcon :size="16" />
                  <span>{{ t('home.backgroundPosition') }}</span>
                </DropdownMenuItem>
              </PopoverTrigger>

              <PopoverContent
                side="right"
                align="start"
                :side-offset="8"
                class="home-banner__position-popover"
                @interact-outside="preventPopoverClose"
                @focus-outside="preventPopoverClose"
              >
                <div class="home-banner__position-controls">
                  <div class="home-banner__position-header">
                    <span class="home-banner__position-title">{{ t('home.backgroundPosition') }}</span>
                    <Tooltip :delay-duration="0">
                      <TooltipTrigger as-child>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="home-banner__position-reset"
                          @click="resetPosition"
                        >
                          <RotateCcwIcon :size="14" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {{ t('home.resetBackgroundPosition') }}
                      </TooltipContent>
                    </Tooltip>
                  </div>

                  <div class="home-banner__position-slider-group">
                    <div class="home-banner__position-label">
                      {{ t('dialogs.homeBannerPositionDialog.positionXAxis') }}: {{ positionX }}%
                    </div>
                    <Slider
                      v-model="positionXArray"
                      :min="0"
                      :max="100"
                      :step="1"
                    />
                  </div>

                  <div class="home-banner__position-slider-group">
                    <div class="home-banner__position-label">
                      {{ t('dialogs.homeBannerPositionDialog.positionYAxis') }}: {{ positionY }}%
                    </div>
                    <Slider
                      v-model="positionYArray"
                      :min="0"
                      :max="100"
                      :step="1"
                    />
                  </div>

                  <div class="home-banner__position-slider-group">
                    <div class="home-banner__position-label">
                      {{ t('home.backgroundZoom') }}: {{ zoom }}%
                    </div>
                    <Slider
                      v-model="zoomArray"
                      :min="100"
                      :max="200"
                      :step="1"
                    />
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    class="home-banner__position-done"
                    @click="isPositionPopoverOpen = false"
                  >
                    {{ t('done') }}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </DropdownMenuContent>
          <TooltipContent side="top">
            {{ t('home.mediaBannerOptions') }}
          </TooltipContent>
        </Tooltip>
      </DropdownMenu>
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

.home-banner__menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-banner__position-popover {
  width: 280px;
}

.home-banner__position-controls {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.home-banner__position-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.home-banner__position-title {
  font-size: 14px;
  font-weight: 500;
}

.home-banner__position-reset {
  width: 24px;
  height: 24px;
}

.home-banner__position-slider-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.home-banner__position-label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.home-banner__position-done {
  margin-top: 4px;
}
</style>
