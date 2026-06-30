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
    <template #description>
      <i18n-t
        keypath="settings.clipboard.pasteStillWorksWhenHidden"
        tag="span"
      >
        <template #shortcut>
          <kbd class="clipboard-settings__shortcut">{{ pasteShortcutLabel }}</kbd>
        </template>
      </i18n-t>
    </template>
    <template #nested>
      <div class="clipboard-settings">
        <div class="clipboard-settings__row">
          <span class="clipboard-settings__label">
            {{ t('settings.clipboard.showToolbarForExternalImages') }}
          </span>
          <Switch
            :model-value="showToolbarForExternalImages"
            @update:model-value="showToolbarForExternalImages = $event"
          />
        </div>
        <div class="clipboard-settings__row">
          <span class="clipboard-settings__label">
            {{ t('settings.clipboard.showToolbarForExternalPaths') }}
          </span>
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
  align-items: center;
  justify-content: space-between;
  gap: 1rem 2rem;
}

.clipboard-settings__label {
  min-width: min(100%, 16rem);
  flex: 1 1 12rem;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.clipboard-settings__shortcut {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border: 1px solid hsl(var(--border));
  border-radius: 0.25rem;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-family: inherit;
  font-size: 0.8125rem;
  line-height: 1.2;
}
</style>
