<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  DrivesSection,
  HomeBanner,
  UserDirectoriesSection,
} from '@/modules/home/components';
import { ScrollArea } from '@/components/ui/scroll-area';
</script>

<template>
  <ScrollArea class="home-page">
    <HomeBanner />

    <div class="home-page__content">
      <UserDirectoriesSection />
      <DrivesSection />
    </div>
  </ScrollArea>
</template>

<style>
.home-page {
  height: 100vh;
  padding: 0;
  user-select: none;
}

.home-page__content {
  display: flex;
  flex-direction: column;
  padding: 16px 24px;
  gap: 8px;
}
</style>
