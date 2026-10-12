<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useAppStateStore } from '@/stores/runtime/app-state';
import { useAppWindowStore } from '@/stores/runtime/app-window';
import { useI18n } from 'vue-i18n';
import {
  RefreshCwIcon,
  SettingsIcon,
  MoveIcon,
  RotateCcwIcon,
  ImageIcon,
} from '@lucide/vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useBackgroundMedia } from '@/modules/home/composables/use-background-media';

const BackgroundManagerDialog = defineAsyncComponent(
  () => import('@/components/ui/background-manager/background-manager-dialog.vue'),
);
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
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
import { DEFAULT_BACKGROUND_FILE_NAME } from '@/data/background-media';
import { useDropOverlayStore } from '@/stores/runtime/drop-overlay';
import { homeBannerStorageKeys } from '../background-storage-keys';

const dropOverlayStore = useDropOverlayStore();
const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const appStateStore = useAppStateStore();
const appWindowStore = useAppWindowStore();
const {
  currentItem,
  getPositionKey,
  getMediaUrl,
  selectMedia,
  ensureMediaCached,
  resolveOffsetMediaSelection,
} = useBackgroundMedia();

const videoRef = ref<HTMLVideoElement | null>(null);
const isDropdownOpen = ref(false);
const isPositionPopoverOpen = ref(false);
const isMediaEditorOpen = ref(false);

watch(isMediaEditorOpen, (open) => {
  dropOverlayStore.setBackgroundManagerOpen(open);
}, { immediate: true });

const currentMediaUrl = computed(() => {
  const item = currentItem.value;
  return item ? getMediaUrl(item) : '';
});

const currentMediaType = computed(() => {
  const item = currentItem.value;
  if (!item) return 'image';
  return item.kind === 'builtin' ? item.data.type : item.type;
});

const currentPositionX = computed(() => {
  const item = currentItem.value;
  if (!item) return 50;
  return item.kind === 'builtin' ? item.data.positionX : 50;
});

const currentPositionY = computed(() => {
  const item = currentItem.value;
  if (!item) return 50;
  return item.kind === 'builtin' ? item.data.positionY : 50;
});

const positionKey = computed(() => {
  const item = currentItem.value;
  return item ? getPositionKey(item) : null;
});

const customPosition = computed(() => {
  const key = positionKey.value;
  return key ? userSettingsStore.userSettings.homeBannerPositions[key] : undefined;
});

const positionX = computed(() => customPosition.value?.positionX ?? currentPositionX.value);
const positionY = computed(() => customPosition.value?.positionY ?? currentPositionY.value);
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

const isVideo = computed(() => currentMediaType.value === 'video');

const shouldPlayBannerVideo = computed(() => {
  if (!isVideo.value || !currentMediaUrl.value) {
    return false;
  }

  if (isPositionPopoverOpen.value) {
    return false;
  }

  if (userSettingsStore.userSettings.homeBannerPauseVideoWhenIdle) {
    if (appStateStore.isUserIdle || appWindowStore.isMainWindowMinimized) {
      return false;
    }
  }

  return true;
});

watch([shouldPlayBannerVideo, videoRef], ([shouldPlay]) => {
  const videoElement = videoRef.value;

  if (!videoElement || !isVideo.value) {
    return;
  }

  if (shouldPlay) {
    void videoElement.play().catch(() => {});
  }
  else {
    videoElement.pause();
  }
}, { immediate: true });

watch(currentItem, (item) => {
  if (item) {
    ensureMediaCached(item);
  }
}, { immediate: true });

async function updateSetting(property: 'positionX' | 'positionY' | 'zoom', value: number) {
  const key = positionKey.value;
  if (!key) return;

  const currentPositions = { ...userSettingsStore.userSettings.homeBannerPositions };
  const existingPosition = currentPositions[key] ?? {
    positionX: currentPositionX.value,
    positionY: currentPositionY.value,
    zoom: 100,
  };

  currentPositions[key] = {
    ...existingPosition,
    [property]: value,
  };

  await userSettingsStore.set(homeBannerStorageKeys.positions, currentPositions);
}

async function resetPosition() {
  const key = positionKey.value;
  if (!key) return;

  const currentPositions = { ...userSettingsStore.userSettings.homeBannerPositions };
  delete currentPositions[key];
  await userSettingsStore.set(homeBannerStorageKeys.positions, currentPositions);
}

