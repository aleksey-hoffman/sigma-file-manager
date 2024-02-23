<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {useRouter} from 'vue-router';
import {useViewsStore} from '@/stores/runtime/views';

const router = useRouter();
const viewsStore = useViewsStore();
</script>

<template>
  <div class="nav-sidebar">
    <div class="nav-sidebar__item-container">
      <div
        v-for="(item, index) in viewsStore.views"
        :key="index"
        class="nav-sidebar__item"
        :value="item.name"
        :is-active="item.name === router.currentRoute.value.name"
        @click="router.push({ name: item.name })"
      >
        <Icon
          :icon="item.icon"
          width="22"
          class="nav-sidebar__item-icon"
        />
      </div>
    </div>
  </div>
</template>

<style>
.nav-sidebar {
  width: var(--nav-sidebar-width);
  background-color: var(--background-lighten);
}

.nav-sidebar__item {
  display: flex;
  width: auto;
  height: 48px;
  align-items: center;
  justify-content: center;
  background-color: transparent;
  cursor: pointer;
}

.nav-sidebar__item-container
  .nav-sidebar__item:first-child {
    height: var(--action-toolbar-height);
  }

.nav-sidebar__item:hover {
  background-color: hsl(var(--light) / 5%);
}

.nav-sidebar__item[is-active="true"] {
  background-color: hsl(var(--light) / 10%);
}

.nav-sidebar__item-icon {
  width: 24px;
}

.nav-sidebar__item-icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-sidebar
  .nav-sidebar-item__prepend {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }

.nav-sidebar
  .nav-sidebar-item__content {
    margin-left: 12px;
  }
</style>