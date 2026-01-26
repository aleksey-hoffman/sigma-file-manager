<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ScrollArea } from '@/components/ui/scroll-area';

defineProps<{
  title?: string;
  subtitle?: string;
  maxWidth?: string;
}>();
</script>

<template>
  <ScrollArea class="page-layout">
    <div
      class="page-layout__container"
      :style="{ maxWidth: maxWidth ?? '1200px' }"
    >
      <header
        v-if="title"
        class="page-layout__header"
      >
        <h1 class="page-layout__title">
          {{ title }}
        </h1>
        <p
          v-if="subtitle"
          class="page-layout__subtitle"
        >
          {{ subtitle }}
        </p>
      </header>
      <slot />
    </div>
  </ScrollArea>
</template>

<style>
.page-layout {
  height: calc(100vh - var(--window-toolbar-height));
  user-select: none;
}

.page-layout__container {
  display: flex;
  flex-direction: column;
  padding: 20px 40px;
  padding-right: 46px;
  margin: 0 auto;
  gap: 24px;
}

.page-layout__header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.page-layout__title {
  color: hsl(var(--foreground));
  font-size: 2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.page-layout__subtitle {
  color: hsl(var(--muted-foreground));
  font-size: 0.95rem;
}

@media (width <= 768px) {
  .page-layout__container {
    padding: 24px 16px;
    padding-right: 22px;
  }
}
</style>
