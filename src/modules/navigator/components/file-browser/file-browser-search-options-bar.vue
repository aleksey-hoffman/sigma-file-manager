<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
  FORK-MODIFICATION: 2026-10-16 —— 目录内搜索的选项条（用户反馈：选项要以常驻形式
  显示在搜索结果上方，而不是收在一个按钮+弹窗里）。

  之前这四个选项放在过滤框弹窗里，用户要「先点按钮、再点弹窗、再找那个勾」。
  而调整选项的目的恰恰是**看着结果变**，藏在弹窗里等于每次调参都要开合一次浮层。

  组件不读 store、不改状态，只负责渲染与上抛：真值与写侧都在
  composables/use-file-browser-search-options.ts，判定在
  utils/file-browser-search-options.ts。这样它能被复用，也能被直接测。
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NumberField, NumberFieldContent, NumberFieldDecrement,
  NumberFieldIncrement, NumberFieldInput,
} from '@/components/ui/number-field';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { SEARCH_CONSTANTS } from '@/constants';

const props = defineProps<{
  includeFiles: boolean;
  includeDirectories: boolean;
  exactMatch: boolean;
  typoTolerance: boolean;
  resultLimit: number;
  matchCount: number;
}>();

const emit = defineEmits<{
  (event: 'update:includeFiles', value: boolean | 'indeterminate'): void;
  (event: 'update:includeDirectories', value: boolean | 'indeterminate'): void;
  (event: 'update:exactMatch', value: boolean | 'indeterminate'): void;
  (event: 'update:typoTolerance', value: boolean | 'indeterminate'): void;
  (event: 'update:resultLimit', value: string | number | undefined): void;
}>();

const { t } = useI18n();

// 用 vue-i18n 的复数管道，中英文才有「无匹配 / 1 项 / N 项」的区分，
// 其余语言落到同一形式（见各语言包的键值）。
const matchCountText = computed(() => t('fileBrowser.searchOptions.matchCount', {
  n: props.matchCount,
}));
</script>

<template>
  <div
    class="file-browser-search-options"
    role="group"
    :aria-label="t('fileBrowser.searchOptions.title')"
  >
    <div class="file-browser-search-options__blocks">
      <div class="file-browser-search-options__block">
        <span class="file-browser-search-options__title">
          {{ t('fileBrowser.searchOptions.results') }}
        </span>
        <div class="file-browser-search-options__toggles">
          <div class="file-browser-search-options__toggle">
            <Checkbox
              id="fb-search-include-files"
              :model-value="includeFiles"
              @update:model-value="emit('update:includeFiles', $event)"
            />
            <Label
              for="fb-search-include-files"
              class="file-browser-search-options__label"
            >
              {{ t('globalSearch.showFiles') }}
            </Label>
          </div>
          <div class="file-browser-search-options__toggle">
            <Checkbox
              id="fb-search-include-directories"
              :model-value="includeDirectories"
              @update:model-value="emit('update:includeDirectories', $event)"
            />
            <Label
              for="fb-search-include-directories"
              class="file-browser-search-options__label"
            >
              {{ t('globalSearch.showDirectories') }}
            </Label>
          </div>
        </div>
      </div>

      <div class="file-browser-search-options__block">
        <span class="file-browser-search-options__title">
          {{ t('fileBrowser.searchOptions.options') }}
        </span>
        <div class="file-browser-search-options__toggles">
          <div class="file-browser-search-options__toggle">
            <Checkbox
              id="fb-search-exact-match"
              :model-value="exactMatch"
              @update:model-value="emit('update:exactMatch', $event)"
            />
            <Label
              for="fb-search-exact-match"
              class="file-browser-search-options__label"
            >
              {{ t('globalSearch.exactMatch') }}
            </Label>
          </div>
          <div class="file-browser-search-options__toggle">
            <Checkbox
              id="fb-search-typo-tolerance"
              :model-value="typoTolerance"
              @update:model-value="emit('update:typoTolerance', $event)"
            />
            <Label
              for="fb-search-typo-tolerance"
              class="file-browser-search-options__label"
            >
              {{ t('globalSearch.typoTolerance') }}
            </Label>
          </div>
        </div>
      </div>

      <div class="file-browser-search-options__block">
        <span class="file-browser-search-options__title">
          {{ t('settings.globalSearch.resultLimit') }}
        </span>
        <NumberField
          :model-value="resultLimit"
          class="file-browser-search-options__limit-field"
          :min="SEARCH_CONSTANTS.MIN_RESULT_LIMIT"
          :max="SEARCH_CONSTANTS.MAX_RESULT_LIMIT"
          :step="10"
          @update:model-value="emit('update:resultLimit', $event)"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>
    </div>

    <p class="file-browser-search-options__count">
      {{ matchCountText }}
    </p>
  </div>
</template>

<style scoped>
.file-browser-search-options {
  display: flex;
  flex-shrink: 0;
  align-items: flex-end;
  justify-content: space-between;
  border-bottom: 1px solid hsl(var(--border));
  padding: 6px var(--file-browser-search-options-gutter, 16px) 8px;
  gap: 16px;
}

.file-browser-search-options__blocks {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 8px 28px;
}

.file-browser-search-options__block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-browser-search-options__title {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.2;
  text-transform: uppercase;
}

.file-browser-search-options__toggles {
  display: flex;
  align-items: center;
  gap: 6px 16px;
  flex-wrap: wrap;
}

.file-browser-search-options__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-browser-search-options__label {
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}

.file-browser-search-options__limit-field {
  width: 6.5rem;
}

.file-browser-search-options__count {
  margin: 0;
  padding-bottom: 2px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: nowrap;
}

@media (width < 520px) {
  .file-browser-search-options {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
