<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxAnchorProps } from 'reka-ui';
import { ComboboxAnchor, useForwardProps } from 'reka-ui';

const props = defineProps<ComboboxAnchorProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <ComboboxAnchor
    v-bind="{ ...forwarded, ...$attrs }"
    :class="['sigma-ui-combobox-anchor', $attrs.class]"
  >
    <slot />
  </ComboboxAnchor>
</template>

<style>
.sigma-ui-combobox-anchor {
  width: 200px;
}
</style>
