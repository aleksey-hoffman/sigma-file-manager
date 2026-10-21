<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import cloneDeep from 'lodash.clonedeep';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useI18n } from 'vue-i18n';
import {
  SparklesIcon, RefreshCcwIcon, ImageIcon, RotateCcwIcon, CheckIcon,
} from '@lucide/vue';
import { useBackgroundMedia } from '@/modules/home/composables/use-background-media';
import type { ResolvedMediaSelection } from '@/modules/home/composables/use-background-media';
import { backgroundMedia, DEFAULT_INFUSION_BACKGROUND_FILE_NAME } from '@/data/background-media';
import type { InfusionPage, MixBlendMode } from '@/types/user-settings';
import { Button } from '@/components/ui/button';
import { BaseCombobox } from '@/components/base';
import {
  getComboboxHighlightedOptionValue,
  type ComboboxHighlightPayload,
} from '@/components/base/combobox-utils';
import {
  getSupportedInfusionBlendModeGroups,
  INFUSION_BLEND_TINTS,
  isInfusionBlendMode,
  isInfusionBlendTarget,
  normalizeInfusionBlendMode,
  normalizeInfusionBlendTarget,
  normalizeInfusionBlendTint,
  parseInfusionBlendTint,
} from '@/utils/infusion-blend';
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

const mediaBrightnessValue = computed({
  get: () => [currentPageSettings.value.mediaBrightness ?? 100],
  set: (value: number[]) => {
    const page = effectivePageToCustomize.value;
    userSettingsStore.userSettings.infusion.pages[page].mediaBrightness = value[0];
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mediaBrightness'), value[0]);
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

type MixBlendModeOption = {
  name: string;
  value: MixBlendMode;
};

const supportedMixBlendModeGroups = getSupportedInfusionBlendModeGroups();

const mixBlendModeOptionGroups = computed<{ options: MixBlendModeOption[] }[]>(() => {
  return supportedMixBlendModeGroups.map(group => ({
    options: group.map(mode => ({
      name: t(`settings.visualEffects.mixBlendMode.${mode}`),
      value: mode,
    })),
  }));
});

const mixBlendModeOptions = computed<MixBlendModeOption[]>(() => {
  return mixBlendModeOptionGroups.value.flatMap(group => group.options);
});

const currentMixBlendMode = computed(() => normalizeInfusionBlendMode(currentPageSettings.value.mixBlendMode));
const currentBlendTarget = computed(() => normalizeInfusionBlendTarget(currentPageSettings.value.blendTarget));
const currentBlendTint = computed(() => normalizeInfusionBlendTint(currentPageSettings.value.blendTint));
const isCustomBlendTint = computed(() => !INFUSION_BLEND_TINTS.includes(currentBlendTint.value));

const selectedMixBlendMode = computed({
  get: () => mixBlendModeOptions.value.find(
    option => option.value === currentMixBlendMode.value,
  ) ?? mixBlendModeOptions.value[0],
  set: (option) => {
    if (option && isInfusionBlendMode(option.value)) {
      const page = effectivePageToCustomize.value;
      userSettingsStore.userSettings.infusion.pages[page].mixBlendMode = option.value;
      userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mixBlendMode'), option.value);
    }
  },
});

function onMixBlendModeComboboxHighlight(payload: ComboboxHighlightPayload) {
  const highlightedMixBlendMode = getComboboxHighlightedOptionValue<MixBlendMode>(payload);

  if (highlightedMixBlendMode && isInfusionBlendMode(highlightedMixBlendMode)) {
    dropOverlayStore.setMixBlendModePreview(highlightedMixBlendMode);
  }
}

function onMixBlendModeComboboxOpen(open: boolean) {
  if (!open) {
    nextTick(() => {
      dropOverlayStore.setMixBlendModePreview(null);
    });
  }
}

function onBlendTargetChange(value: unknown) {
  if (!isInfusionBlendTarget(value)) {
    return;
  }

  const page = effectivePageToCustomize.value;
  userSettingsStore.userSettings.infusion.pages[page].blendTarget = value;
  userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'blendTarget'), value);
}

function applyBlendTint(value: unknown, persist: boolean) {
  const tint = parseInfusionBlendTint(value);

  if (!tint) {
    return;
  }

  const page = effectivePageToCustomize.value;
  userSettingsStore.userSettings.infusion.pages[page].blendTint = tint;

  if (persist) {
    userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'blendTint'), tint);
  }
}

function onCustomBlendTintInput(event: Event) {
  applyBlendTint((event.target as HTMLInputElement).value, false);
}

