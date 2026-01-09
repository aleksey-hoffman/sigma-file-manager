<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { SparklesIcon, RefreshCcwIcon } from 'lucide-vue-next';
import { homeBannerMedia } from '@/data/home-banner-media';
import type { InfusionPage } from '@/types/user-settings';
import { Button } from '@/components/ui/button';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const infusionSettings = computed(() => userSettingsStore.userSettings.infusion);

type PageOption = {
  name: string;
  value: InfusionPage;
};

const pageSpecificOptions: PageOption[] = [
  {
    name: t('pages.home'),
    value: 'home',
  },
  {
    name: t('pages.navigator'),
    value: 'navigator',
  },
  {
    name: t('pages.dashboard'),
    value: 'dashboard',
  },
  {
    name: t('pages.settings'),
    value: 'settings',
  },
  {
    name: t('pages.extensions'),
    value: 'extensions',
  },
];

const selectedPageValue = computed({
  get: () => {
    const selected = infusionSettings.value.selectedPageToCustomize;

    return selected === '' ? 'home' : selected;
  },
  set: (value: string) => {
    userSettingsStore.userSettings.infusion.selectedPageToCustomize = value as InfusionPage;
    userSettingsStore.setUserSettingsStorage('infusion.selectedPageToCustomize', value);
  },
});

const selectedPageName = computed(() => {
  const option = pageSpecificOptions.find(opt => opt.value === selectedPageValue.value);

  return option?.name || '';
});

const effectivePageToCustomize = computed(() => {
  if (infusionSettings.value.sameSettingsForAllPages) {
    return '' as InfusionPage;
  }

  const selected = infusionSettings.value.selectedPageToCustomize;

  return selected === '' ? 'home' : selected;
});

const currentPageSettings = computed(() => {
  return infusionSettings.value.pages[effectivePageToCustomize.value];
});

function getStorageKeyForPage(page: InfusionPage, property: string): string {
  const pageKey = page === '' ? 'global' : page;

  return `infusion.pages.${pageKey}.${property}`;
}

const blurValue = computed({
  get: () => [currentPageSettings.value.blur],
  set: (value: number[]) => {
    const page = effectivePageToCustomize.value;
    userSettingsStore.userSettings.infusion.pages[page].blur = value[0];
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'blur'), value[0]);
  },
});

const opacityValue = computed({
  get: () => [currentPageSettings.value.opacity],
  set: (value: number[]) => {
    const page = effectivePageToCustomize.value;
    userSettingsStore.userSettings.infusion.pages[page].opacity = value[0];
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'opacity'), value[0]);
  },
});

const noiseValue = computed({
  get: () => [currentPageSettings.value.noise],
  set: (value: number[]) => {
    const page = effectivePageToCustomize.value;
    userSettingsStore.userSettings.infusion.pages[page].noise = value[0];
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'noise'), value[0]);
  },
});

const noiseScaleValue = computed({
  get: () => [currentPageSettings.value.noiseScale],
  set: (value: number[]) => {
    const page = effectivePageToCustomize.value;
    userSettingsStore.userSettings.infusion.pages[page].noiseScale = value[0];
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'noiseScale'), value[0]);
  },
});

async function onEnabledChange(checked: boolean) {
  userSettingsStore.userSettings.infusion.enabled = checked;
  await userSettingsStore.setUserSettingsStorage('infusion.enabled', checked);
}

async function onSameSettingsForAllPagesChange(checked: boolean) {
  userSettingsStore.userSettings.infusion.sameSettingsForAllPages = checked;
  await userSettingsStore.setUserSettingsStorage('infusion.sameSettingsForAllPages', checked);
}

const backgroundMediaOptions = computed(() => {
  return homeBannerMedia.map((media, index) => ({
    name: media.name,
    value: index,
    media,
  }));
});

const selectedBackground = computed({
  get: () => {
    const bgIndex = currentPageSettings.value.background.index;
    return backgroundMediaOptions.value.find(option => option.value === bgIndex);
  },
  set: (option) => {
    if (option) {
      const page = effectivePageToCustomize.value;
      const media = option.media;
      const background = {
        type: media.type,
        path: media.fileName,
        index: option.value,
      };
      userSettingsStore.userSettings.infusion.pages[page].background = background;
      userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'background'), background);
    }
  },
});

