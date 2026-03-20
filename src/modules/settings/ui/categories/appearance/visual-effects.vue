<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { AcceptableValue } from 'reka-ui';
import cloneDeep from 'lodash.clonedeep';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useI18n } from 'vue-i18n';
import { SparklesIcon, RefreshCcwIcon, ImageIcon, RotateCcwIcon } from 'lucide-vue-next';
import { useBackgroundMedia } from '@/modules/home/composables/use-background-media';
import type { ResolvedMediaSelection } from '@/modules/home/composables/use-background-media';
import { backgroundMedia, DEFAULT_INFUSION_BACKGROUND_FILE_NAME } from '@/data/background-media';
import type { InfusionPage, MixBlendMode } from '@/types/user-settings';
import { Button } from '@/components/ui/button';
import { BaseCombobox } from '@/components/base';
import BackgroundManagerDialog from '@/components/ui/background-manager/background-manager-dialog.vue';
import { useDropOverlayStore } from '@/stores/runtime/drop-overlay';

const dropOverlayStore = useDropOverlayStore();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();
const isBackgroundManagerOpen = ref(false);

watch(isBackgroundManagerOpen, (open) => {
  dropOverlayStore.setBackgroundManagerOpen(open);
}, { immediate: true });
const {
  ensureMediaCached,
  resolveOffsetMediaSelection,
} = useBackgroundMedia();

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

watch(effectivePageToCustomize, () => {
  dropOverlayStore.setMixBlendModePreview(null);
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

const mediaContrastValue = computed({
  get: () => [currentPageSettings.value.mediaContrast ?? 100],
  set: (value: number[]) => {
    const page = effectivePageToCustomize.value;
    userSettingsStore.userSettings.infusion.pages[page].mediaContrast = value[0];
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mediaContrast'), value[0]);
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

const mixBlendModeOptions = computed<{
  name: string;
  value: MixBlendMode;
}[]>(() => [
  {
    name: t('settings.visualEffects.mixBlendMode.normal'),
    value: 'normal',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.multiply'),
    value: 'multiply',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.screen'),
    value: 'screen',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.overlay'),
    value: 'overlay',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.darken'),
    value: 'darken',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.lighten'),
    value: 'lighten',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.color-dodge'),
    value: 'color-dodge',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.color-burn'),
    value: 'color-burn',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.hard-light'),
    value: 'hard-light',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.soft-light'),
    value: 'soft-light',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.difference'),
    value: 'difference',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.exclusion'),
    value: 'exclusion',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.hue'),
    value: 'hue',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.saturation'),
    value: 'saturation',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.color'),
    value: 'color',
  },
  {
    name: t('settings.visualEffects.mixBlendMode.luminosity'),
    value: 'luminosity',
  },
]);

const selectedMixBlendMode = computed({
  get: () => mixBlendModeOptions.value.find(
    option => option.value === currentPageSettings.value.mixBlendMode,
  ) ?? mixBlendModeOptions.value[0],
  set: (option) => {
    if (option) {
      const page = effectivePageToCustomize.value;
      userSettingsStore.userSettings.infusion.pages[page].mixBlendMode = option.value;
      userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mixBlendMode'), option.value);
    }
  },
});

function onMixBlendModeComboboxHighlight(
  payload:
    | {
      ref: HTMLElement;
      value: AcceptableValue;
    }
    | undefined,
) {
  const highlighted = payload?.value;

  if (
    highlighted !== null
    && highlighted !== undefined
    && typeof highlighted === 'object'
    && 'value' in highlighted
  ) {
    dropOverlayStore.setMixBlendModePreview((highlighted as { value: MixBlendMode }).value);
  }
}

function onMixBlendModeComboboxOpen(open: boolean) {
  if (!open) {
    nextTick(() => {
      dropOverlayStore.setMixBlendModePreview(null);
    });
  }
}

async function onEnabledChange(checked: boolean) {
  userSettingsStore.userSettings.infusion.enabled = checked;
  await userSettingsStore.setUserSettingsStorage('infusion.enabled', checked);
}

async function onSameSettingsForAllPagesChange(checked: boolean) {
  userSettingsStore.userSettings.infusion.sameSettingsForAllPages = checked;
  await userSettingsStore.setUserSettingsStorage('infusion.sameSettingsForAllPages', checked);
}

async function onPauseInfusionVideoWhenIdleChange(checked: boolean) {
  userSettingsStore.userSettings.infusion.pauseVideoWhenIdle = checked;
  await userSettingsStore.setUserSettingsStorage('infusion.pauseVideoWhenIdle', checked);
}

async function onPauseBannerVideoWhenIdleChange(checked: boolean) {
  userSettingsStore.userSettings.homeBannerPauseVideoWhenIdle = checked;
  await userSettingsStore.setUserSettingsStorage('homeBannerPauseVideoWhenIdle', checked);
}

const infusionMediaSelectionOptions = {
  defaultMediaId: DEFAULT_INFUSION_BACKGROUND_FILE_NAME,
  resolveMediaIdFromIndex: (index: number) => {
    return backgroundMedia[index]?.fileName ?? null;
  },
};

async function applyInfusionBackgroundSelection(selection: ResolvedMediaSelection) {
  const isReady = await ensureMediaCached(selection.item);

  if (!isReady) {
    return;
  }

  const page = effectivePageToCustomize.value;
  const background = {
    type: selection.type,
    path: selection.path,
    index: selection.index,
    mediaId: selection.mediaId,
  };

  userSettingsStore.userSettings.infusion.pages[page].background = background;
  userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'background'), background);
}

async function selectNextBackground() {
  const selection = resolveOffsetMediaSelection(
    currentPageSettings.value.background,
    1,
    infusionMediaSelectionOptions,
  );

  if (!selection) {
    return;
  }

  await applyInfusionBackgroundSelection(selection);
}

const infusionPagesToPersist: InfusionPage[] = ['', 'home', 'navigator', 'dashboard', 'settings', 'extensions'];

async function resetVisualEffectsSection(): Promise<void> {
  const defaultsSnapshot = userSettingsStore.userSettingsDefault;

  if (!defaultsSnapshot) {
    return;
  }

  const defaultInfusion = cloneDeep(defaultsSnapshot.infusion);

  userSettingsStore.userSettings.infusion = defaultInfusion;
  userSettingsStore.userSettings.homeBannerPauseVideoWhenIdle = defaultsSnapshot.homeBannerPauseVideoWhenIdle;

  await userSettingsStore.setUserSettingsStorage('infusion.enabled', defaultInfusion.enabled);
  await userSettingsStore.setUserSettingsStorage('infusion.sameSettingsForAllPages', defaultInfusion.sameSettingsForAllPages);
  await userSettingsStore.setUserSettingsStorage('infusion.selectedPageToCustomize', defaultInfusion.selectedPageToCustomize);
  await userSettingsStore.setUserSettingsStorage('infusion.pauseVideoWhenIdle', defaultInfusion.pauseVideoWhenIdle);
  await userSettingsStore.setUserSettingsStorage('homeBannerPauseVideoWhenIdle', defaultsSnapshot.homeBannerPauseVideoWhenIdle);

  for (const page of infusionPagesToPersist) {
    const pageSettings = defaultInfusion.pages[page];

    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'blur'), pageSettings.blur);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mediaContrast'), pageSettings.mediaContrast);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'opacity'), pageSettings.opacity);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'noise'), pageSettings.noise);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'noiseScale'), pageSettings.noiseScale);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mixBlendMode'), pageSettings.mixBlendMode);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'background'), pageSettings.background);
  }
}
</script>

