<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import getVar from '@/utils/get-var';
</script>

<template>
  <VAppBar
    class="action-toolbar"
    flat
    :height="getVar('action-toolbar-height-value')"
  >
    <slot />
  </VAppBar>
</template>

<style>
#app
  .action-toolbar {
    position: relative;
    z-index: 10;
    display: flex;
    min-height: var(--action-toolbar-height);
    align-items: center;
    padding: 0 12px;
    background: var(--action-toolbar-bg-color);
  }
</style>