<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui';
import { computed } from 'vue';
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
  ComboboxSeparator,
  ComboboxTrigger,
} from '@/components/ui/combobox';
import { ChevronsUpDownIcon, SearchIcon, CheckIcon } from '@lucide/vue';

interface ComboboxOption {
  [key: string]: unknown;
}

interface ComboboxOptionGroup {
  heading?: string;
  options: ComboboxOption[];
}

const props = withDefaults(
  defineProps<{
    modelValue: ComboboxOption | null | undefined;
    options: ComboboxOption[];
    optionGroups?: ComboboxOptionGroup[];
    by: string;
    displayKey?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    selectOnHighlight?: boolean;
    closeOnSelect?: boolean;
    triggerWidth?: string;
  }>(),
  {
    displayKey: 'name',
    optionGroups: undefined,
    searchPlaceholder: 'Search',
    emptyText: undefined,
    selectOnHighlight: false,
    closeOnSelect: true,
    triggerWidth: '200px',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: ComboboxOption | null];
  'update:open': [value: boolean];
  'select': [payload: {
    ref: HTMLElement;
    value: AcceptableValue;
  }];
  'highlight': [payload: {
    ref: HTMLElement;
    value: AcceptableValue;
  } | undefined];
  'keyboardHighlight': [payload: {
    ref: HTMLElement;
    value: AcceptableValue;
  } | undefined];
}>();

let lastHighlightInput: 'keyboard' | 'pointer' | null = null;

const displayOptionGroups = computed<ComboboxOptionGroup[]>(() => {
  if (props.optionGroups?.length) {
    return props.optionGroups.filter(group => group.options.length > 0);
  }

  return [
    {
      options: props.options,
    },
  ];
});

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

function getGroupKey(group: ComboboxOptionGroup, groupIndex: number): string {
  return group.heading ?? `group-${groupIndex}`;
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
  const highlightedByKeyboard = lastHighlightInput === 'keyboard';
  emit('highlight', payload);

  if (highlightedByKeyboard) {
    emit('keyboardHighlight', payload);
    lastHighlightInput = null;
  }

  if (props.selectOnHighlight && highlightedByKeyboard && payload?.value) {
    onModelValueUpdate(payload.value);
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (
    event.key === 'ArrowDown'
    || event.key === 'ArrowUp'
    || event.key === 'Home'
    || event.key === 'End'
    || event.key === 'PageDown'
    || event.key === 'PageUp'
  ) {
    lastHighlightInput = 'keyboard';
  }
}

function onPointerMove(): void {
  lastHighlightInput = 'pointer';
}

function onItemMousedown(event: MouseEvent): void {
  if (!props.closeOnSelect) {
    event.preventDefault();
  }
}

function getItemSelectElement(event: Event): HTMLElement | null {
  if (event.currentTarget instanceof HTMLElement) {
    return event.currentTarget;
  }

  if (event.target instanceof HTMLElement) {
    return event.target.closest('[role="option"]');
  }

  return null;
}

function onItemSelect(event: Event, option: ComboboxOption): void {
  const itemElement = getItemSelectElement(event);

  if (itemElement) {
    emit('select', {
      ref: itemElement,
      value: option,
    });
  }

  if (!props.closeOnSelect) {
    event.preventDefault();
    onModelValueUpdate(option);
  }
}
</script>

<template>
  <Combobox
    :model-value="modelValue"
    :by="by"
    @update:model-value="onModelValueUpdate"
    @update:open="emit('update:open', $event)"
    @highlight="onHighlight"
    @pointermove="onPointerMove"
  >
    <ComboboxAnchor as-child>
      <ComboboxTrigger as-child>
        <Button
          variant="outline"
          class="combobox__trigger"
          :style="{ width: triggerWidth }"
          @keydown.capture="onKeydown"
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
          @keydown.capture="onKeydown"
        />
      </div>

      <ComboboxEmpty
        v-if="emptyText"
      >
        {{ emptyText }}
      </ComboboxEmpty>

      <template
        v-for="(group, groupIndex) in displayOptionGroups"
        :key="getGroupKey(group, groupIndex)"
      >
        <ComboboxSeparator v-if="groupIndex > 0" />
        <ComboboxGroup
          :heading="group.heading"
        >
          <ComboboxItem
            v-for="option in group.options"
            :key="getOptionKey(option)"
            :value="option"
            @mousedown="onItemMousedown"
            @select="onItemSelect($event, option)"
          >
            {{ getDisplayValue(option) }}
            <ComboboxItemIndicator>
              <CheckIcon class="combobox__check" />
            </ComboboxItemIndicator>
          </ComboboxItem>
        </ComboboxGroup>
      </template>
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
  border-bottom: 1px solid hsl(var(--border));
  background-color: hsl(var(--popover));
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
