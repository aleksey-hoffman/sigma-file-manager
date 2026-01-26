<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area';
</script>

<template>
  <ScrollArea class="home-layout">
    <slot />
  </ScrollArea>
</template>

<style>
.home-layout {
  height: 100vh;
  padding: 0;
  user-select: none;
}
</style>
