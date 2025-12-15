<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  DropdownMenuRadioGroup,
  type DropdownMenuRadioGroupEmits,
  type DropdownMenuRadioGroupProps,
  useForwardPropsEmits,
} from 'reka-ui';

const props = defineProps<DropdownMenuRadioGroupProps>();
const emits = defineEmits<DropdownMenuRadioGroupEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <DropdownMenuRadioGroup v-bind="forwarded">
    <slot />
  </DropdownMenuRadioGroup>
</template>
