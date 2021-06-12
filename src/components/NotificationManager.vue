<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="notification__container"
    :class="{
      'notification__container--raised': $store.state.clipboardToolbar
    }"
  >
    <transition-group name="notification-transition">
      <notification-card
        v-for="notification in nonHiddenNotifications"
        :key="'notification-' + notification.cardHashID"
        :notification="notification"
        :scheduleNotificationForRemoval="scheduleNotificationForRemoval"
        location="screen"
      ></notification-card>
    </transition-group>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
import TimeUtils from '../utils/timeUtils.js'

export default {
  name: 'NotificationManager',
  data() {
    return {
      maxNotificationLimit: 30
    }
  },
  mounted () {
    this.$eventHub.$on('notification', payload => {
      this.initNotification(payload)
    })
  },
  computed: {
    ...mapFields({
      navigationPanelMiniVariant: 'navigationPanel.miniVariant',
      notifications: 'notifications'
    }),
    nonHiddenNotifications () {
       return [
        ...this.notifications.filter(item => !item.isHidden && !item.isPinned),
        ...this.notifications.filter(item => !item.isHidden && item.isPinned),
      ]
    }
  },
  methods: {
    initNotification (params) {
      const defaultParams = {
        hashID: this.$utils.getHash(),
        id: this.notifications.length + 1,
        action: 'add',
        type: '',
        title: '',
        message: '',
        icon: '',
        colorStatus: '',
        timeout: 5000,
        closeButton: false,
        isHidden: false,
        isStatic: true,
        isPinned: false,
        isUpdate: false,
        removeWhenHidden: true,
        actionButtons: [],
        props: {},
        onNotificationHide: null,
        timeoutData: {
          ongoingTimeout: null,
          secondsCounter: null,
          secondsCounterInterval: null,
          percentsCounter: null,
          percentsCounterInterval: null
        }
      }
      const notification = {...defaultParams, ...params}

      if (notification.action === 'hide') {
        this.$store.dispatch('HIDE_NOTIFICATION', this.getRequestedNotification(notification))
      }
      else if (notification.action === 'add') {
        this.addNotification(this.getRequestedNotification(notification))
      }
      else if (notification.action.includes('update')) {
        this.updateNotification(this.getRequestedNotification(notification), notification)
      }
    },
    getRequestedNotification (notification) {
      if (notification.action === 'hide') {
        return this.notifications.find(item => item.hashID === notification.hashID)
      }
      else if (notification.action === 'add') {
        return notification
      }
      else if (notification.action.includes('update')) {
        if (notification.action === 'update-by-type') {
          return this.notifications.find(item => item.type === notification.type)
        }
        else if (notification.action === 'update-by-hash') {
          return this.notifications.find(item => item.hashID === notification.hashID)
        }
      }
    },
    updateNotification (notificationToUpdate, notification) {
      if (notificationToUpdate === undefined) {
        this.addNotification(notification)
      }
      else {
        this.$store.dispatch('RESET_NOTIFICATION_TIMERS', notificationToUpdate)
        this.updateNotificationProperties(notificationToUpdate, notification)
        this.scheduleNotificationForRemoval(notificationToUpdate)
      }
    },
    updateNotificationProperties (notificationToUpdate, notification) {
      for (const [key, value] of Object.entries(notification)) {
        if (key !== 'isHidden' || notification.isStatic) {
          notificationToUpdate[key] = value
        }
      }
    },
    addNotification (notification) {
      notification.cardHashID = this.$utils.getHash()
      this.removeOutdatedNotifications()
      this.notifications.unshift(notification)
      this.scheduleNotificationForRemoval(notification)
    },
    removeOutdatedNotifications () {
      if (this.notifications.length > this.maxNotificationLimit) {
        this.notifications.splice(this.notifications.length - 1, 1)
      }
    },
    scheduleNotificationForRemoval (notification) {
      notification.timeoutData.ongoingTimeout = new TimeUtils()
      if (notification.timeout !== 0) {
        // Set timeout
        notification.timeoutData.ongoingTimeout.timeout(() => {
          this.$store.dispatch('HIDE_NOTIFICATION', notification)
        }, notification.timeout)
        this.initCounterUpdate(notification)
      }
    },
    initCounterUpdate (notification) {
      // Set timeout data immidiatelly
      notification.timeoutData.secondsCounter = Math.round(notification.timeoutData.ongoingTimeout.timeLeft() / 1000)
      notification.timeoutData.percentsCounter = notification.timeoutData.ongoingTimeout.percentsСompleted()

      // Keep updating timeout counter until timeout is finished
      notification.timeoutData.secondsCounterInterval = setInterval(() => {
        notification.timeoutData.secondsCounter = Math.round(notification.timeoutData.ongoingTimeout.timeLeft() / 1000)
        if (notification.timeoutData.secondsCounter <= 0) {
          clearInterval(notification.timeoutData.secondsCounterInterval)
        }
      }, 1000)

      // Get remaining time every 100ms until timeout is finished
      notification.timeoutData.percentsCounterInterval = setInterval(() => {
        const millisecondsLeft = notification.timeoutData.ongoingTimeout.timeLeft()
        notification.timeoutData.percentsCounter = notification.timeoutData.ongoingTimeout.percentsСompleted()
        if (millisecondsLeft <= 0) {
          clearInterval(notification.timeoutData.percentsCounterInterval)
        }
      }, 100)
    }
  }
}
</script>

<style scoped>
.notification__container {
  position: fixed;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex-direction: column;
  width: 400px;
  bottom: 8px;
  right: 16px;
  /* move notifications above v-dialog */
  z-index: 300 !important;
  transition: all 0.5s;
}

.notification__container--raised {
  bottom: 36px;
}

.notification-transition-enter-active {
  transition: all 0.5s ease;
}

.notification-transition-leave-active {
  transition: all 0s ease;
}

.notification-transition-enter,
.notification-transition-leave-to {
  opacity: 0;
  transform: translateX(256px);
}
</style>
