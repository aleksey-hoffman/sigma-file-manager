<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PanelRightIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useInfoPanelBooleanSetting } from '@/modules/settings/composables/use-info-panel-boolean-setting';
import { useInfoPanelLayout } from '@/modules/navigator/components/info-panel/composables/use-info-panel-layout';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';

const shortcutsStore = useShortcutsStore();
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
