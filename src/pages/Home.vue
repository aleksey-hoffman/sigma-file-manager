<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {HomeActionToolbar} from '@/components/HomeActionToolbar';
</script>

<template>
  <HomeActionToolbar />
  <div class="home-page">
    {{ $t('pages.home') }}
  </div>
</template>

<style>
.home-page {
  padding: 0 20px;
}
</style>
