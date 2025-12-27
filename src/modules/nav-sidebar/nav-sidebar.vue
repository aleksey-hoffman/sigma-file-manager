<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useAppStore } from '@/stores/runtime/app';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

const router = useRouter();
const appStore = useAppStore();
</script>

<template>
  <div class="nav-sidebar">
    <div class="nav-sidebar-header">
      <div class="nav-sidebar-header-logo">
        <img
          src="@/assets/icons/logo-32x32.png"
          width="20"
          height="20"
        >
      </div>
    </div>
    <div class="nav-sidebar-items">
      <Tooltip
        v-for="(item, index) in appStore.pages"
        :key="index"
        :delay-duration="0"
      >
        <TooltipTrigger as-child>
          <Button
            class="nav-sidebar-item"
            size="icon"
            :value="item.name"
            :is-active="item.name === router.currentRoute.value.name"
            @click="router.push({ name: item.name })"
          >
            <component
              :is="item.icon"
              :size="18"
              class="nav-sidebar-item-icon"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {{ item.title }}
        </TooltipContent>
      </Tooltip>
    </div>
  </div>
</template>

<style scoped>
.nav-sidebar {
  width: var(--nav-sidebar-width);
  height: calc(100vh - 12px);
  border-radius: var(--radius-sm);
  margin: 6px;
  background-color: hsl(var(--background-2));
}

.nav-sidebar-header {
  display: flex;
  height: var(--window-toolbar-height);
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  margin-bottom: 12px;
  background-color: hsl(var(--background-2));
}

.nav-sidebar-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px;
  gap: 12px;
}

.nav-sidebar-item {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: transparent;
  cursor: pointer;
}

.nav-sidebar-item:hover {
  background-color: hsl(var(--foreground) / 3%);
}

.nav-sidebar-item[is-active="true"] {
  background-color: hsl(var(--foreground) / 5%);
}

.nav-sidebar-item-icon {
  stroke: hsl(var(--icon));
}

.nav-sidebar-item[is-active="true"] .nav-sidebar-item-icon {
  stroke: hsl(var(--primary));
}
</style>
