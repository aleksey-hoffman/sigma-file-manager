<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {useRouter} from 'vue-router';
import {useViewsStore} from '@/stores/runtime/views';
import getVar from '@/utils/get-var';

const router = useRouter();
const viewsStore = useViewsStore();
</script>

<template>
  <div class="nav-sidebar">
    <VNavigationDrawer
      rail
      :rail-width="getVar('nav-sidebar-width-value')"
      floating
      permanent
    >
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
    </VNavigationDrawer>
  </div>
</template>

<style>
.nav-sidebar
  .v-navigation-drawer {
    background: var(--nav-sidebar-bg-color);
  }

.nav-sidebar__item {
  display: flex;
  width: auto;
  height: 48px;
  align-items: center;
  justify-content: center;
  background: transparent;
  cursor: pointer;
}

.v-navigation-drawer__content
  .nav-sidebar__item-container
    .nav-sidebar__item:first-child {
      height: var(--action-toolbar-height);
    }

.nav-sidebar__item:hover {
  background: var(--highlight-color-opacity-5);
}

.nav-sidebar__item[is-active="true"] {
  background: var(--highlight-color-opacity-10);
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
  .v-list-item__prepend {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
  }

.nav-sidebar
  .v-list-item__content {
    margin-left: 12px;
  }
</style>