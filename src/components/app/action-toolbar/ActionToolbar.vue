<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
</script>

<template>
  <div class="action-toolbar">
    <slot />
  </div>
</template>

<style>
.action-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  height: var(--action-toolbar-height);
  align-items: center;
  padding: 0 12px;
  background: var(--action-toolbar-bg-color);
}
</style>