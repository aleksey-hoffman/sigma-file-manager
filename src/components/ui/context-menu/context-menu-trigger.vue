<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ContextMenuTrigger, type ContextMenuTriggerProps, useForwardProps } from 'reka-ui';

const props = defineProps<ContextMenuTriggerProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <ContextMenuTrigger
    v-bind="forwardedProps"
    class="sigma-ui-context-menu-trigger"
  >
    <slot />
  </ContextMenuTrigger>
</template>

<style>
.sigma-ui-context-menu-trigger {
  display: contents;
}
</style>
