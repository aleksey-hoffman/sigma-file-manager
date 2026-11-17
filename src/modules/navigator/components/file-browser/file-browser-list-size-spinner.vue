<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { LoaderCircleIcon } from '@lucide/vue';
</script>

<template>
  <span class="file-browser-list-size-spinner">
    <LoaderCircleIcon :size="12" />
  </span>
</template>

<style scoped>
.file-browser-list-size-spinner {
  display: flex;
  flex-shrink: 0;
  animation: file-browser-list-size-spin 1s linear infinite;
  color: hsl(var(--muted-foreground));
}

@keyframes file-browser-list-size-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
