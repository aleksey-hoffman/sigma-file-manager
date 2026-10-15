<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  NumberField, NumberFieldContent, NumberFieldDecrement,
  NumberFieldIncrement, NumberFieldInput,
} from '@/components/ui/number-field';
import { SlidersHorizontalIcon, TextSearchIcon, XIcon, ChevronDownIcon } from '@lucide/vue';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import {
  QUICK_SEARCH_PROPERTY_KEYS,
  parseQuickSearchQuery,
  toggleQuickSearchPropertyInQuery,
  type QuickSearchProperty,
} from '@/modules/navigator/components/file-browser/utils/file-browser-quick-search-query';
import { SEARCH_CONSTANTS } from '@/constants';
import { useIsSmallScreen } from '@/composables/use-responsive-query';

const props = defineProps<{
  filterQuery: string;
  isFilterOpen: boolean;
  focusInput: boolean;
  // FORK-MODIFICATION: 需求反馈 2 —— 与全局搜索同款的四个搜索选项。
  searchIncludeFiles: boolean;
  searchIncludeDirectories: boolean;
  searchExactMatch: boolean;
  searchResultLimit: number;
  // 命中数；父组件在非搜索态传 -1，面板据此隐藏这一行而不是显示「0 项」。
  searchMatchCount: number;
}>();

