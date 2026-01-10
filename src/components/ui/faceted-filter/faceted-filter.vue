<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon, CirclePlusIcon } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';

const props = withDefaults(defineProps<{
  title: string;
  options: string[];
  modelValue: string[];
  maxBadges?: number;
  allowCreate?: boolean;
  minWidth?: number;
}>(), {
  maxBadges: 2,
  allowCreate: false,
  minWidth: 200,
});

const emit = defineEmits<{
  'update:modelValue': [value: string[]];
  'create': [value: string];
}>();

const { t } = useI18n();
const searchQuery = ref('');
const commandKey = ref(0);

const trimmedSearchQuery = computed(() => searchQuery.value.trim());
const selectedValues = computed(() => new Set(props.modelValue));
const filteredOptions = computed(() => {
  const normalizedSearch = searchQuery.value.trim().toLowerCase();
  if (!normalizedSearch) return props.options;
  return props.options.filter(option => option.toLowerCase().includes(normalizedSearch));
});

const canCreate = computed(() => {
  if (!props.allowCreate) return false;
  const value = trimmedSearchQuery.value;
  if (value.length === 0) return false;
  const normalizedValue = value.toLowerCase();
  return !props.options.some(option => option.toLowerCase() === normalizedValue);
});

const selectedBadges = computed(() => {
  return props.options.filter(option => selectedValues.value.has(option)).slice(0, props.maxBadges);
});

const contentStyle = computed(() => props.minWidth ? ({ minWidth: `${props.minWidth}px` }) : undefined);

function toggleValue(value: string) {
  const next = new Set(props.modelValue);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  emit('update:modelValue', Array.from(next));
}

function createFromSearchQuery() {
  const value = trimmedSearchQuery.value;
  if (!value) return;
  emit('create', value);
  clearSearch();
  commandKey.value += 1;
}

function clearSearch() {
  searchQuery.value = '';
}
</script>

<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="xs"
        class="faceted-filter__trigger"
      >
        <CirclePlusIcon class="faceted-filter__trigger-icon" />
        {{ props.title }}
        <template v-if="selectedValues.size > 0">
          <Separator
            orientation="vertical"
            class="faceted-filter__separator"
          />
          <span class="faceted-filter__count">
            {{ selectedValues.size }}
          </span>
          <div class="faceted-filter__badges">
            <span
              v-for="badge in selectedBadges"
              :key="badge"
              class="faceted-filter__badge"
            >
              {{ badge }}
            </span>
            <span
              v-if="selectedValues.size > props.maxBadges"
              class="faceted-filter__badge"
            >
              +{{ selectedValues.size - props.maxBadges }}
            </span>
          </div>
        </template>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      class="faceted-filter__content"
      align="start"
      :style="contentStyle"
    >
      <Command :key="commandKey">
        <CommandInput
          v-model="searchQuery"
          :placeholder="props.title"
          @keydown.esc="clearSearch"
        />
        <CommandList>
          <CommandEmpty v-if="filteredOptions.length === 0 && !canCreate">
            {{ t('noData') }}
          </CommandEmpty>
          <div
            v-if="canCreate"
            class="faceted-filter__empty-create"
          >
            <Button
              variant="outline"
              size="sm"
              class="faceted-filter__empty-create-button"
              @click="createFromSearchQuery"
            >
              <CirclePlusIcon class="faceted-filter__empty-create-icon" />
              {{ t('add') }} {{ trimmedSearchQuery }}
            </Button>
          </div>
          <CommandGroup>
            <CommandItem
              v-for="option in filteredOptions"
              :key="option"
              :value="option"
              @select="() => toggleValue(option)"
            >
              <div
                class="faceted-filter__checkbox"
                :data-selected="selectedValues.has(option) || undefined"
              >
                <CheckIcon class="faceted-filter__check" />
              </div>
              <span class="faceted-filter__option-text">{{ option }}</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator v-if="$slots.footer" />
          <div
            v-if="$slots.footer"
            class="faceted-filter__footer"
          >
            <slot name="footer" />
          </div>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<style scoped>
.faceted-filter__trigger {
  border-style: dashed;
  gap: 8px;
}

.faceted-filter__trigger-icon {
  width: 14px;
  height: 14px;
}

.faceted-filter__separator {
  height: 14px;
  margin: 0 6px;
}

.faceted-filter__count {
  display: inline-flex;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 6px;
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font-size: 11px;
}

.faceted-filter__badges {
  display: none;
  gap: 6px;
}

.faceted-filter__badge {
  display: inline-flex;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 6px;
  background-color: hsl(var(--secondary));
  color: hsl(var(--secondary-foreground));
  font-size: 11px;
}

.faceted-filter__content {
  width: 320px;
  padding: 0;
}

.faceted-filter__empty-create {
  padding: 10px;
}

.faceted-filter__empty-create-button {
  width: 100%;
  justify-content: flex-start;
  gap: 8px;
}

.faceted-filter__empty-create-icon {
  width: 16px;
  height: 16px;
}

.faceted-filter__checkbox {
  display: flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  margin-right: 10px;
  opacity: 0.6;
}

.faceted-filter__checkbox:not([data-selected]) .faceted-filter__check {
  visibility: hidden;
}

.faceted-filter__checkbox[data-selected] {
  border-color: hsl(var(--primary) / 60%);
  background: hsl(var(--primary) / 15%);
  opacity: 1;
}

.faceted-filter__check {
  width: 14px;
  height: 14px;
  color: hsl(var(--primary));
}

.faceted-filter__option-text {
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: text;
  white-space: nowrap;
}

.faceted-filter__footer {
  padding: 10px 10px 12px;
}

@media (width >= 1024px) {
  .faceted-filter__badges {
    display: flex;
  }

  .faceted-filter__count {
    display: none;
  }
}
</style>
