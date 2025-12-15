<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { SelectValue, type SelectValueProps } from 'reka-ui';

const props = defineProps<SelectValueProps>();
</script>

<template>
  <SelectValue v-bind="props">
    <slot />
  </SelectValue>
</template>
