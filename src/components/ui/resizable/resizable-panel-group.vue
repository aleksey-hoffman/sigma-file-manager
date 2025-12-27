<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SplitterGroup, type SplitterGroupEmits, type SplitterGroupProps, useForwardPropsEmits } from 'reka-ui';

const props = defineProps<SplitterGroupProps>();
const emits = defineEmits<SplitterGroupEmits>();

const forwarded = useForwardPropsEmits(props, emits);

</script>

<template>
  <SplitterGroup
    v-bind="forwarded"
    class="sigma-ui-resizable-panel-group"
  >
    <slot />
  </SplitterGroup>
</template>

<style>
.sigma-ui-resizable-panel-group {
  display: flex;
  width: 100%;
  height: 100%;
}

.sigma-ui-resizable-panel-group[data-panel-group-direction="vertical"] {
  flex-direction: column;
}
</style>
