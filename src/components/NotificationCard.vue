<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="notification__item"
    @mouseover="pauseNotificationTimer(notification)"
    @mouseleave="resetNotificationTimer(notification)"
    :data-hashID="notification.hashID"
    :data-type="notification.type"
    :is-hidden="notification.isHidden"
  >
    <v-progress-linear
      v-show="notification.timeout !== 0 && !notification.isHidden"
      :value="notification.timeoutData.percentsCounter"
      :color="notification.timeoutProgressColor || 'blue-grey'"
      height="2"
    ></v-progress-linear>

    <div class="notification__item__content">
      <div class="notification__item__content__main">
        <div class="notification__item__content__main__header">
          <div 
            class="notification__item__color-indicator" 
            v-if="notification.colorStatus !== ''"
            :color="notification.colorStatus" 
            size="18px"
          ></div>

          <div 
            class="notification__item__icon"
            v-show="notification.icon" 
          >
            <v-icon size="20px">{{notification.icon}}</v-icon>
          </div>

          <div
            class="notification__item__title"
            v-if="notification.title"
            v-html="notification.title"
            :colorStatus="notification.colorStatus"
          ></div>

          <v-spacer></v-spacer>

          <!-- button:hide-notification -->
          <v-tooltip 
            v-if="!notification.isHidden"
            top
          >
            <template v-slot:activator="{on}">
              <v-btn
                v-on="on"
                v-show="notification.closeButton"
                @click="$store.dispatch('HIDE_NOTIFICATION', notification)"
                icon small
                color="grey"
              >
                <div class="notification__item__icon--close">
                  <v-icon>mdi-close</v-icon>
                </div>
              </v-btn>
            </template>
            <span>Hide notification</span>
          </v-tooltip>
          
          <!-- button:remove-notification -->
          <v-tooltip 
            v-if="notification.isHidden && notification.isStatic"
            top
          >
            <template v-slot:activator="{on}">
              <v-btn
                v-on="on"
                v-show="notification.closeButton"
                @click="$store.dispatch('REMOVE_NOTIFICATION', notification)"
                icon small
                color="grey"
              >
                <div class="notification__item__icon--close">
                  <v-icon>mdi-trash-can-outline</v-icon>
                </div>
              </v-btn>
            </template>
            <span>Remove notification</span>
          </v-tooltip>
        </div>

        <div 
          class="notification__item__message" 
          v-html="notification.message"
        ></div>

        <div v-if="notification.type === 'progress:download-file'">
          <div class="notification__item__progress">
            <div 
              class="notification__item__progress__filename"
              v-if="notification.progress.filename" 
            >
              <b>File name:</b>
              {{notification.progress.filename}}
            </div>
            <v-layout class="mb-1">
              <div
                class="notification__item__progress__content"
                v-html="getNotificationProgressContent(notification)"
              ></div>
            </v-layout>

            <v-progress-linear
              v-show="showProgressBar"
              :value="notification.progress.percentDone"
              height="4"
              :background-color="$utils.getCSSVar('--bg-color-2')"
              :color="$utils.getCSSVar('--highlight-color-1')"
            ></v-progress-linear>
          </div>
        </div>
      </div>

      <div
        class="notification__actions"
        v-show="notification.actionButtons.length !== 0"
      >
        <v-tooltip
          v-for="(button, index) in notification.actionButtons"
          :key="`notification-button-${index}`"
          :disabled="!(button.extrnalLink || button.tooltip)"
          bottom
          offset-overflow
        >
          <template v-slot:activator="{on}">
            <v-btn
              class="button-1 mr-3"
              v-on="on"
              @click="handleNotificationButtonOnClickEvent(notification, button)"
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
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  props: {
    notification: Object,
    location: String,
    scheduleNotificationForRemoval: Function
  },
  computed: {
    ...mapFields({
      notifications: 'notifications'
    }),
    showProgressBar () {
      return this.notification.progress.started && 
        this.notification.progress.percentDone > 0 && 
        !this.notification.progress.isDone
    }
  },
  methods: {
    resetNotificationTimer (notification) {
      if (this.location === 'screen') {
        this.scheduleNotificationForRemoval(notification)
      }
    },
    pauseNotificationTimer (notification) {
      if (this.location === 'screen') {
        this.$store.dispatch('RESET_NOTIFICATION_TIMERS', notification)
        notification.timeoutData.ongoingTimeout.clear()
        clearInterval(notification.timeoutData.secondsCounterInterval)
        clearInterval(notification.timeoutData.percentsCounterInterval)
      }
    },
    handleNotificationButtonOnClickEvent (notification, button) {
      try {
        if (button.onClick) {
          button.onClick()
          if (button.closesNotification) {
            this.$store.dispatch('HIDE_NOTIFICATION', notification)
          }
        }
      }
      catch (error) {
        throw Error(error)
      }
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
        const totalBytesFormatted = this.$utils.prettyBytes(totalBytes)
        const receivedBytesFormatted = this.$utils.prettyBytes(receivedBytes)
        content.push(`${receivedBytesFormatted} of ${totalBytesFormatted}`)
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

<style>
.notification__item {
  user-select: none;
  overflow: hidden;
  width: 400px;
  margin-bottom: 8px;
  border-radius: 8px;
  background-color: var(--bg-color-1);
  transition: all 0.5s;
  box-shadow: var(--shadow-x4_hover);
}

.notification__item[is-hidden] {
  margin-bottom: 0;
  border-radius: 0;
  border-bottom: 1px solid var(--divider-color-1);
  box-shadow: none;
}

.notification__item__content {
  display: grid;
  grid-template-columns: 1fr;
  padding: 12px 16px 0px 16px;
}

.notification__item__content__main__header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.notification__item__color-indicator {
  position: relative;
  height: 6px; 
  width: 6px; 
  margin-right: 10px; 
  border-radius: 50%;
}

.notification__item__color-indicator[color="blue"] {
  background-color: rgb(54, 129, 179);
  box-shadow: 0 0 8px rgb(54, 129, 179);
}

.notification__item__color-indicator[color="green"] {
  background-color: #0e9674;
  box-shadow: 0 0 8px #0e9674;
}

.notification__item__color-indicator[color="red"] {
  background-color: #e53935;
  box-shadow: 0 0 8px #e53935;
}

.notification__item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
}

.notification__item__icon 
  .v-icon,
.notification__item__icon--close 
  .v-icon {
    color: #bdbdbd;
  }

.notification__item__title {
  color: #bdbdbd;
  font-size: 18px;
}

.notification__item__message {
  margin-top: 2px;
  margin-bottom: 8px;
  color: #9e9e9e;
  font-size: 14px;
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
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
</style>