const emit = defineEmits<{
  (event: 'update:filterQuery', value: string): void;
  (event: 'update:isFilterOpen', value: boolean): void;
  (event: 'update:searchIncludeFiles', value: boolean | 'indeterminate'): void;
  (event: 'update:searchIncludeDirectories', value: boolean | 'indeterminate'): void;
  (event: 'update:searchExactMatch', value: boolean | 'indeterminate'): void;
  (event: 'update:searchResultLimit', value: string | number | undefined): void;
  (event: 'filterInputFocused'): void;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

const filterInputRef = ref<InstanceType<typeof Input> | null>(null);
const filterTriggerRef = ref<HTMLElement | ComponentPublicInstance | null>(null);
const isPropertyPanelOpen = ref(false);
const isOptionsPanelOpen = ref(false);
const shouldFocusOnButtonOpen = ref(false);
const isSmallScreen = useIsSmallScreen();

const activeProperty = computed(() => parseQuickSearchQuery(props.filterQuery.trim()).property);
const quickSearchPopoverSide = computed<'bottom' | 'left'>(() => isSmallScreen.value ? 'bottom' : 'left');

// 面板标题右侧的命中数。传入 -1（父组件不在搜索态）时整个数字块不渲染 ——
// 在一个空过滤框下面写「0 项」会被读成「搜了没结果」，与真实状态相反。
const matchCountText = computed(() => props.searchMatchCount < 0
  ? null
  : t('fileBrowser.searchOptions.matchCount', { n: props.searchMatchCount }));

watch(() => [props.isFilterOpen, props.focusInput] as const, async ([open, focusInput]) => {
  if (!open) {
    isPropertyPanelOpen.value = false;
    isOptionsPanelOpen.value = false;
    shouldFocusOnButtonOpen.value = false;
    return;
  }

  if (focusInput || shouldFocusOnButtonOpen.value) {
    await nextTick();
    filterInputRef.value?.$el?.focus();
    shouldFocusOnButtonOpen.value = false;
    emit('filterInputFocused');
  }
});

const propertyLabelKeys: Record<QuickSearchProperty, string> = {
  name: 'fileBrowser.name',
  size: 'fileBrowser.size',
  items: 'fileBrowser.items',
  modified: 'fileBrowser.modified',
  created: 'created',
  accessed: 'accessed',
  path: 'path',
  mime: 'type',
};

function labelForProperty(property: QuickSearchProperty): string {
  return t(propertyLabelKeys[property]);
}

function tooltipForProperty(property: QuickSearchProperty): string {
  return t(`fileBrowser.quickSearchPropertyTooltip.${property}`);
}

function handleFilterAutoFocus(event: Event) {
  event.preventDefault();
}

function clearFilter() {
  emit('update:filterQuery', '');
  isPropertyPanelOpen.value = false;
}

function handleFilterQueryUpdate(value: string | number | undefined) {
  emit('update:filterQuery', String(value ?? ''));
}

function handleFilterButtonClick() {
  if (!props.isFilterOpen) {
    shouldFocusOnButtonOpen.value = true;
  }
}

function getFilterTriggerElement(): HTMLElement | null {
  const refValue = filterTriggerRef.value;
  if (!refValue) return null;
  if (refValue instanceof HTMLElement) return refValue;
  return (refValue as ComponentPublicInstance).$el as HTMLElement;
}

function handleFilterInteractOutside(event: Event) {
  const customEvent = event as CustomEvent<{ originalEvent: PointerEvent | FocusEvent }>;
  const target = customEvent.detail?.originalEvent?.target as Node | undefined;
  const triggerEl = getFilterTriggerElement();
  const isTriggerClick = triggerEl && target && triggerEl.contains(target);

  if (isTriggerClick) {
    event.preventDefault();
    return;
  }

  if (!props.filterQuery) {
    emit('update:isFilterOpen', false);
  }
  else {
    event.preventDefault();
  }
}

function togglePropertyPanel() {
  isPropertyPanelOpen.value = !isPropertyPanelOpen.value;

  // 两个面板互斥。它们的内容都是「在同一次搜索里怎么筛」，同时展开会让弹窗长到
  // 需要滚动，而 340px 宽的弹窗一滚动就正好盖住底下的过滤输入框。
  if (isPropertyPanelOpen.value) {
    isOptionsPanelOpen.value = false;
  }
}

// FORK-MODIFICATION: 需求反馈 2 —— 搜索选项面板（与全局搜索的滑块面板同构）。
function toggleOptionsPanel() {
  isOptionsPanelOpen.value = !isOptionsPanelOpen.value;

  if (isOptionsPanelOpen.value) {
    isPropertyPanelOpen.value = false;
  }
}

function setResultLimit(value: string | number | undefined) {
  emit('update:searchResultLimit', value);
}

function selectProperty(property: QuickSearchProperty) {
  emit('update:filterQuery', toggleQuickSearchPropertyInQuery(props.filterQuery, property));
}
</script>

<template>
  <Tooltip>
    <Popover
      :open="isFilterOpen"
      :modal="false"
      @update:open="emit('update:isFilterOpen', $event)"
    >
      <TooltipTrigger as-child>
        <PopoverTrigger as-child>
          <Button
            ref="filterTriggerRef"
            variant="ghost"
            size="icon"
            class="file-browser-toolbar-filter__button"
            :class="{ 'file-browser-toolbar-filter__button--active': filterQuery }"
            @click="handleFilterButtonClick"
          >
            <TextSearchIcon class="file-browser-toolbar-filter__icon" />
          </Button>
        </PopoverTrigger>
      </TooltipTrigger>
      <TooltipContent>
        <div class="file-browser-toolbar-filter__tooltip-row">
          {{ t('fileBrowser.quickSearch') }}
          <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('toggleFilter') }}</ContextMenuShortcut>
        </div>
      </TooltipContent>
      <PopoverContent
        data-file-browser-toolbar-filter-popover
        :side="quickSearchPopoverSide"
        :align="'center'"
        class="file-browser-toolbar-filter__popover"
        @open-auto-focus="handleFilterAutoFocus"
        @close-auto-focus.prevent
        @interact-outside="handleFilterInteractOutside"
      >
        <div class="file-browser-toolbar-filter__field-row">
          <Input
            ref="filterInputRef"
            :model-value="filterQuery"
            :placeholder="t('fileBrowser.searchThisDirectory')"
            class="file-browser-toolbar-filter__input"
            @update:model-value="handleFilterQueryUpdate"
          />
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="file-browser-toolbar-filter__suffix-btn"
                :class="{
                  'file-browser-toolbar-filter__suffix-btn--active': isPropertyPanelOpen,
                }"
                :aria-expanded="isPropertyPanelOpen"
                :aria-label="t('fileBrowser.quickSearchFilterByColumn')"
                @click="togglePropertyPanel"
              >
                <ChevronDownIcon
                  class="file-browser-toolbar-filter__chevron"
                  :class="{ 'file-browser-toolbar-filter__chevron--open': isPropertyPanelOpen }"
                  :size="16"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ t('fileBrowser.quickSearchFilterByColumn') }}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="file-browser-toolbar-filter__suffix-btn"
                :class="{
                  'file-browser-toolbar-filter__suffix-btn--active': isOptionsPanelOpen,
                }"
                :aria-expanded="isOptionsPanelOpen"
                :aria-label="t('fileBrowser.searchOptions.title')"
                @click="toggleOptionsPanel"
              >
                <SlidersHorizontalIcon :size="16" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {{ t('fileBrowser.searchOptions.title') }}
            </TooltipContent>
          </Tooltip>
          <Button
            v-if="filterQuery"
            variant="ghost"
            size="icon"
            class="file-browser-toolbar-filter__suffix-btn"
            @click="clearFilter"
          >
            <XIcon :size="14" />
          </Button>
        </div>
        <div
          v-show="isPropertyPanelOpen"
          class="file-browser-toolbar-filter__property-panel"
          role="group"
          :aria-label="t('fileBrowser.quickSearchFilterByColumn')"
        >
          <div class="file-browser-toolbar-filter__property-panel-title">
            {{ t('fileBrowser.quickSearchFilterByColumn') }}
          </div>
          <div class="file-browser-toolbar-filter__property-toggles">
            <Tooltip
              v-for="property in QUICK_SEARCH_PROPERTY_KEYS"
              :key="property"
            >
              <TooltipTrigger as-child>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  :class="[
                    'file-browser-toolbar-filter__property-toggle',
                    { 'file-browser-toolbar-filter__property-toggle--active': activeProperty === property },
                  ]"
                  @click="selectProperty(property)"
                >
                  {{ labelForProperty(property) }}
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                class="file-browser-toolbar-filter__property-tooltip"
              >
                {{ tooltipForProperty(property) }}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        <!-- FORK-MODIFICATION: 需求反馈 2 —— 与全局搜索同款的搜索选项面板。
             四个开关的值存在 userSettings.globalSearch.*，与全局搜索共用，不是副本。 -->
        <div
          v-show="isOptionsPanelOpen"
          class="file-browser-toolbar-filter__options-panel"
          role="group"
          :aria-label="t('fileBrowser.searchOptions.title')"
        >
          <div class="file-browser-toolbar-filter__options-panel-title">
            <span>{{ t('fileBrowser.searchOptions.title') }}</span>
            <span
              v-if="matchCountText !== null"
              class="file-browser-toolbar-filter__options-panel-count"
            >
              {{ matchCountText }}
            </span>
          </div>

          <div class="file-browser-toolbar-filter__options-row">
            <Checkbox
              id="file-browser-search-include-files"
              :model-value="searchIncludeFiles"
              @update:model-value="emit('update:searchIncludeFiles', $event)"
            />
            <Label
              for="file-browser-search-include-files"
              class="file-browser-toolbar-filter__option-label"
            >
              {{ t('globalSearch.showFiles') }}
            </Label>
          </div>

          <div class="file-browser-toolbar-filter__options-row">
            <Checkbox
              id="file-browser-search-include-directories"
              :model-value="searchIncludeDirectories"
              @update:model-value="emit('update:searchIncludeDirectories', $event)"
            />
            <Label
              for="file-browser-search-include-directories"
              class="file-browser-toolbar-filter__option-label"
            >
              {{ t('globalSearch.showDirectories') }}
            </Label>
          </div>

          <div class="file-browser-toolbar-filter__options-row">
            <Checkbox
              id="file-browser-search-exact-match"
              :model-value="searchExactMatch"
              @update:model-value="emit('update:searchExactMatch', $event)"
            />
            <Label
              for="file-browser-search-exact-match"
              class="file-browser-toolbar-filter__option-label"
            >
              {{ t('globalSearch.exactMatch') }}
            </Label>
          </div>

          <div class="file-browser-toolbar-filter__options-limit-row">
            <span class="file-browser-toolbar-filter__option-label">
              {{ t('settings.globalSearch.resultLimit') }}
            </span>
            <NumberField
              :model-value="searchResultLimit"
              class="file-browser-toolbar-filter__options-limit-field"
              :min="SEARCH_CONSTANTS.MIN_RESULT_LIMIT"
              :max="SEARCH_CONSTANTS.MAX_RESULT_LIMIT"
              :step="10"
              @update:model-value="setResultLimit"
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </Tooltip>
</template>

