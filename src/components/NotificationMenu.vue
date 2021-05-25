<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-if="showNotificationBadge"
    v-model="menus.workspaces.value"
    :menuButton="{
      class: 'window-toolbar__item',
      tooltip: {
        description: 'Notifications',
      }
    }"
    :notificationBadge="{
      value: showNotificationBadge,
      color: 'blue'
    }"
    :header="{
      title: 'Notifications',
      icon: {
        name: `mdi-bell-outline`,
        size: '20px',
        color: iconColor
      },
    }"
  >
    <template v-slot:content>
      <div
        class="notifications__item"
        v-for="(item, index) in notifications"
        :key="'item-' + index"
      >
        <div class="notifications__item__content">
          <div class="notifications__item__content__title-row">
            <div
              class="notifications__item__content__title-row__title"
              v-if="item.title"
              v-html="item.title"
              :colorStatus="item.colorStatus"
            ></div>
          </div>
          <div
            class="notifications__item__content__description-row"
            v-if="item.message"
            v-html="item.message"
          ></div>
        </div>
        <div
          class="notifications__item__actions"
          v-if="item.actionButtons"
        >
          <v-btn
            class="button-1 mr-3"
            v-for="(actionButtonItem, index) in item.actionButtons"
            :key="'item-' + index"
            @click="() => {actionButtonItem.onClick()}"
            x-small
          >
            {{actionButtonItem.title}}
          </v-btn>
        </div>
      </div>
    </template>
  </basic-menu>
</template>

<script>
import { mapFields } from 'vuex-map-fields'

export default {
  props: {
    iconColor: String
  },
  computed: {
    ...mapFields({
      menus: 'menus',
      notifications: 'notifications'
    }),
    showNotificationBadge () {
      return this.notifications.length > 0
    }
  }
}
</script>

<style>
.notifications__item {
  padding: 14px 24px;
  background-color: var(--context-menu-bg-color);
  border-bottom: 1px solid var(--divider-color-1);
}

.notifications__item__content__title-row {
  display: flex;
  align-items: center;
  font-size: 18px;
}

.notifications__item__content__title-row__title[colorStatus="green"]:before {
  content: "";
  top: 0;
  left: 0;
  margin-right: 8px;
  border-left: 3px solid #009688;
}

.notifications__item__content__description-row {
  font-size: 14px;
}

.notifications__item__content
  .v-icon {
    color: var(--icon-color-2) !important;
    margin-right: 12px;
  }

.notifications__item__actions {
  margin-top: 8px;
}
</style>
