<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { CollapsibleContent, type CollapsibleContentProps, useForwardProps } from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<CollapsibleContentProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <CollapsibleContent
    v-bind="{ ...forwarded, ...$attrs }"
    class="sigma-ui-collapsible-content"
    :class="$attrs.class"
  >
    <slot />
  </CollapsibleContent>
</template>

<style>
.sigma-ui-collapsible-content {
  overflow: hidden;
}

.sigma-ui-collapsible-content[data-state="open"] {
  animation: sigma-ui-collapsible-down 0.2s ease-out;
}

.sigma-ui-collapsible-content[data-state="closed"] {
  animation: sigma-ui-collapsible-up 0.2s ease-out;
}
</style>
