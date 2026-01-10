<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  Label as LabelRoot,
  type LabelProps,
  useForwardProps,
} from 'reka-ui';

const props = defineProps<LabelProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <LabelRoot
    v-bind="forwarded"
    class="sigma-ui-label"
  >
    <slot />
  </LabelRoot>
</template>

<style>
.sigma-ui-label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  font-weight: 500;
  line-height: 1;
}

.sigma-ui-label[data-disabled] {
  cursor: not-allowed;
  opacity: 0.7;
}
</style>
