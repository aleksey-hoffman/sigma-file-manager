<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {computed, useSlots} from 'vue';

interface Props {
  type?: 'icon' | 'button';
  icon?: string;
  iconSize?: string;
  iconClass?: string | object;
  buttonClass?: string | object;
  tooltip?: string;
  tooltipShortcuts?: Array<{ value: string; description: string }>;
  iconProps?: Record<string, unknown>;
  isDisabled?: boolean;
  value?: string;
  size?: 'x-small' | 'small' | 'default' | 'large' | 'x-large' | number;
}

interface Emits {
  (event: 'click', value: MouseEvent): void;
}

const props = withDefaults(defineProps<Props>(), {
  tooltipShortcuts: () => [],
  iconProps: () => ({}),
  type: 'icon',
  icon: '',
  iconSize: '20px',
  iconClass: '',
  buttonClass: '',
  tooltip: '',
  value: '',
  isDisabled: false,
  size: 'small'
});

const emit = defineEmits<Emits>();

const slots = useSlots();

const isTooltipEnabled = computed(() => props.tooltip || slots.tooltip);

function onClickHandler (event: MouseEvent) {
  emit('click', event);
}
</script>

<template>
  <VTooltip
    location="bottom"
    :disabled="!isTooltipEnabled"
  >
    <template #activator="{ props: tooltipProps }">
      <VBtn
        :value="props.value"
        :icon="!!props.icon && props.type === 'icon'"
        :size="props.size"
        :class="props.buttonClass"
        :disabled="props.isDisabled"
        variant="tonal"
        color="transparent"
        rounded="xs"
        v-bind="tooltipProps"
        @click="onClickHandler"
      >
        <Icon
          v-if="!!props.icon && props.type === 'icon'"
          :icon="props.icon"
          :class="props.iconClass"
          v-bind="props.iconProps"
          :style="`font-size: ${props.iconSize}`"
        />
        <slot />
      </VBtn>
    </template>
    <div v-if="props.tooltip">
      {{ props.tooltip }}
    </div>
    <slot
      v-if="slots.tooltip"
      name="tooltip"
    />
    <div v-if="props.tooltipShortcuts">
      <div
        v-for="(shortcut, index) in props.tooltipShortcuts"
        :key="index"
      >
        <span class="inline-code--light">{{ shortcut.value }}</span>
        - {{ shortcut.description }}
      </div>
    </div>
  </VTooltip>
</template>

<style>
#app
  .v-btn {
    border-radius: 4px;
  }

#app
  .v-btn:hover {
    color: var(--button-bg-color) !important;
  }

#app
  .v-btn.button-1 {
    color: var(--button-1-bg-color) !important;
  }
</style>