function onCustomBlendTintChange(event: Event) {
  applyBlendTint((event.target as HTMLInputElement).value, true);
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
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mediaBrightness'), pageSettings.mediaBrightness);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'opacity'), pageSettings.opacity);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'noise'), pageSettings.noise);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'noiseScale'), pageSettings.noiseScale);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'mixBlendMode'), pageSettings.mixBlendMode);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'blendTarget'), pageSettings.blendTarget);
    await userSettingsStore.setUserSettingsStorage(getStorageKeyForPage(page, 'blendTint'), pageSettings.blendTint);
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
                {{ t('settings.visualEffects.overlayMediaBrightness', { n: mediaBrightnessValue[0] }) }}
              </span>
              <Slider
                v-model="mediaBrightnessValue"
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
                :option-groups="mixBlendModeOptionGroups"
                by="value"
                :search-placeholder="t('search')"
                :empty-text="t('noData')"
                @highlight="onMixBlendModeComboboxHighlight"
                @update:open="onMixBlendModeComboboxOpen"
              />
            </div>

            <!-- FORK-MODIFICATION 2026-10-21：颜色选择器不再藏在
                 「混合模式 ≠ 正常」的条件里。

                 上游把「混合对象」和「混合颜色」整块都放在
                 `v-if="currentMixBlendMode !== 'normal'"` 下面。默认的混合模式
                 就是「正常」，于是这一块默认**完全不渲染** —— 真机上表现为
                 「设置里找不到自定义颜色的地方」，功能明明在却没人看得见。

                 现在「混合对象」始终可见，选了「与填充色混合」就露出色板与
                 自定义颜色。用户一眼能找到，不用先猜「要先改混合模式」。 -->
            <div class="visual-effects-settings__row">
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.blendTarget') }}
              </span>
              <Tabs
                :model-value="currentBlendTarget"
                class="visual-effects-settings__blend-target"
                @update:model-value="onBlendTargetChange"
              >
                <TabsList class="visual-effects-settings__blend-target-list">
                  <TabsTrigger value="ui">
                    {{ t('settings.visualEffects.blendTargetUi') }}
                  </TabsTrigger>
                  <TabsTrigger value="fill">
                    {{ t('settings.visualEffects.blendTargetFill') }}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div
              v-if="currentBlendTarget === 'fill'"
              class="visual-effects-settings__row"
            >
              <span class="visual-effects-settings__label">
                {{ t('settings.visualEffects.blendTint') }}
              </span>
              <div
                role="radiogroup"
                :aria-label="t('settings.visualEffects.blendTint')"
                class="visual-effects-settings__tints"
              >
                <button
                  v-for="tint in INFUSION_BLEND_TINTS"
                  :key="tint"
                  type="button"
                  role="radio"
                  :aria-checked="currentBlendTint === tint"
                  :aria-label="tint"
                  class="visual-effects-settings__tint"
                  :class="{ 'visual-effects-settings__tint--selected': currentBlendTint === tint }"
                  :style="{ backgroundColor: tint }"
                  @click="applyBlendTint(tint, true)"
                >
                  <CheckIcon
                    v-if="currentBlendTint === tint"
                    class="visual-effects-settings__tint-check"
                  />
                </button>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <label
                      class="visual-effects-settings__tint visual-effects-settings__tint--custom"
                      :class="{ 'visual-effects-settings__tint--selected': isCustomBlendTint }"
                      :style="isCustomBlendTint ? { background: currentBlendTint } : undefined"
                    >
                      <input
                        type="color"
                        class="visual-effects-settings__tint-input"
                        :aria-label="t('settings.visualEffects.blendTintCustom')"
                        :value="currentBlendTint"
                        @input="onCustomBlendTintInput"
                        @change="onCustomBlendTintChange"
                      >
                      <CheckIcon
                        v-if="isCustomBlendTint"
                        class="visual-effects-settings__tint-check"
                      />
                    </label>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ t('settings.visualEffects.blendTintCustom') }}
                  </TooltipContent>
                </Tooltip>
              </div>
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

.visual-effects-settings__blend-target-list {
  min-width: 200px;
}

.visual-effects-settings__tints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 0.125rem;
  gap: 0.625rem;
}

.visual-effects-settings__tint {
  position: relative;
  display: flex;
  overflow: hidden;
  width: 1.5rem;
  height: 1.5rem;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid hsl(var(--foreground) / 15%);
  border-radius: 9999px;
  cursor: pointer;
  outline: none;
}

.visual-effects-settings__tint:focus-visible,
.visual-effects-settings__tint:focus-within {
  box-shadow: 0 0 0 3px hsl(var(--ring) / 50%);
}

.visual-effects-settings__tint--selected {
  box-shadow: 0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(var(--foreground));
}

.visual-effects-settings__tint--custom {
  background: conic-gradient(#ef4444, #f59e0b, #22c55e, #14b8a6, #3b82f6, #a855f7, #ec4899, #ef4444);
}

.visual-effects-settings__tint-input {
  position: absolute;
  width: 100%;
  height: 100%;
  cursor: pointer;
  inset: 0;
  opacity: 0;
}

.visual-effects-settings__tint-check {
  width: 0.875rem;
  height: 0.875rem;
  color: #ffffff;
  filter: drop-shadow(0 1px 1px rgb(0 0 0 / 60%));
  pointer-events: none;
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
