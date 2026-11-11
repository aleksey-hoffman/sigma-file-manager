<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClipboardIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';

const userSettingsStore = useUserSettingsStore();
const shortcutsStore = useShortcutsStore();
const { t } = useI18n();

const pasteShortcutLabel = computed(() => shortcutsStore.getShortcutLabel('paste'));

const showToolbarForExternalImages = computed({
  get: () => userSettingsStore.userSettings.clipboard.showToolbarForExternalImages,
  set: (value: boolean) => {
    userSettingsStore.set('clipboard.showToolbarForExternalImages', value);
  },
});

const showToolbarForExternalPaths = computed({
  get: () => userSettingsStore.userSettings.clipboard.showToolbarForExternalPaths,
  set: (value: boolean) => {
    userSettingsStore.set('clipboard.showToolbarForExternalPaths', value);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.clipboard.title')"
    :icon="ClipboardIcon"
  >
    <template #nested>
      <div class="clipboard-settings">
        <div class="clipboard-settings__row">
          <div class="clipboard-settings__copy">
            <span class="clipboard-settings__label">
              {{ t('settings.clipboard.showToolbarForExternalImages') }}
            </span>
            <p class="clipboard-settings__description">
              <i18n-t
                keypath="settings.clipboard.pasteStillWorksWhenHidden"
                tag="span"
              >
                <template #shortcut>
                  <kbd class="clipboard-settings__shortcut">{{ pasteShortcutLabel }}</kbd>
                </template>
              </i18n-t>
            </p>
          </div>
          <Switch
            :model-value="showToolbarForExternalImages"
            @update:model-value="showToolbarForExternalImages = $event"
          />
        </div>
        <div class="clipboard-settings__row">
          <div class="clipboard-settings__copy">
            <span class="clipboard-settings__label">
              {{ t('settings.clipboard.showToolbarForExternalPaths') }}
            </span>
            <p class="clipboard-settings__description">
              <i18n-t
                keypath="settings.clipboard.pasteStillWorksWhenHidden"
                tag="span"
              >
                <template #shortcut>
                  <kbd class="clipboard-settings__shortcut">{{ pasteShortcutLabel }}</kbd>
                </template>
              </i18n-t>
            </p>
          </div>
          <Switch
            :model-value="showToolbarForExternalPaths"
            @update:model-value="showToolbarForExternalPaths = $event"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.clipboard-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.clipboard-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem 2rem;
}

.clipboard-settings__copy {
  display: flex;
  min-width: min(100%, 16rem);
  flex: 1 1 12rem;
  flex-direction: column;
}

.clipboard-settings__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.clipboard-settings__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.4;
}

.clipboard-settings__shortcut {
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
