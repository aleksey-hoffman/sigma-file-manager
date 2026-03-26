<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref } from 'vue';
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
import { TextSearchIcon, XIcon } from '@lucide/vue';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';

const props = defineProps<{
  filterQuery: string;
  isFilterOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:filterQuery', value: string): void;
  (event: 'update:isFilterOpen', value: boolean): void;
}>();

const { t } = useI18n();
const shortcutsStore = useShortcutsStore();

const filterInputRef = ref<InstanceType<typeof Input> | null>(null);
const filterTriggerRef = ref<HTMLElement | ComponentPublicInstance | null>(null);

function handleFilterAutoFocus(event: Event) {
  event.preventDefault();
  filterInputRef.value?.$el?.focus();
}

function clearFilter() {
  emit('update:filterQuery', '');
}

function handleFilterQueryUpdate(value: string | number | undefined) {
  emit('update:filterQuery', String(value ?? ''));
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
        :side="'bottom'"
        :align="'end'"
        class="file-browser-toolbar-filter__popover"
        @open-auto-focus="handleFilterAutoFocus"
        @close-auto-focus.prevent
        @interact-outside="handleFilterInteractOutside"
      >
        <div class="file-browser-toolbar-filter__input-wrapper">
          <Input
            ref="filterInputRef"
            :model-value="filterQuery"
            :placeholder="t('fileBrowser.searchThisDirectory')"
            class="file-browser-toolbar-filter__input"
            @update:model-value="handleFilterQueryUpdate"
          />
          <Button
            v-if="filterQuery"
            variant="ghost"
            size="icon"
            class="file-browser-toolbar-filter__clear"
            @click="clearFilter"
          >
            <XIcon :size="14" />
          </Button>
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

.file-browser-toolbar-filter__input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.file-browser-toolbar-filter__input {
  width: 100%;
  height: 36px;
  padding-right: 36px;
}

.file-browser-toolbar-filter__clear {
  position: absolute;
  right: 4px;
  width: 28px;
  height: 28px;
}

.file-browser-toolbar-filter__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>

<style>
.file-browser-toolbar-filter__popover.sigma-ui-popover-content {
  width: 280px;
  padding: 8px;
}
</style>