<style scoped>
.file-browser-toolbar-filter__button {
  width: 36px;
  height: 36px;
}

.file-browser-toolbar-filter__button--active {
  background-color: hsl(var(--secondary));
  color: hsl(var(--foreground));
}

.file-browser-toolbar-filter__icon {
  width: 18px;
  height: 18px;
}

.file-browser-toolbar-filter__field-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-browser-toolbar-filter__input {
  min-width: 0;
  height: 28px;
  flex: 1 1 auto;
}

.file-browser-toolbar-filter__suffix-btn {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.file-browser-toolbar-filter__suffix-btn--active {
  background-color: hsl(var(--secondary));
}

.file-browser-toolbar-filter__chevron {
  transition: transform 0.15s ease;
}

.file-browser-toolbar-filter__chevron--open {
  transform: rotate(180deg);
}

.file-browser-toolbar-filter__property-panel {
  padding: 4px;
  border-top: 1px solid hsl(var(--border) / 50%);
  margin-top: 4px;
}

.file-browser-toolbar-filter__property-panel-title {
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.file-browser-toolbar-filter__property-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.file-browser-toolbar-filter__property-toggle {
  height: 1.375rem;
  min-height: 1.375rem;
  padding: 0 0.35rem;
  font-size: 11px;
  line-height: 1.15;
  text-transform: capitalize;
}

.file-browser-toolbar-filter__property-toggle--active {
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
}

.file-browser-toolbar-filter__property-toggle--active:hover {
  background-color: hsl(var(--secondary) / 80%);
  color: hsl(var(--secondary-foreground));
}

.file-browser-toolbar-filter__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.file-browser-toolbar-filter__options-panel {
  padding: 4px;
  border-top: 1px solid hsl(var(--border) / 50%);
  margin-top: 4px;
}

.file-browser-toolbar-filter__options-panel-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.file-browser-toolbar-filter__options-panel-count {
  color: hsl(var(--muted-foreground) / 80%);
  font-weight: 500;
  letter-spacing: normal;
  text-transform: none;
  font-variant-numeric: tabular-nums;
}

.file-browser-toolbar-filter__options-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-block: 2px;
}

.file-browser-toolbar-filter__option-label {
  font-size: 12px;
  cursor: pointer;
}

.file-browser-toolbar-filter__options-limit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-top: 8px;
  margin-top: 6px;
  border-top: 1px solid hsl(var(--border) / 40%);
}

.file-browser-toolbar-filter__options-limit-field {
  width: 6.5rem;
  flex-shrink: 0;
}
</style>

<style>
.file-browser-toolbar-filter__popover.sigma-ui-popover-content {
  width: min(340px, calc(100vw - 32px));
  padding: 4px;
}

.file-browser-toolbar-filter__property-tooltip.sigma-ui-tooltip-content {
  max-width: 18rem;
  line-height: 1.35;
}
</style>