async function nextBanner() {
  const selection = resolveOffsetMediaSelection(
    {
      mediaId: userSettingsStore.userSettings.homeBannerMediaId,
      index: userSettingsStore.userSettings.homeBannerIndex,
    },
    1,
    {
      defaultMediaId: DEFAULT_BACKGROUND_FILE_NAME,
    },
  );

  if (!selection) {
    return;
  }

  await selectMedia(selection.index);
}

async function previousBanner() {
  const selection = resolveOffsetMediaSelection(
    {
      mediaId: userSettingsStore.userSettings.homeBannerMediaId,
      index: userSettingsStore.userSettings.homeBannerIndex,
    },
    -1,
    {
      defaultMediaId: DEFAULT_BACKGROUND_FILE_NAME,
    },
  );

  if (!selection) {
    return;
  }

  await selectMedia(selection.index);
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
</script>

<template>
  <div class="home-banner">
    <div class="home-banner__media-container">
      <img
        v-if="currentMediaType === 'image' && currentMediaUrl"
        :src="currentMediaUrl"
        :style="mediaStyle"
        class="home-banner__media"
        alt=""
      >
      <video
        v-else-if="currentMediaType === 'video' && currentMediaUrl"
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

    <!--
      FORK-MODIFICATION: 验收反馈 2026-10-12 — 去掉顶部 / 底部渐变 overlay。
      原版:两个绝对定位的渐变 div(__overlay--top / --bottom)模拟"标题悬浮在图片上"的氛围。
      需求:"顶部和底部为渐变效果,希望去除渐变效果,显示尺寸高度适当缩小,
            和下面的标题文字"主页"保持足够间距"。
      修法:删两个 overlay div + 对应 CSS;actions 容器 position 仍 absolute,保持原视觉锚点。
    -->

    <div class="home-banner__actions">
      <span class="home-banner__title">
        {{ t('pages.home') }}
      </span>

      <Tooltip>
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
            <ContextMenuShortcut>{{ setPreviousBackgroundShortcutText }}</ContextMenuShortcut>
          </div>
        </TooltipContent>
      </Tooltip>

      <DropdownMenu
        :open="isDropdownOpen"
        @update:open="handleDropdownOpenChange"
      >
        <Tooltip>
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
            side="bottom"
            align="start"
          >
            <DropdownMenuItem
              class="home-banner__menu-item"
              @click="isDropdownOpen = false; isMediaEditorOpen = true"
            >
              <ImageIcon :size="16" />
              <span>{{ t('home.backgroundManager') }}</span>
            </DropdownMenuItem>
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
                @focus-outside="preventPopoverClose"
              >
                <div class="home-banner__position-controls">
                  <div class="home-banner__position-header">
                    <span class="home-banner__position-title">{{ t('home.backgroundPosition') }}</span>
                    <Tooltip>
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

    <BackgroundManagerDialog
      v-if="isMediaEditorOpen"
      v-model:open="isMediaEditorOpen"
    />
  </div>
</template>

<style>
.home-banner {
  position: relative;
  overflow: hidden;
  width: 100%;
  /* FORK-MODIFICATION: 验收反馈 2026-10-12 — 缩小 banner 高度,留出与"主页"标题
     / 下方 UserDirectories / Drives 区的视觉呼吸感。原 50vh / min 300 / max 500。 */
  height: 28vh;
  min-height: 180px;
  max-height: 280px;
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
  pointer-events: none;
  transition: opacity 0.5s ease;
}

/*
  FORK-MODIFICATION: 验收反馈 2026-10-12 — 顶部 / 底部渐变 overlay 已删除。
  原 .home-banner__overlay / --top / --bottom 全部移除(对应 template 的 div 也已删)。
*/

.home-banner__actions {
  position: absolute;
  z-index: 3;
  /* FORK-MODIFICATION: 验收反馈 2026-10-12 — 距 banner 底 20px,与下方内容保持间距。 */
  bottom: 20px;
  left: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.home-banner__title {
  color: hsl(var(--foreground));
  font-size: 20px;
  font-weight: 600;
  /* FORK-MODIFICATION: 验收反馈 2026-10-12 — 渐变已去,文字阴影也不再需要,移除。 */
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  gap: 12px;
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
