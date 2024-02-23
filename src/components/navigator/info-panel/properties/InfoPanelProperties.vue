<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {useKeyModifier, useClipboard} from '@vueuse/core';
import {ref} from 'vue';
import {useNavigatorStore} from '@/stores/runtime/navigator';

const navigatorStore = useNavigatorStore();
const controlState = useKeyModifier('Control');
const clipboardSource = ref('Hello');
const {copy} = useClipboard({source: clipboardSource});

function propertyValueOnClick (params) {
  copy(params.item.value);
}
</script>

<template>
  <div class="navigator-info-panel__properties">
    <div
      v-for="(item, index) in navigatorStore.runtime.navigator.infoPanel.properties"
      :key="index"
      class="navigator-info-panel__properties-item fade-in-500ms"
    >
      <div class="navigator-info-panel__properties-item-title">
        {{ item.title }}
      </div>

      <VTooltip
        :disabled="!item.tooltip"
        location="bottom"
        max-width="400px"
        offset-overflow
      >
        <template #activator="{ props }">
          <div
            class="navigator-info-panel__properties-item-value"
            :class="{ 'cursor-pointer': controlState }"
            v-bind="props"
            @click.ctrl="propertyValueOnClick({ event: $event, item })"
          >
            {{ item.value }}
          </div>
        </template>
        <span v-html="item.tooltip" />
      </VTooltip>
    </div>
  </div>
</template>

<style>
.navigator-info-panel__properties {
  position: relative;
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--info-panel-preview-height) -
    var(--info-panel-sub-header-height) -
    var(--info-panel-properties-header-height) -
    var(--navigator-sorting-header-height)
  );
  padding: 0 16px;
  margin-bottom: 8px;
  color: var(--color-lighter-1);
  -webkit-mask-image: linear-gradient(180deg, #FFFFFF 85%,transparent);
  transition: padding 1s ease;
}

.navigator-info-panel__properties[bottom-toolbar-padding] {
  padding-bottom: var(--clipboard-toolbar-height);
}

.navigator-info-panel__properties-item {
  min-height: 48px;
  margin-bottom: 4px;
}

.navigator-info-panel__properties
  .v-btn {
    height: 24px !important;
  }

.navigator-info-panel__properties-item--separator {
  display: flex;
  align-items: center;
  padding: 8px 4px;
  border-radius: 4px;
  border-top: 1px solid hsl(var(--light) / 5%);
  border-bottom: 1px solid hsl(var(--light) / 5%);
  color: var(--color-7);
  font-size: 14px;
  text-transform: uppercase;
  user-select: none;
}

.navigator-info-panel__properties-item-title {
  margin-right: 8px;
  color: var(--color);
  font-size: 12px;
  text-transform: uppercase;
  user-select: none;
}

.navigator-info-panel__properties-item-value {
  width: fit-content;
  margin-bottom: 8px;
  color: var(--color-darker-3);
  font-size: 14px;
  word-break: break-all;
}
</style>