<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { TypeIcon, RotateCcwIcon, RefreshCwIcon } from 'lucide-vue-next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { getSystemFonts } from 'tauri-plugin-system-fonts-api';

const DEFAULT_FONT = 'system-ui';

interface FontOption {
  name: string;
  type: string;
}

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const fonts = ref<FontOption[]>([]);
const isFetchingFonts = ref(false);

const defaultFont = computed(() => {
  const fromStore = userSettingsStore.userSettingsDefault?.text?.font;
  return typeof fromStore === 'string' ? fromStore : DEFAULT_FONT;
});

const fontOptions = computed(() => {
  const current = userSettingsStore.userSettings.text.font;
  const hasCurrent = fonts.value.some(font => font.name === current);
  const defaultEntry = {
    name: defaultFont.value,
    type: '',
  };
  const currentEntry = {
    name: current,
    type: '',
  };
  const base = hasCurrent
    ? fonts.value
    : [defaultEntry, currentEntry, ...fonts.value];
  const unique = Array.from(
    new Map(base.map(font => [font.name, font])).values(),
  );
  return unique;
});

const selectedFont = computed({
  get: () => {
    const name = userSettingsStore.userSettings.text.font;
    return (
      fontOptions.value.find(font => font.name === name) ?? {
        name,
        type: '',
      }
    );
  },
  set: (font: FontOption) => {
    userSettingsStore.set('text.font', font.name);
  },
});

function isDefaultFont(fontName: string): boolean {
  return fontName === defaultFont.value;
}

async function fetchSystemFonts(): Promise<void> {
  isFetchingFonts.value = true;

  try {
    const list = await getSystemFonts();
    const mapped: FontOption[] = list.map(font => ({
      name: font.name,
      type: font.style ?? '',
    }));
    fonts.value = [{
      name: defaultFont.value,
      type: '',
    }, ...mapped];
  }
  catch {
    fonts.value = [{
      name: defaultFont.value,
      type: '',
    }];
  }
  finally {
    isFetchingFonts.value = false;
  }
}

function resetFont(): void {
  userSettingsStore.set('text.font', defaultFont.value);
}

onMounted(() => {
  fetchSystemFonts();
});
</script>

<template>
  <SettingsItem
    :title="t('settings.fonts.fonts')"
    :description="t('settings.fonts.selectedFont')"
    :icon="TypeIcon"
  >
    <div class="fonts-row">
      <div class="fonts-select-wrap">
        <Select
          v-model="selectedFont"
          by="name"
          :disabled="isFetchingFonts"
        >
          <SelectTrigger class="fonts-select-trigger">
            <SelectValue>
              <template v-if="isFetchingFonts">
                <span class="fonts-loading">
                  {{ t('loadingDots') }}
                </span>
              </template>
              <span
                v-else
                class="fonts-selected-name__wrapper"
                :style="{ fontFamily: selectedFont?.name }"
              >
                <span
                  class="fonts-selected-name"
                  :style="{ fontFamily: selectedFont?.name }"
                >
                  {{ selectedFont?.name ?? defaultFont }}
                </span>
                <span class="fonts-selected-name--default">
                  <template v-if="isDefaultFont(selectedFont?.name)">
                    ({{ t('settings.fonts.defaultFont') }})
                  </template>
                </span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent class="fonts-select-content">
            <SelectItem
              v-for="font in fontOptions"
              :key="font.name"
              :value="font"
            >
              <SelectItemText>
                <span
                  class="font-option-name"
                  :style="{ fontFamily: font.name }"
                >
                  {{ font.name }}
                </span>
                <span
                  class="font-option-meta"
                  :style="{ fontFamily: font.name }"
                >
                  {{ font.type }}
                  <template v-if="isDefaultFont(font.name)">
                    ({{ t('settings.fonts.defaultFont') }})
                  </template>
                </span>
              </SelectItemText>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            :disabled="isFetchingFonts"
            @click="fetchSystemFonts()"
          >
            <RefreshCwIcon class="fonts-action-icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.fonts.reFetchSystemFonts') }}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            @click="resetFont()"
          >
            <RotateCcwIcon class="fonts-action-icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.fonts.resetFontToDefault') }}
        </TooltipContent>
      </Tooltip>
    </div>
  </SettingsItem>
</template>

<style scoped>
.fonts-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.fonts-select-wrap {
  min-width: 200px;
  max-width: 400px;
}

.fonts-select-trigger {
  min-height: 2.5rem;
}

.fonts-select-content {
  max-height: 320px;
}

.fonts-loading {
  opacity: 0.8;
}

.fonts-selected-name {
  font-size: 0.875rem;
  text-transform: capitalize;
}

.fonts-selected-name--default {
  color: hsl(var(--muted-foreground) / 70%);
}

.fonts-action-icon {
  width: 1rem;
  height: 1rem;
}

.font-option-name {
  display: block;
  font-size: 0.875rem;
  text-transform: capitalize;
}

.font-option-meta {
  display: block;
  font-size: 0.75rem;
  opacity: 0.8;
}
</style>
