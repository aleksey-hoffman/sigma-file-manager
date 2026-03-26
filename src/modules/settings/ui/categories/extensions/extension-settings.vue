<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsItem } from '@/modules/settings';
import { PuzzleIcon } from '@lucide/vue';
import type { InstalledExtension, ExtensionConfigurationProperty } from '@/types/extension';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { notifySettingsChange } from '@/modules/extensions/api';
import { useI18n } from 'vue-i18n';

type Props = {
  extension: InstalledExtension;
};

const props = defineProps<Props>();

const extensionsStorageStore = useExtensionsStorageStore();
const { locale } = useI18n();

const configuration = computed(() => {
  return props.extension.manifest.contributes?.configuration;
});

const extensionMessages = ref<Record<string, string> | null>(null);

const configurationTitle = computed(() => {
  const translated = extensionMessages.value?.['settings.title'];
  if (translated) return translated;
  return configuration.value?.title || props.extension.manifest.name;
});

const configurationDescription = computed(() => {
  const translated = extensionMessages.value?.['settings.description'];
  if (translated) return translated;
  return props.extension.registryEntry?.description ?? '';
});

const settingsValues = ref<Record<string, unknown>>({});

onMounted(async () => {
  await loadSettings();
  await loadExtensionMessages();
});

watch(() => props.extension.id, async () => {
  await loadSettings();
  await loadExtensionMessages();
});

watch(locale, () => {
  void loadExtensionMessages();
});

async function loadExtensionMessages(): Promise<void> {
  try {
    const filePath = `locales/${locale.value}.json`;
    const exists = await invoke<boolean>('extension_path_exists', {
      extensionId: props.extension.id,
      filePath,
    });

    if (!exists) {
      const enPath = 'locales/en.json';
      const enExists = await invoke<boolean>('extension_path_exists', {
        extensionId: props.extension.id,
        filePath: enPath,
      });

      if (!enExists) {
        extensionMessages.value = null;

        return;
      }

      const bytes = await invoke<number[]>('read_extension_file', {
        extensionId: props.extension.id,
        filePath: enPath,
      });
      const content = new TextDecoder().decode(new Uint8Array(bytes));
      extensionMessages.value = JSON.parse(content) as Record<string, string>;

      return;
    }

    const bytes = await invoke<number[]>('read_extension_file', {
      extensionId: props.extension.id,
      filePath,
    });

    const content = new TextDecoder().decode(new Uint8Array(bytes));
    extensionMessages.value = JSON.parse(content) as Record<string, string>;
  }
  catch {
    extensionMessages.value = null;
  }
}

async function loadSettings(): Promise<void> {
  const settings = await extensionsStorageStore.getExtensionSettings(props.extension.id);
  const config = configuration.value;

  if (!config?.properties) return;

  const values: Record<string, unknown> = {};

  for (const [key, prop] of Object.entries(config.properties)) {
    values[key] = settings?.configurationValues?.[key] ?? prop.default;
  }

  settingsValues.value = values;
}

async function updateSetting(key: string, value: unknown): Promise<void> {
  const oldValue = settingsValues.value[key];
  settingsValues.value[key] = value;

  const settings = await extensionsStorageStore.getExtensionSettings(props.extension.id);
  const configurationValues = {
    ...settings?.configurationValues,
    [key]: value,
  };

  await extensionsStorageStore.updateExtensionSettings(props.extension.id, { configurationValues });
  await notifySettingsChange(props.extension.id, key, value, oldValue);
}

function getPropertyLabel(key: string): string {
  const translated = extensionMessages.value?.[`settings.${key}`];
  if (translated) return translated;
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getPropertyDescription(key: string, fallback: string | undefined): string {
  const translated = extensionMessages.value?.[`settings.${key}Description`];
  if (translated) return translated;
  return fallback ?? '';
}

function isEnumProperty(prop: ExtensionConfigurationProperty): boolean {
  return Array.isArray(prop.enum) && prop.enum.length > 0;
}
</script>

<template>
  <SettingsItem
    v-if="configuration?.properties"
    :title="configurationTitle"
    :description="configurationDescription"
    :icon="PuzzleIcon"
  >
    <template #nested>
      <div class="extension-settings">
        <div
          v-for="(prop, key) in configuration.properties"
          :key="key"
          class="extension-settings__item"
        >
          <div class="extension-settings__item-info">
            <Label
              :for="`${extension.id}-${key}`"
              class="extension-settings__label"
            >
              {{ getPropertyLabel(String(key)) }}
            </Label>
            <p
              v-if="getPropertyDescription(String(key), prop.description)"
              class="extension-settings__description"
            >
              {{ getPropertyDescription(String(key), prop.description) }}
            </p>
          </div>

          <div class="extension-settings__control">
            <Switch
              v-if="prop.type === 'boolean'"
              :id="`${extension.id}-${key}`"
              :model-value="Boolean(settingsValues[key])"
              @update:model-value="updateSetting(String(key), $event)"
            />

            <Select
              v-else-if="isEnumProperty(prop)"
              :model-value="String(settingsValues[key] ?? '')"
              @update:model-value="updateSetting(String(key), $event)"
            >
              <SelectTrigger class="extension-settings__select">
                <SelectValue>
                  {{ settingsValues[key] }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="(enumValue, enumIndex) in prop.enum"
                  :key="enumIndex"
                  :value="enumValue"
                >
                  <SelectItemText>
                    {{ enumValue }}
                    <span
                      v-if="prop.enumDescriptions?.[enumIndex]"
                      class="extension-settings__enum-description"
                    >
                      - {{ prop.enumDescriptions[enumIndex] }}
                    </span>
                  </SelectItemText>
                </SelectItem>
              </SelectContent>
            </Select>

            <Input
              v-else-if="prop.type === 'number'"
              :id="`${extension.id}-${key}`"
              type="number"
              :model-value="Number(settingsValues[key])"
              :min="prop.minimum"
              :max="prop.maximum"
              class="extension-settings__input extension-settings__input--number"
              @update:model-value="updateSetting(String(key), Number($event))"
            />

            <Input
              v-else
              :id="`${extension.id}-${key}`"
              type="text"
              :model-value="String(settingsValues[key] ?? '')"
              :minlength="prop.minLength"
              :maxlength="prop.maxLength"
              class="extension-settings__input"
              @update:model-value="updateSetting(String(key), $event)"
            />
          </div>
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.extension-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.extension-settings__item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.extension-settings__item-info {
  display: flex;
  min-width: 200px;
  flex: 1;
  flex-direction: column;
  gap: 0.25rem;
}

.extension-settings__label {
  font-weight: 500;
}

.extension-settings__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.extension-settings__control {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.extension-settings__input {
  width: 200px;
}

.extension-settings__input--number {
  width: 100px;
}

.extension-settings__select {
  min-width: 150px;
}

.extension-settings__enum-description {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}
</style>
