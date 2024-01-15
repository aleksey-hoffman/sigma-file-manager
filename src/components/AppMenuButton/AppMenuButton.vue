<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {mergeProps} from 'vue';

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
  size?: string | number;

  menuItems?: Array<{
    title: string;
    subtitle: string;
    icon: string;
    iconSize: string;
    onClick: () => void;
  }>;
  menuItemAttributes?: {
    twoLine?: boolean;
    dense?: boolean;
  };
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
  size: 32,

  menuItems: () => ([]),
  menuItemAttributes: () => ({})
});

const emit = defineEmits<Emits>();

const menuButtonOnClick = (event: MouseEvent) => {
  emit('click', event);
};

</script>

<template>
  <VMenu offset-y>
    <template #activator="{ props: menuProps }">
      <VTooltip
        location="bottom"
      >
        <template #activator="{ props: tooltipProps }">
          <VBtn
            :value="props.value"
            :icon="!!props.icon && props.type === 'icon'"
            :size="props.size"
            :class="props.buttonClass"
            :disabled="props.isDisabled"
            v-bind="mergeProps(menuProps, tooltipProps)"
            @click="menuButtonOnClick"
          >
            <Icon
              v-if="props.icon"
              :icon="props.icon"
              :class="props.iconClass"
              v-bind="props.iconProps"
              :style="`font-size: ${props.iconSize}`"
            />
            <slot />
          </VBtn>
        </template>
        <span>
          <div>
            {{ props.tooltip }}
          </div>
          <div v-if="props.tooltipShortcuts">
            <div
              v-for="(shortcut, index) in props.tooltipShortcuts"
              :key="index"
            >
              <span class="inline-code--light">{{ shortcut.value }}</span>
              - {{ shortcut.description }}
            </div>
          </div>
        </span>
      </VTooltip>
    </template>
    <VList
      v-if="props.menuItems"
      dense
    >
      <VListItem
        v-for="(item, index) in props.menuItems"
        :key="index"
        v-bind="props.menuItemAttributes"
        @click="item.onClick"
      >
        <div class="mr-4">
          <Icon
            v-if="item.icon"
            :icon="item.icon"
            :style="`font-size: ${item.iconSize || '18px'}`"
          />
        </div>

        <template v-if="item.subtitle">
          <VListItemTitle>
            {{ item.title }}
          </VListItemTitle>
          <VListItemSubtitle>
            {{ item.subtitle }}
          </VListItemSubtitle>
        </template>

        <VListItemTitle v-else>
          {{ item.title }}
        </VListItemTitle>
      </VListItem>
    </VList>
  </VMenu>
</template>
