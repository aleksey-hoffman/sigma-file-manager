<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxAnchor,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { ChevronsUpDownIcon, SearchIcon, CheckIcon } from 'lucide-vue-next';

interface ComboboxOption {
  [key: string]: unknown;
}

const props = withDefaults(
  defineProps<{
    modelValue: ComboboxOption | null | undefined;
    options: ComboboxOption[];
    by: string;
    displayKey?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    selectOnHighlight?: boolean;
    triggerWidth?: string;
  }>(),
  {
    displayKey: 'name',
    searchPlaceholder: 'Search',
    emptyText: undefined,
    selectOnHighlight: false,
    triggerWidth: '200px',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: ComboboxOption | null];
  'highlight': [payload: {
    ref: HTMLElement;
    value: AcceptableValue;
  } | undefined];
}>();

function getDisplayValue(option: ComboboxOption | null | undefined): string {
  if (!option) return '';
  const key = props.displayKey;
  const value = option[key];

  return typeof value === 'string' ? value : '';
}

function getOptionKey(option: ComboboxOption): string {
  const value = option[props.by];

  return String(value ?? '');
}

function onModelValueUpdate(value: AcceptableValue): void {
  const option = value !== null && value !== undefined && typeof value === 'object'
    ? (value as ComboboxOption)
    : null;

  emit('update:modelValue', option);
}

function onHighlight(payload: {
  ref: HTMLElement;
  value: AcceptableValue;
} | undefined): void {
  emit('highlight', payload);

  if (props.selectOnHighlight && payload?.value) {
    onModelValueUpdate(payload.value);
  }
}
</script>

<template>
  <Combobox
    :model-value="modelValue"
    :by="by"
    @update:model-value="onModelValueUpdate"
    @highlight="onHighlight"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <Button
          variant="outline"
          class="combobox__trigger"
          :style="{ width: triggerWidth }"
        >
          {{ getDisplayValue(modelValue) }}
          <ChevronsUpDownIcon class="combobox__chevron" />
        </Button>
      </ComboboxTrigger>
    </ComboboxAnchor>

    <ComboboxList
      class="combobox__list"
      :style="{ width: triggerWidth }"
    >
      <div class="combobox__content">
        <span class="combobox__search-icon">
          <SearchIcon class="combobox__search-icon-icon" />
        </span>
        <ComboboxInput
          class="combobox__input"
          :placeholder="searchPlaceholder"
        />
      </div>

      <ComboboxEmpty
        v-if="emptyText"
      >
        {{ emptyText }}
      </ComboboxEmpty>

      <ComboboxGroup>
        <ComboboxItem
          v-for="option in options"
          :key="getOptionKey(option)"
          :value="option"
        >
          {{ getDisplayValue(option) }}
          <ComboboxItemIndicator>
            <CheckIcon class="combobox__check" />
          </ComboboxItemIndicator>
        </ComboboxItem>
      </ComboboxGroup>
    </ComboboxList>
  </Combobox>
</template>

<style scoped>
.combobox__trigger {
  display: flex;
  justify-content: flex-start;
  text-align: left;
}

.combobox__chevron {
  width: 1rem;
  height: 1rem;
  flex-shrink: 0;
  margin-left: auto;
  opacity: 0.5;
}

.combobox__content {
  position: relative;
  padding: 0;
}

.combobox__search-icon {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  padding: 0 0.75rem;
}

.combobox__search-icon-icon {
  width: 1rem;
  height: 1rem;
  color: hsl(var(--muted-foreground));
}

.combobox__input {
  height: 2.25rem;
  padding-left: 2.25rem;
  border: none;
  border-radius: 0;
  background-color: transparent;
  box-shadow: none;
  color: hsl(var(--foreground));
  outline: none;
}

.combobox__check {
  width: 1rem;
  height: 1rem;
  margin-left: auto;
}
</style>
