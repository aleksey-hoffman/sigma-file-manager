<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { DialogDescription, type DialogDescriptionProps, useForwardProps } from 'reka-ui';

const props = defineProps<DialogDescriptionProps>();

const forwardedProps = useForwardProps(props);
</script>

<template>
  <DialogDescription
    v-bind="forwardedProps"
    class="sigma-ui-dialog-description"
  >
    <slot />
  </DialogDescription>
</template>

<style>
.sigma-ui-dialog-description {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}
</style>
