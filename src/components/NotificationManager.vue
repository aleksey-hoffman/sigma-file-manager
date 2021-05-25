<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-layout
      class="notification__container"
      :class="{'notification__container--raised': $store.state.clipboardToolbar}"
      column
    >
      <transition-group name="notification-transition">
        <div
          v-for="notification in notifications"
          :key="'notification' + notification.hashID"
          :data-hashID="notification.hashID"
          class="notification__item"
        >
          <v-progress-linear
            v-show="notification.timeout !== 0"
            :value="notification.timeoutData.percentsCounter"
            color="blue-grey"
            height="2"
          ></v-progress-linear>

          <div
            class="notification__item__content"
            align-center
          >
            <div>
              <div>
                <v-layout>
                  <div v-show="notification.icon" class="notification__item__icon">
                    <v-icon>{{notification.icon}}</v-icon>
                  </div>

                  <div
                    class="notification__item__title notifications__item__content__title-row__title"
                    v-if="notification.title"
                    v-html="notification.title"
                    :colorStatus="notification.colorStatus"
                  ></div>
                  <v-spacer></v-spacer>

                  <!-- button:hide-notification -->
                  <v-tooltip top>
                    <template v-slot:activator="{ on }">
                      <v-btn
                        v-on="on"
                        v-show="notification.closeButton"
                        @click="removeNotification(notification)"
                        icon small
                        color="grey lighten-2"
                      >
                        <div class="notification__item__icon--close">
                          <v-icon>mdi-close</v-icon>
                        </div>
                      </v-btn>
                    </template>
                    <span>Hide notification</span>
                  </v-tooltip>
                </v-layout>
                <div class="notification__item__message" v-html="notification.message"></div>

                <div v-if="notification.type === 'progress:download-file'">
                  <div class="notification__item__progress">
                    <div v-if="notification.progress.filename" class="notification__item__progress__filename">
                      <b>File name:</b>
                      {{notification.progress.filename}}
                    </div>
                    <v-layout class="mb-1">
                      <div
                        v-html="getNotificationProgressContent(notification)"
                        class="notification__item__progress__content"
                      ></div>
                    </v-layout>

                    <v-progress-linear
                      v-show="notification.progress.started && notification.progress.percentDone > 0 && !notification.progress.isDone"
                      :value="notification.progress.percentDone"
                      height="4"
                      :background-color="$utils.getCSSVar('--bg-color-2')"
                      :color="$utils.getCSSVar('--highlight-color-1')"
                    ></v-progress-linear>
                  </div>
                </div>
              </div>

              <div class="notification__actions">
                <v-layout v-show="notification.actionButtons.length !== 0">
                  <v-tooltip
                    v-for="(button, index) in notification.actionButtons"
                    :key="`notification-button-${index}`"
                    :disabled="!(button.extrnalLink || button.tooltip)"
                    bottom
                  >
                    <template v-slot:activator="{ on }">
                      <v-btn
                        class="button-1 mr-3"
                        v-on="on"
                        @click="handleNotificationAction(notification, button)"
                        small depressed
                      >{{button.title}}
                      </v-btn>
                    </template>
                    <span>
                      <div v-show="button.extrnalLink">
                        <div class="tooltip__description">
                          <v-layout align-center>
                            <v-icon class="mr-3" size="16px">
                              mdi-open-in-new
                            </v-icon>
                            {{button.extrnalLink}}
                          </v-layout>
                        </div>
                      </div>
                      <div v-show="button.tooltip">
                        <div class="tooltip__description">
                          {{button.tooltip}}
                        </div>
                      </div>
                    </span>
                  </v-tooltip>
                </v-layout>
              </div>
            </div>
          </div>
        </div>
      </transition-group>
    </v-layout>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
import TimeUtils from '../utils/timeUtils.js'

