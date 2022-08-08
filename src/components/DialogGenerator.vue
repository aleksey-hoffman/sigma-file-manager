<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="dialogs">
    <div v-if="dialog.value">
      <v-dialog
        v-model="dialog.value"
        :max-width="$vuetify.breakpoint.smAndDown ? '95vw' : maxWidth || 600"
        :persistent="persistent || false"
        :retain-focus="false"
      >
        <v-card
          class="dialog-card sticky-scroller__container"
          :style="{
            // Note: height is required for the scrollable container to work
            'height': height
          }"
        >
          <v-card-title class="sticky-scroller__header unselectable">
            <v-layout justify-space-between>
              <!-- dialog::title -->
              <v-layout align-center>
                <v-icon
                  v-if="titleIcon"
                  class="mr-2"
                >
                  {{titleIcon}}
                </v-icon>
                <div class="dialog-card__title">
                  {{title}}
                </div>
                <slot name="title" />
              </v-layout>
              <!-- dialog::close-button -->
              <v-btn
                icon
                @click="closeButton.onClick()"
              >
                <v-icon>{{closeButton.icon || 'mdi-close'}}</v-icon>
              </v-btn>
            </v-layout>
          </v-card-title>

          <!-- dialog::content-unscrollable -->
          <div
            v-if="unscrollableContent"
            class="dialog-card-content-container--unscrollable"
          >
            <slot name="unscrollable-content" />
          </div>

          <!-- dialog::content -->
          <overlay-scrollbars
            :options="{
              className: 'os-theme-minimal-light',
              scrollbars: { autoHide: 'move' }
            }"
            class="sticky-scroller__content fade-mask--bottom px-6 pb-4"
            :style="{
              '--fade-mask-bottom': fadeMaskBottom || '15%'
            }"
          >
            <slot name="content" />

            <div
              v-for="(contentItem, index) in content"
              :key="'conformation-dialog-content-' + index"
            >
              <div
                v-if="contentItem.type === 'html'"
                v-html="contentItem.value"
              />

              <div
                v-if="contentItem.type === 'list'"
                class="dialog-card__list"
              >
                <div
                  v-for="(listItem, index) in contentItem.value"
                  :key="'conformation-dialog-content-listItem' + index"
                >
                  {{listItem}}
                </div>
              </div>
            </div>

            <div v-if="inputs">
              <v-text-field
                v-for="(input, index) in inputs"
                :key="index"
                v-model="input.model"
                :disabled="input.disabled"
                text
                small
              />
            </div>
          </overlay-scrollbars>

          <!-- dialog::actions -->
          <v-card-actions
            v-if="showActionBar"
            class="dialog-card__actions-container px-4"
          >
            <slot name="actions" />
          </v-card-actions>
          <v-card-actions
            v-if="actionButtons"
            class="dialog-card__actions-container px-4"
          >
            <v-spacer />
            <v-btn
              v-for="(button, index) in actionButtons"
              :key="index"
              :disabled="button.disabled"
              text
              small
              @click="button.onClick()"
            >
              {{button.text}}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script>
import {mapState} from 'vuex'

export default {
  props: {
    dialog: Object,
    title: String,
    titleIcon: String,
    height: String,
    maxWidth: String,
    fadeMaskBottom: String,
    persistent: Boolean,
    showActionBar: Boolean,
    unscrollableContent: Boolean,
    content: Array,
    closeButton: Object,
    actionButtons: Array,
    inputs: Array,
  },
  computed: {
    ...mapState({
      dialogs: state => state.dialogs,
    }),
  },
}
</script>

<style>
.dialog-card__actions-container {
  /* background-color: var(--bg-color-1); */
  background-color: rgb(96, 125, 139, 0.2);
  /* Note:
    Prevent contenteditable being overlapped by action toolbar */
  z-index: 2;
  width: 100%;
}

.dialog-card__actions-container
  .v-btn {
    color: var(--color-4) !important;
  }

.dialog-card__actions-container
  .v-btn.v-btn--disabled.v-btn--flat.v-btn--text {
    color: var(--color-5) !important;
  }

.dialog--note-editor
  .dialog-card__actions-container {
    height: 36px !important;
  }

.sticky-scroller__container {
  /* height: 50vh; */
  /* min-height: 50vh; */
  overflow: hidden;
  display: flex !important;
  flex-direction: column;
}

.sticky-scroller__header,
.sticky-scroller__footer {
  flex: 0 0 auto;
}

.sticky-scroller__content {
  flex: 1 1 auto;
  overflow-y: scroll;
}

.dialog-card__list {
  background-color: var(--highlight-color-4);
  margin: 12px 0;
  padding: 8px 12px;
  border-radius: 4px;
}

.dialog-card-content-container--unscrollable {
  flex: 1 1 auto;
  z-index: 1;
  margin: 0px 24px;
}
</style>
