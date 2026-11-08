<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
withDefaults(defineProps<{
  size?: number;
}>(), {
  size: 24,
});
</script>

<template>
  <span
    class="navigator-item-icon-placeholder"
    aria-hidden="true"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>

<style scoped>
.navigator-item-icon-placeholder {
  display: inline-block;
  flex-shrink: 0;
}
</style>
