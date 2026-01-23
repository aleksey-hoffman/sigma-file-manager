<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { TabsTrigger, type TabsTriggerProps, useForwardProps } from 'reka-ui';

const props = defineProps<TabsTriggerProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <TabsTrigger
    v-bind="forwardedProps"
    class="sigma-ui-tabs-trigger"
  >
    <slot />
  </TabsTrigger>
</template>

<style>
.sigma-ui-tabs-trigger {
  display: inline-flex;
  height: 100%;
  flex: 1;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 0.875rem;
  font-weight: 500;
  padding-inline: 0.75rem;
  transition-duration: 150ms;
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  white-space: nowrap;
}

.sigma-ui-tabs-trigger:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.sigma-ui-tabs-trigger:disabled {
  opacity: 0.5;
  pointer-events: none;
}

.sigma-ui-tabs-trigger[data-state="active"] {
  background-color: hsl(var(--secondary));
  box-shadow:
    0 1px 3px 0 rgb(0 0 0 / 10%),
    0 1px 2px -1px rgb(0 0 0 / 10%);
  color: hsl(var(--foreground));
}
</style>
