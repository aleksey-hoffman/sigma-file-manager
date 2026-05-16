<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
withDefaults(defineProps<{
  path: string;
  enabled?: boolean;
}>(), {
  enabled: true,
});
</script>

<template>
  <div
    class="drop-target-card"
    :data-drop-target="enabled || undefined"
    :data-entry-path="enabled ? path : undefined"
  >
    <slot />
  </div>
</template>

<style>
.drop-target-card {
  position: relative;
  border-radius: var(--radius);
  transition: outline-color 0.15s ease, background-color 0.15s ease;
}

.drop-target-card[data-drag-over] {
  background-color: var(--drop-target-subtle-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
}
</style>
