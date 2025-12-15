<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import LanguageSection from './language.vue';
import WindowScalingSection from './window-scaling.vue';
</script>

<template>
  <div class="settings-view">
    <LanguageSection />
    <WindowScalingSection />
  </div>
</template>

<style scoped>
.settings-view {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
