<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="dialogs">
    <div v-if="dialog.value">
      <v-dialog
        v-model="dialog.value"
        :max-width="$vuetify.breakpoint.smAndDown ? '95vw' : maxWidth || 500"
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
              <div class="dialog-card__title">
                {{title}}
              </div>
              <!-- dialog::close-button -->
              <v-btn @click="closeButton.onClick()" icon>
                <v-icon>{{closeButton.icon || 'mdi-close'}}</v-icon>
              </v-btn>
            </v-layout>
          </v-card-title>

          <!-- dialog::content-unscrollable -->
          <div v-if="unscrollableContent" class="dialog-card-content-container--unscrollable">
            <slot name="unscrollable-content"></slot>
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
            <slot name="content"></slot>
            <div v-if="inputs">
              <v-text-field
                v-model="input.model"
                v-for="(input, index) in inputs"
                :key="index"
                :disabled="input.disabled"
                text small
              ></v-text-field>
            </div>
          </overlay-scrollbars>

          <!-- dialog::actions -->
          <v-card-actions
            v-if="showActionBar"
            class="dialog-card__actions-container px-4"
          >
            <slot name="actions"></slot>
          </v-card-actions>
          <v-card-actions
            v-if="actionButtons"
            class="dialog-card__actions-container px-4"
          >
            <v-spacer></v-spacer>
            <v-btn
              v-for="(button, index) in actionButtons"
              :key="index"
              :disabled="button.disabled"
              @click="button.onClick()"
              text small
            >{{button.text}}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script>
import { mapState } from 'vuex'
export default {
  props: {
    dialog: Object,
    title: String,
    height: String,
    maxWidth: String,
    fadeMaskBottom: String,
    persistent: Boolean,
    showActionBar: Boolean,
    unscrollableContent: Boolean,
    closeButton: Object,
    actionButtons: Array,
    inputs: Array
  },
  data () {
    return {
    }
  },
  mounted () {
  },
  computed: {
    ...mapState({
      dialogs: state => state.dialogs
    })
  }
}
</script>

<style>
.dialog-card {
}

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

.dialog-card-content-container--unscrollable {
}

.dialog-card-content-container--unscrollable {
  flex: 1 1 auto;
  z-index: 1;
  margin: 0px 24px;
}
</style>
