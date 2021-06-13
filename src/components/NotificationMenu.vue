<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <basic-menu
    v-if="hiddenNotifications.length > 0"
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
        class="notification__container"
      >
        <notification-card
          v-for="notification in hiddenNotifications"
          :key="'notification-' + notification.cardHashID"
          :notification="notification"
          location="menu"
        ></notification-card>
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
    hiddenNotifications () {
      return [
        ...this.notifications.filter(item => item.isHidden && item.isPinned),
        ...this.notifications.filter(item => item.isHidden && !item.isPinned)
      ]
    },
    showNotificationBadge () {
      return this.notifications.some(item => item.isUpdate)
    }
  }
}
</script>

<style scoped>
.notification__container {
  background-color: var(--bg-color-1);
}
</style>