<template>
  <SettingsItem
    :title="t('settings.visualEffects.title')"
    :icon="SparklesIcon"
  >
    <div class="visual-effects-settings__header-controls">
      <Tooltip v-if="infusionSettings.enabled">
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            :disabled="!userSettingsStore.userSettingsDefault"
            @click="resetVisualEffectsSection"
          >
            <RotateCcwIcon class="visual-effects-settings__header-action-icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.visualEffects.resetToDefaults') }}
        </TooltipContent>
      </Tooltip>
      <Switch
        :model-value="infusionSettings.enabled"
        @update:model-value="onEnabledChange"
      />
    </div>

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

        <div class="visual-effects-settings__row visual-effects-settings__row--toggle">
          <span class="visual-effects-settings__label">
            {{ t('settings.visualEffects.pauseBackgroundVideoWhenIdle') }}
          </span>
          <Switch
            :model-value="infusionSettings.pauseVideoWhenIdle"
            @update:model-value="onPauseInfusionVideoWhenIdleChange"
          />
        </div>

        <div class="visual-effects-settings__row visual-effects-settings__row--toggle">
          <span class="visual-effects-settings__label">
            {{ t('settings.visualEffects.pauseBannerVideoWhenIdle') }}
          </span>
          <Switch
            :model-value="userSettingsStore.userSettings.homeBannerPauseVideoWhenIdle"
            @update:model-value="onPauseBannerVideoWhenIdleChange"
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
                {{ t('settings.visualEffects.overlayMediaContrast', { n: mediaContrastValue[0] }) }}
              </span>
              <Slider
                v-model="mediaContrastValue"
                :min="50"
                :max="200"
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

            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayBackground') }}
              </span>
              <div class="visual-effects-settings__background-controls">
                <Button
                  variant="outline"
                  size="sm"
                  class="visual-effects-settings__background-manager-button"
                  @click="isBackgroundManagerOpen = true"
                >
                  <ImageIcon :size="18" />
                  <span>{{ t('home.backgroundManager') }}</span>
                </Button>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="outline"
                      size="sm"
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

            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.overlayMixBlendMode') }}
              </span>

              <BaseCombobox
                v-model="selectedMixBlendMode"
                :options="mixBlendModeOptions"
                by="value"
                :search-placeholder="t('search')"
                @highlight="onMixBlendModeComboboxHighlight"
                @update:open="onMixBlendModeComboboxOpen"
              />
            </div>
          </div>
        </div>
      </div>

      <BackgroundManagerDialog
        v-if="isBackgroundManagerOpen"
        v-model:open="isBackgroundManagerOpen"
        :selection-state="currentPageSettings.background"
        :default-media-id="DEFAULT_INFUSION_BACKGROUND_FILE_NAME"
        :on-apply-selection="applyInfusionBackgroundSelection"
      />
    </template>
  </SettingsItem>
</template>

<style scoped>
.visual-effects-settings__header-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.visual-effects-settings__header-action-icon {
  width: 1rem;
  height: 1rem;
}

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

.visual-effects-settings__background-manager-button {
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
