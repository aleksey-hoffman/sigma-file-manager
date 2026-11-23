<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PanelRightIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsItem } from '@/modules/settings';
import { useInfoPanelBooleanSetting } from '@/modules/settings/composables/use-info-panel-boolean-setting';
import { useInfoPanelLayout } from '@/modules/navigator/components/info-panel/composables/use-info-panel-layout';
import {
  DEFAULT_AUTO_PREVIEW_MAX_SIZE_MB,
  INFO_PANEL_PREVIEW_FILE_TYPES,
  AUTO_PREVIEW_MAX_SIZE_MB_OPTIONS,
} from '@/modules/navigator/components/info-panel/utils/info-panel-preview-gate';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { InfoPanelPreviewFileType } from '@/types/user-settings';

const shortcutsStore = useShortcutsStore();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();
const {
  isDynamicSize: infoPanelDynamicSize,
  enableDynamicSize,
  disableDynamicSize,
} = useInfoPanelLayout();

const showFullSizeImagePreview = useInfoPanelBooleanSetting('showFullSizeImagePreview');
const muteVideoPreviewByDefault = useInfoPanelBooleanSetting('muteVideoPreviewByDefault');
const autoplayVideoPreview = useInfoPanelBooleanSetting('autoplayVideoPreview');

const quickViewShortcutLabel = computed(() => shortcutsStore.getShortcutLabel('quickView'));

const autoPreviewFileTypes = computed(() => userSettingsStore.userSettings.navigator.infoPanel.autoPreviewFileTypes);

function setAutoPreviewFileType(fileType: InfoPanelPreviewFileType, enabled: boolean) {
  void userSettingsStore.set(`navigator.infoPanel.autoPreviewFileTypes.${fileType}`, enabled);
}

const autoPreviewMaxSizeOptions = computed(() => AUTO_PREVIEW_MAX_SIZE_MB_OPTIONS.map(sizeMb => ({
  name: sizeMb === 0
    ? t('settings.infoPanel.autoPreviewNoLimit')
    : t('settings.infoPanel.autoPreviewSizeOption', { size: sizeMb }),
  value: sizeMb,
})));

const selectedAutoPreviewMaxSize = computed({
  get: () => {
    const value = userSettingsStore.userSettings.navigator.infoPanel.autoPreviewMaxSizeMb;
    const options = autoPreviewMaxSizeOptions.value;

    return options.find(option => option.value === value)
      ?? options.find(option => option.value === DEFAULT_AUTO_PREVIEW_MAX_SIZE_MB);
  },
  set: (option) => {
    if (option) {
      void userSettingsStore.set('navigator.infoPanel.autoPreviewMaxSizeMb', option.value);
    }
  },
});

function handleToggleInfoPanelDynamicSize(enabled: boolean) {
  if (enabled) {
    void enableDynamicSize();
    return;
  }

  void disableDynamicSize();
}
</script>