function selectNextBackground() {
  const currentIndex = currentPageSettings.value.background.index;
  const nextIndex = (currentIndex + 1) % homeBannerMedia.length;
  const media = homeBannerMedia[nextIndex];
  const page = effectivePageToCustomize.value;
  const background = {
    type: media.type,
    path: media.fileName,
    index: nextIndex,
  };

  userSettingsStore.userSettings.infusion.pages[page].background = background;
  userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'background'), background);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.visualEffects.title')"
    :icon="SparklesIcon"
  >
    <Switch
      :model-value="infusionSettings.enabled"
      @update:model-value="onEnabledChange"
    />

    <template
      v-if="infusionSettings.enabled"
      #nested
    >
      <div class="visual-effects-settings">
        <div class="visual-effects-settings__row visual-effects-settings__row--toggle">
          <span class="visual-effects-settings__label">
            {{ t('settings.visualEffects.useTheSameSettingsForAllPages') }}
          </span>
          <Switch
            :model-value="infusionSettings.sameSettingsForAllPages"
            @update:model-value="onSameSettingsForAllPagesChange"
          />
        </div>

        <Tabs
          v-if="!infusionSettings.sameSettingsForAllPages"
          v-model="selectedPageValue"
          class="visual-effects-settings__tabs"
        >
          <TabsList class="visual-effects-settings__tabs-list">
            <TabsTrigger
              v-for="option in pageSpecificOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.name }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          class="visual-effects-settings__panel"
          :class="{ 'visual-effects-settings__panel--page-specific': !infusionSettings.sameSettingsForAllPages }"
        >
          <div
            v-if="!infusionSettings.sameSettingsForAllPages"
            class="visual-effects-settings__panel-header"
          >
            <span class="visual-effects-settings__panel-badge">
              {{ selectedPageName }}
            </span>
          </div>

          <div class="visual-effects-settings__panel-content">
            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayBlur', { n: blurValue[0] }) }}
              </span>
              <Slider
                v-model="blurValue"
                :min="0"
                :max="128"
                :step="1"
                class="visual-effects-settings__slider"
              />
            </div>

            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayOpacity', { n: opacityValue[0] }) }}
              </span>
              <Slider
                v-model="opacityValue"
                :min="0"
                :max="50"
                :step="1"
                class="visual-effects-settings__slider"
              />
            </div>

            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayNoise', { n: noiseValue[0] }) }}
              </span>
              <Slider
                v-model="noiseValue"
                :min="0"
                :max="20"
                :step="1"
                class="visual-effects-settings__slider"
              />
            </div>

            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayNoiseScale', { n: noiseScaleValue[0] }) }}
              </span>
              <Slider
                v-model="noiseScaleValue"
                :min="0"
                :max="1"
                :step="0.1"
                class="visual-effects-settings__slider"
              />
            </div>

            <div class="visual-effects-settings__row visual-effects-settings__row--background">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayBackground') }}
              </span>
              <div class="visual-effects-settings__background-controls">
                <Select
                  v-model="selectedBackground"
                  by="value"
                >
                  <SelectTrigger class="visual-effects-settings__select-trigger">
                    <SelectValue>
                      {{ selectedBackground?.name }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="option in backgroundMediaOptions"
                      :key="option.value"
                      :value="option"
                    >
                      <SelectItemText>
                        {{ option.name }}
                      </SelectItemText>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="outline"
                      @click="selectNextBackground"
                    >
                      <RefreshCcwIcon :size="18" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ t('settings.visualEffects.selectNextBackground') }}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.visual-effects-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.visual-effects-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.visual-effects-settings__row--toggle {
  gap: 2rem;
}

.visual-effects-settings__row--background {
  flex-direction: column;
  align-items: stretch;
}

.visual-effects-settings__label {
  flex-shrink: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.visual-effects-settings__slider {
  width: 200px;
}

.visual-effects-settings__select-trigger {
  min-width: 200px;
}

.visual-effects-settings__background-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.visual-effects-settings__tabs {
  width: 100%;
}

.visual-effects-settings__tabs-list {
  width: 100%;
}

.visual-effects-settings__panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.visual-effects-settings__panel--page-specific {
  padding: 1rem;
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: var(--radius);
  background-color: hsl(var(--primary) / 5%);
}

.visual-effects-settings__panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.visual-effects-settings__panel-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  background-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.visual-effects-settings__panel-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
