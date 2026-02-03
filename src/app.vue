<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useInit } from './use/init';
import { WindowAppLayout, WindowQuickViewLayout } from '@/layouts';

const route = useRoute();
const { init } = useInit();

const layoutComponent = computed(() => {
  if (route.meta.layout === 'quick-view') {
    return WindowQuickViewLayout;
  }

  return WindowAppLayout;
});

init();
</script>

<template>
  <component :is="layoutComponent" />
</template>

<style>
#app {
  display: flex;
  height: 100vh;
  background-color: hsl(var(--background-3));
}
</style>