<template>
  <SettingsItem
    :title="t('settings.infoPanel.title')"
    :icon="PanelRightIcon"
  >
    <template #nested>
      <div class="info-panel-settings">
        <div class="info-panel-settings__row">
          <div class="info-panel-settings__copy">
            <span class="info-panel-settings__label">
              {{ t('settings.infoPanel.dynamicSize') }}
            </span>
            <p class="info-panel-settings__description">
              {{ t('settings.infoPanel.dynamicSizeTooltip') }}
            </p>
          </div>
          <Switch
            :model-value="infoPanelDynamicSize"
            @update:model-value="handleToggleInfoPanelDynamicSize"
          />
        </div>

        <div class="info-panel-settings__row">
          <div class="info-panel-settings__copy">
            <span class="info-panel-settings__label">
              {{ t('settings.infoPanel.autoPreviewFileTypes') }}
            </span>
            <p class="info-panel-settings__description">
              {{ t('settings.infoPanel.autoPreviewFileTypesDescription') }}
            </p>
          </div>
          <div class="info-panel-settings__file-types">
            <label
              v-for="fileType in INFO_PANEL_PREVIEW_FILE_TYPES"
              :key="fileType"
              class="info-panel-settings__file-type"
            >
              <Checkbox
                :model-value="autoPreviewFileTypes[fileType] !== false"
                @update:model-value="(checkboxValue: boolean | 'indeterminate') => setAutoPreviewFileType(fileType, checkboxValue === true)"
              />
              {{ t(`settings.infoPanel.previewFileTypes.${fileType}`) }}
            </label>
          </div>
        </div>

        <div class="info-panel-settings__row">
          <div class="info-panel-settings__copy">
            <span class="info-panel-settings__label">
              {{ t('settings.infoPanel.autoPreviewMaxSize') }}
            </span>
            <p class="info-panel-settings__description">
              {{ t('settings.infoPanel.autoPreviewMaxSizeDescription') }}
            </p>
          </div>
          <div class="info-panel-settings__controls">
            <Select
              v-model="selectedAutoPreviewMaxSize"
              by="value"
            >
              <SelectTrigger class="info-panel-settings__select-trigger">
                <SelectValue>
                  {{ selectedAutoPreviewMaxSize?.name }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="option in autoPreviewMaxSizeOptions"
                  :key="option.value"
                  :value="option"
                >
                  <SelectItemText>
                    {{ option.name }}
                  </SelectItemText>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="info-panel-settings__row">
          <div class="info-panel-settings__copy">
            <span class="info-panel-settings__label">
              {{ t('settings.infoPanel.showFullSizeImagePreview') }}
            </span>
            <p class="info-panel-settings__description">
              <i18n-t
                keypath="settings.infoPanel.showFullSizeImagePreviewDescription"
                tag="span"
              >
                <template #shortcut>
                  <kbd class="info-panel-settings__shortcut">{{ quickViewShortcutLabel }}</kbd>
                </template>
              </i18n-t>
            </p>
          </div>
          <div class="info-panel-settings__controls">
            <Transition name="info-panel-settings-warning-pill">
              <span
                v-if="showFullSizeImagePreview"
                class="info-panel-settings__warning-pill"
              >
                {{ t('settings.infoPanel.showFullSizeImagePreviewMemoryWarning') }}
              </span>
            </Transition>
            <Switch
              :model-value="showFullSizeImagePreview"
              @update:model-value="showFullSizeImagePreview = $event"
            />
          </div>
        </div>

        <div class="info-panel-settings__row">
          <div class="info-panel-settings__copy">
            <span class="info-panel-settings__label">
              {{ t('settings.infoPanel.muteVideoPreviewByDefault') }}
            </span>
            <p class="info-panel-settings__description">
              {{ t('settings.infoPanel.muteVideoPreviewByDefaultDescription') }}
            </p>
          </div>
          <Switch
            :model-value="muteVideoPreviewByDefault"
            @update:model-value="muteVideoPreviewByDefault = $event"
          />
        </div>

        <div class="info-panel-settings__row">
          <div class="info-panel-settings__copy">
            <span class="info-panel-settings__label">
              {{ t('settings.infoPanel.autoplayVideoPreview') }}
            </span>
            <p class="info-panel-settings__description">
              {{ t('settings.infoPanel.autoplayVideoPreviewDescription') }}
            </p>
          </div>
          <Switch
            :model-value="autoplayVideoPreview"
            @update:model-value="autoplayVideoPreview = $event"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.info-panel-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.info-panel-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem 2rem;
}

.info-panel-settings__copy {
  display: flex;
  min-width: min(100%, 16rem);
  flex: 1 1 12rem;
  flex-direction: column;
}

.info-panel-settings__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.info-panel-settings__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.4;
}

.info-panel-settings__file-types {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
}

.info-panel-settings__file-type {
  display: inline-flex;
  align-items: center;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 0.875rem;
  gap: 0.5rem;
}

.info-panel-settings__select-trigger {
  width: 140px;
}

.info-panel-settings__controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.75rem;
}

.info-panel-settings__warning-pill {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 9999px;
  background-color: hsl(var(--warning) / 15%);
  color: hsl(var(--warning));
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.2;
  white-space: nowrap;
}

.info-panel-settings-warning-pill-enter-active {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-out;
}

.info-panel-settings-warning-pill-leave-active {
  transition:
    transform 0.18s ease-in,
    opacity 0.15s ease-in;
}

.info-panel-settings-warning-pill-enter-from,
.info-panel-settings-warning-pill-leave-to {
  opacity: 0;
  transform: translateX(0.375rem) scale(0.9);
}

.info-panel-settings__shortcut {
  display: inline-flex;
  padding: 0.0625rem 0.3125rem;
  border-radius: calc(var(--radius-sm) - 1px);
  margin: 0 0.125rem;
  background-color: hsl(var(--muted) / 70%);
  color: hsl(var(--muted-foreground));
  font-family: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  vertical-align: baseline;
}
</style>
