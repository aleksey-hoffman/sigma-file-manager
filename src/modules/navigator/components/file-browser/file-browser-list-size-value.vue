<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
defineProps<{
  display: string | null;
}>();
</script>

<template>
  <span class="file-browser-list-size-value">{{ display }}</span>
</template>

<style scoped>
.file-browser-list-size-value {
  overflow: hidden;
  min-width: 50px;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
