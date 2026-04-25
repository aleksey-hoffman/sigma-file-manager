<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { TabsContent, type TabsContentProps } from 'reka-ui';

const props = defineProps<TabsContentProps>();
</script>

<template>
  <TabsContent
    v-bind="props"
    class="sigma-ui-tabs-content"
  >
    <slot />
  </TabsContent>
</template>

<style>
.sigma-ui-tabs-content {
  min-width: 0;
  margin-top: 0.75rem;
}

.sigma-ui-tabs-content:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}
</style>
