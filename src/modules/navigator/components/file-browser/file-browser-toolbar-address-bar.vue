<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import AddressBar from './address-bar.vue';

defineProps<{
  currentPath: string;
}>();

const emit = defineEmits<{
  (event: 'navigate', path: string): void;
}>();
</script>

<template>
  <AddressBar
    :current-path="currentPath"
    class="file-browser-toolbar-address-bar"
    @navigate="emit('navigate', $event)"
  />
</template>

<style scoped>
.file-browser-toolbar-address-bar {
  min-width: 0;
  flex: 1;
}
</style>
