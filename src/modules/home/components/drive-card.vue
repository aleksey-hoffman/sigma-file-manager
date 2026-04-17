<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { invoke } from '@tauri-apps/api/core';
import { HardDriveIcon, NetworkIcon, UsbIcon, UnplugIcon } from '@lucide/vue';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { usePlatformStore } from '@/stores/runtime/platform';
import toReadableBytes from '@/utils/to-readable-bytes';
import { getPathDisplayValue } from '@/utils/normalize-path';
import type { DriveInfo } from '@/types/drive-info';
import { CircularProgress, LinearBar, EdgeIndicator } from './indicators';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';

const props = defineProps<{
  drive: DriveInfo;
}>();

const router = useRouter();
const { t } = useI18n();
const workspacesStore = useWorkspacesStore();
const userSettingsStore = useUserSettingsStore();
const platformStore = usePlatformStore();

const isMounting = ref(false);

const LOW_SPACE_THRESHOLD = 15;

const showIndicator = computed(() => userSettingsStore.userSettings.driveCard.showSpaceIndicator);
const indicatorStyle = computed(() => userSettingsStore.userSettings.driveCard.spaceIndicatorStyle);
const hasSpaceData = computed(() => props.drive.total_space > 0);

const isLowSpace = computed(() => hasSpaceData.value && props.drive.percent_used >= (100 - LOW_SPACE_THRESHOLD));

const formattedSpaceInfo = computed(() => {
  if (!props.drive.is_mounted) {
    return t('driveNotMounted');
  }

  if (!hasSpaceData.value) {
    return getPathDisplayValue(props.drive.mount_point);
  }

  const available = toReadableBytes(props.drive.available_space, 1);
  const total = toReadableBytes(props.drive.total_space, 1);
  return `${available} ${t('freeOf')} ${total}`;
});

const isCircular = computed(() => indicatorStyle.value === 'circular');
const isLinearVertical = computed(() => indicatorStyle.value === 'linearVertical');
const isLinearHorizontal = computed(() => indicatorStyle.value === 'linearHorizontal');
const isLinearHorizontalCentered = computed(() => indicatorStyle.value === 'linearHorizontalCentered');

const isWslDrive = computed(() => props.drive.drive_type === 'WSL');

const driveIcon = computed(() => {
  if (props.drive.drive_type === 'Network') {
    return NetworkIcon;
  }

  return props.drive.is_removable ? UsbIcon : HardDriveIcon;
});

async function handleClick() {
  if (!props.drive.is_mounted) {
    await mountAndNavigate();
    return;
  }

  await navigateToDrive(props.drive.path);
}

async function mountAndNavigate() {
  isMounting.value = true;

  try {
    const mountPoint = await invoke<string>('mount_drive', { devicePath: props.drive.device_path });

    if (mountPoint) {
      await navigateToDrive(mountPoint);
    }
  }
  catch (mountError) {
    console.error('Failed to mount drive:', mountError);
  }
  finally {
    isMounting.value = false;
  }
}

async function navigateToDrive(drivePath: string) {
  try {
    await workspacesStore.openNewTabGroup(drivePath);
    router.push({ name: 'navigator' });
  }
  catch (navigationError) {
    console.error('Failed to navigate to directory:', navigationError);
  }
}

async function handleUnmount(clickEvent: MouseEvent) {
  clickEvent.stopPropagation();

  try {
    await invoke('unmount_drive', {
      devicePath: props.drive.device_path,
      mountPoint: props.drive.mount_point,
    });
  }
  catch (unmountError) {
    console.error('Failed to unmount drive:', unmountError);
  }
}
</script>

<template>
  <button
    type="button"
    class="drive-card"
    :class="{
      'drive-card--circular': isCircular && showIndicator && hasSpaceData && drive.is_mounted,
      'drive-card--unmounted': !drive.is_mounted,
    }"
    @click="handleClick"
  >
    <EdgeIndicator
      v-if="drive.is_mounted && hasSpaceData && showIndicator && isLinearVertical"
      direction="vertical"
      :percent-used="drive.percent_used"
      :is-low-space="isLowSpace"
    />

    <EdgeIndicator
      v-if="drive.is_mounted && hasSpaceData && showIndicator && isLinearHorizontal"
      direction="horizontal"
      :percent-used="drive.percent_used"
      :is-low-space="isLowSpace"
    />

    <div class="drive-card__preview">
      <CircularProgress
        v-if="drive.is_mounted && hasSpaceData && showIndicator && isCircular"
        :percent-used="drive.percent_used"
        :is-low-space="isLowSpace"
      />

      <template v-else>
        <UbuntuWslIcon
          v-if="isWslDrive"
          :size="20"
          class="drive-card__icon"
        />
        <component
          v-else
          :is="driveIcon"
          :size="20"
          class="drive-card__icon"
        />
        <span
          v-if="drive.is_mounted && hasSpaceData"
          class="drive-card__percent"
        >
          {{ drive.percent_used }}%
        </span>
      </template>
    </div>

    <div class="drive-card__content">
      <div class="drive-card__name">
        {{ drive.name }}
      </div>

      <LinearBar
        v-if="drive.is_mounted && hasSpaceData && showIndicator && isLinearHorizontalCentered"
        :percent-used="drive.percent_used"
        :is-low-space="isLowSpace"
      />

      <div class="drive-card__space-info">
        <template v-if="isMounting">
          {{ t('mounting') }}...
        </template>
        <template v-else>
          {{ formattedSpaceInfo }}
        </template>
      </div>
    </div>

    <button
      v-if="drive.is_mounted && !platformStore.isWindows"
      type="button"
      class="drive-card__eject"
      :title="t('unmount')"
      @click="handleUnmount"
    >
      <UnplugIcon :size="14" />
    </button>
  </button>
</template>

<style>
.drive-card {
  position: relative;
  display: grid;
  overflow: hidden;
  width: 100%;
  height: 100%;
  align-items: center;
  padding: 0 8px 0 0;
  border: none;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  cursor: pointer;
  gap: 0;
  grid-template-columns: 56px 1fr auto;
  text-align: left;
  transition: background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.drive-card:hover {
  background-color: hsl(var(--muted));
  transition: background-color var(--hover-transition-duration-in);
}

.drive-card:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.drive-card--circular {
  grid-template-columns: 60px 1fr;
}

.drive-card--unmounted {
  opacity: 0.6;
  transition: background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out), opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.drive-card--unmounted:hover {
  opacity: 1;
  transition: background-color var(--hover-transition-duration-in), opacity var(--hover-transition-duration-in);
}

.drive-card__preview {
  position: relative;
  display: flex;
  width: 56px;
  height: 56px;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.drive-card--circular .drive-card__preview {
  width: 60px;
  height: 60px;
}

.drive-card__icon {
  color: hsl(var(--muted-foreground));
}

.drive-card__percent {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
}

.drive-card__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  padding: 8px 0;
  gap: 4px;
}

.drive-card__name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drive-card__space-info {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.drive-card__eject {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0;
  transition:
    opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.drive-card:hover .drive-card__eject {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.drive-card__eject:hover {
  background-color: hsl(var(--accent));
  color: hsl(var(--accent-foreground));
}
</style>
