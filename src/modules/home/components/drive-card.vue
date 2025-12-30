<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { HardDriveIcon, UsbIcon } from 'lucide-vue-next';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import toReadableBytes from '@/utils/to-readable-bytes';
import type { DriveInfo } from '@/types/drive-info';
import { CircularProgress, LinearBar, EdgeIndicator } from './indicators';

const props = defineProps<{
  drive: DriveInfo;
}>();

const router = useRouter();
const { t } = useI18n();
const workspacesStore = useWorkspacesStore();
const userSettingsStore = useUserSettingsStore();

const LOW_SPACE_THRESHOLD = 15;

const showIndicator = computed(() => userSettingsStore.userSettings.driveCard.showSpaceIndicator);
const indicatorStyle = computed(() => userSettingsStore.userSettings.driveCard.spaceIndicatorStyle);

const isLowSpace = computed(() => props.drive.percent_used >= (100 - LOW_SPACE_THRESHOLD));

const formattedSpaceInfo = computed(() => {
  const available = toReadableBytes(props.drive.available_space, 1);
  const total = toReadableBytes(props.drive.total_space, 1);
  return `${available} ${t('freeOf')} ${total}`;
});

const isCircular = computed(() => indicatorStyle.value === 'circular');
const isLinearVertical = computed(() => indicatorStyle.value === 'linearVertical');
const isLinearHorizontal = computed(() => indicatorStyle.value === 'linearHorizontal');
const isLinearHorizontalCentered = computed(() => indicatorStyle.value === 'linearHorizontalCentered');

const driveIcon = computed(() => props.drive.is_removable ? UsbIcon : HardDriveIcon);

async function handleClick() {
  try {
    await workspacesStore.openNewTabGroup(props.drive.path);
    router.push({ name: 'navigator' });
  }
  catch (error) {
    console.error('Failed to navigate to directory:', error);
  }
}
</script>

<template>
  <button
    type="button"
    class="drive-card"
    :class="{ 'drive-card--circular': isCircular && showIndicator }"
    @click="handleClick"
  >
    <EdgeIndicator
      v-if="showIndicator && isLinearVertical"
      direction="vertical"
      :percent-used="drive.percent_used"
      :is-low-space="isLowSpace"
    />

    <EdgeIndicator
      v-if="showIndicator && isLinearHorizontal"
      direction="horizontal"
      :percent-used="drive.percent_used"
      :is-low-space="isLowSpace"
    />

    <div class="drive-card__preview">
      <CircularProgress
        v-if="showIndicator && isCircular"
        :percent-used="drive.percent_used"
        :is-low-space="isLowSpace"
      />

      <template v-else>
        <component
          :is="driveIcon"
          :size="20"
          class="drive-card__icon"
        />
        <span class="drive-card__percent">
          {{ drive.percent_used }}%
        </span>
      </template>
    </div>

    <div class="drive-card__content">
      <div class="drive-card__name">
        {{ drive.name }}
      </div>

      <LinearBar
        v-if="showIndicator && isLinearHorizontalCentered"
        :percent-used="drive.percent_used"
        :is-low-space="isLowSpace"
      />

      <div class="drive-card__space-info">
        {{ formattedSpaceInfo }}
      </div>
    </div>
  </button>
</template>

<style>
.drive-card {
  position: relative;
  display: grid;
  overflow: hidden;
  align-items: center;
  padding: 0 12px 0 0;
  border: none;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  color: hsl(var(--card-foreground));
  cursor: pointer;
  gap: 0;
  grid-template-columns: 56px 1fr;
  text-align: left;
  transition: background-color 0.15s ease;
}

.drive-card:hover {
  background-color: hsl(var(--muted));
}

.drive-card:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.drive-card--circular {
  grid-template-columns: 60px 1fr;
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
</style>