export default {
  name: 'NotificationManager',
  data () {
    return {
      notifications: []
    }
  },
  mounted () {
    this.$eventHub.$on('notification', payload => {
      this.notification(payload)
    })
  },
  computed: {
    ...mapFields({
      navigationPanelMiniVariant: 'navigationPanel.miniVariant'
    })
  },
  methods: {
    handleNotificationAction (notification, button) {
      if (button.onClick) {
        try {
          button.onClick()
          if (button.closesNotification) {
            this.removeNotification(notification)
          }
        }
        catch (error) {
          throw Error(error)
        }
      }
    },
    notification (options) {
      // TODO: research which method is better
      // Method 1
      // const notification = {
      //   hashID: options.hashID ?? this.$utils.getHash(),
      //   id: this.notifications.length + 1,
      //   action: options.action ?? 'add',
      //   type: options.type ?? '',
      //   title: options.title ?? '',
      //   message: options.message ?? '',
      //   icon: options.icon ?? '',
      //   timeout: options.timeout >= 0 ? options.timeout : 5000,
      //   closeButton: options.closeButton ?? false,
      //   actionButtons: options.actionButtons ?? [],
      //   props: options.props ?? {},
      //   onNotificationRemove: options.onNotificationRemove ?? null
      // }

      // Method 2
      const defaultOptions = {
        hashID: this.$utils.getHash(),
        id: this.notifications.length + 1,
        action: 'add',
        type: '',
        title: '',
        message: '',
        icon: '',
        timeout: 5000,
        closeButton: false,
        isClosed: false,
        actionButtons: [],
        props: {},
        onNotificationRemove: null,
        timeoutData: {
          ongoingTimeout: null,
          secondsCounter: null,
          secondsCounterInterval: null,
          percentsCounter: null,
          percentsCounterInterval: null
        }
      }
      const notification = { ...defaultOptions, ...options }

      // Remove notification
      if (notification.action === 'remove') {
        const notificationOfSpecifiedHash = this.notifications.find(item => item.hashID === notification.hashID)
        this.removeNotification(notificationOfSpecifiedHash)
      }
      // Create notification
      else if (notification.action === 'add') {
        this.addNotification(notification)
      }
      // Update notification
      else if (notification.action.includes('update')) {
        let notificationToUpdate
        if (notification.action === 'update-by-type') {
          notificationToUpdate = this.notifications.find(item => item.type === notification.type)
        }
        else if (notification.action === 'update-by-hash') {
          notificationToUpdate = this.notifications.find(item => item.hashID === notification.hashID)
        }
        this.updateNotification(notificationToUpdate, notification)
      }
    },
    updateNotification (notificationToUpdate, notification) {
      // Add notification, if it doesn't exist
      if (notificationToUpdate === undefined) {
        this.addNotification(notification)
      }
      // Update specified notification, if it exists
      else {
        this.resetTimers(notificationToUpdate)
        for (const [key, value] of Object.entries(notification)) {
          notificationToUpdate[key] = value
        }
        this.scheduleNotificationForRemoval(notificationToUpdate)
      }
    },
    addNotification (notification) {
      this.notifications.unshift(notification)
      this.scheduleNotificationForRemoval(notification)
    },
    removeNotification (notification, event) {
      const notificationContainer = document.querySelector('.notification__container')
      const specifiedNotification = notificationContainer.querySelector(`.notification__item[data-hashID="${notification.hashID}"]`)
      // TODO:
      // - fix the inability to close an "updating" notification.
      //   It gets created on "update" event if it doesn't exist.
      //   Prevent this from happening by adding isClose property
      //   notification.isClosed = true

      this.resetTimers(notification)
      if (['update-by-hash', 'add', 'remove'].includes(notification.action)) {
        const notificationIndex = this.notifications.findIndex(item => item.hashID === notification.hashID)
        this.notifications.splice(notificationIndex, 1)
      }
      else if (notification.action === 'update-by-type') {
        const notificationIndex = this.notifications.findIndex(item => item.type === notification.type)
        this.notifications.splice(notificationIndex, 1)
      }

      try {
        notification.onNotificationRemove()
      }
      catch (error) {}
    },
    resetTimers (notification) {
      try {
        notification.timeoutData.ongoingTimeout.clear()
        clearInterval(notification.timeoutData.secondsCounterInterval)
        clearInterval(notification.timeoutData.percentsCounterInterval)
      }
      catch (error) {}
    },
    scheduleNotificationForRemoval (notification) {
      notification.timeoutData.ongoingTimeout = new TimeUtils()
      if (notification.timeout !== 0) {
        // Set timeout
        notification.timeoutData.ongoingTimeout.timeout(() => {
          this.removeNotification(notification)
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
    },
    getNotificationProgressContent (notification) {
      const {
        started, isDone, percentDone, receivedBytes,
        totalBytes, speed, speedIsCalculated, eta
      } = notification.progress

      const content = []

      // Handle percents < 100
      if (started && percentDone > 0 && !isDone) {
        content.push(`${percentDone}%`)
      }
      // Handle receivedBytes
      if (receivedBytes) {
        const _totalBytes = this.$utils.prettyBytes(totalBytes)
        const _receivedBytes = this.$utils.prettyBytes(receivedBytes)
        content.push(`${_receivedBytes} of ${_totalBytes}`)
      }
      // Handle speed
      if (speed && speedIsCalculated && !isDone) {
        content.push(speed)
      }
      // Handle raw speed
      if (speed && !speedIsCalculated && !isDone) {
        content.push(`${this.$utils.prettyBytes(speed)} / sec`)
      }
      // Handle ETA
      if (eta && !isDone) {
        content.push(`${eta} ETA`)
      }

      return `
        <div>
          ${content.join('<span class="mx-2">•</span>')}
        </div>
      `
    }
  }
}
</script>

<style scoped>
.notification__container {
  position: fixed;
  bottom: 8px;
  right: 16px;
  /* move notifications above v-dialog */
  z-index: 300 !important;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: 400px;
  transition: all 0.5s;
}

.notification__container--raised {
  bottom: 36px !important;
}

.notification__item {
  width: 400px;
  border-radius: 8px;
  background-color: var(--bg-color-1);
  margin-bottom: 8px;
  user-select: none;
  transition: all 0.5s;
  box-shadow: var(--shadow-x4_hover);
  overflow: hidden;

}

.notification__item__content {
  display: grid;
  grid-template-columns: 1fr;
  padding: 12px 16px 4px 16px;
}

.notification__item__icon {
  margin-right: 8px;
}

.notification__item__icon .v-icon,
.notification__item__icon--close .v-icon {
  color: #bdbdbd
}

.notification__item__title {
  font-size: 18px;
  color: #bdbdbd;
}

.notification__item__message {
  font-size: 14px;
  color: #9e9e9e;
}

.notification__item__progress__filename {
  font-size: 14px;
}

.notification__item__progress__content {
  display: grid;
  grid-auto-flow: column;
  column-gap: 12px;
  font-size: 14px;
}

.notification__actions {
  margin-top: 8px;
  margin-bottom: 4px;
}

.notification-transition-enter-active {
  transition: all 0.5s ease;
}

.notification-transition-leave-active {
  transition: all 0.2s ease;
}

.notification-transition-enter {
  transform: translateX(256px);
  opacity: 0;
}

.notification-transition-leave-to {
  opacity: 0;
}
</style>
