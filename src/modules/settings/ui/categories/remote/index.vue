<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { resetSettingsItemStaggerIndex } from '@/utils/settings-item-stagger';
import ConnectionsSection from './connections-section.vue';

resetSettingsItemStaggerIndex();
</script>

<template>
  <div class="settings-category-remote">
    <ConnectionsSection />
  </div>
</template>

<style scoped>
.settings-category-remote {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
