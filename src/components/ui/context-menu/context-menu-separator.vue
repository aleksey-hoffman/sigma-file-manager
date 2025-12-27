<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ContextMenuSeparator,
  type ContextMenuSeparatorProps,
} from 'reka-ui';

const props = defineProps<ContextMenuSeparatorProps>();
</script>

<template>
  <ContextMenuSeparator
    v-bind="props"
    class="sigma-ui-context-menu-separator"
  />
</template>

<style>
.sigma-ui-context-menu-separator {
  height: 1px;
  margin: 0.25rem -0.25rem;
  background-color: hsl(var(--border));
}
</style>
