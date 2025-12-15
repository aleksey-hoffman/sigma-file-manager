<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { ComboboxTriggerProps } from 'reka-ui';
import { ComboboxTrigger, useForwardProps } from 'reka-ui';

const props = defineProps<ComboboxTriggerProps>();

const forwarded = useForwardProps(props);
</script>

<template>
  <ComboboxTrigger
    v-bind="{ ...forwarded, ...$attrs }"
    :class="[$attrs.class]"
    tabindex="0"
  >
    <slot />
  </ComboboxTrigger>
</template>
