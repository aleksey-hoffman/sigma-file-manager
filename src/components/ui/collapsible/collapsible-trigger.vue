<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { CollapsibleTrigger, type CollapsibleTriggerProps, useForwardProps } from 'reka-ui';

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<CollapsibleTriggerProps>(), {
  asChild: true,
});

const forwarded = useForwardProps(props);
</script>

<template>
  <CollapsibleTrigger
    v-bind="{ ...forwarded, ...$attrs }"
    :class="$attrs.class"
  >
    <slot />
  </CollapsibleTrigger>
</template>
