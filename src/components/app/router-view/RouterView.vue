<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {RouterView} from 'vue-router';
</script>

<template>
  <div class="router-view">
    <RouterView />
  </div>
</template>

<style>
.router-view {
  width: 100%;
  height: 100%;
}
</style>