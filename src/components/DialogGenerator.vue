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
              '--fade-mask-bottom': fadeMaskBottom || '10%'
            }"
          >
            <slot name="content" />

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
            class="dialog-card__action-toolbar dialog-card__action-toolbar--transparent px-4"
          >
            <slot name="actions" />
          </v-card-actions>
          <v-card-actions
            v-if="actionButtons"
            class="dialog-card__action-toolbar dialog-card__action-toolbar--transparent px-4"
          >
            <slot name="footer" />
            <v-spacer />
            <AppButton
              v-for="(button, index) in actionButtons"
              :key="index"
              :disabled="button.disabled"
              :shortcut="button.shortcut"
              type="button"
              button-class="text"
              text
              small
              @click="button.onClick()"
            >
              {{button.text}}
            </AppButton>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import AppButton from '@/components/AppButton/AppButton.vue'

const mousetrap = require('mousetrap')

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
  components: {
    AppButton,
  },
  data () {
    return {
      shortcutsTimeout: null,
    }
  },
  watch: {
    'dialog.value' (newValue) {
      if (newValue) {
        this.bindDialogShortcuts()
        this.shortcutsTimeout?.clearTimeout?.()
        this.$store.dispatch('disableShortcuts', ['openSelectedDirItem', 'openSelectedDirectory'])
      }
      else {
        this.shortcutsTimeout?.clearTimeout?.()
        this.shortcutsTimeout = setTimeout(() => {
          if (!this.someDialogIsOpened) {
            this.bindGlobalShortcuts()
            this.$store.dispatch('enableShortcuts', ['openSelectedDirItem', 'openSelectedDirectory'])
          }
        }, 100)
      }
    },
  },
  computed: {
    ...mapFields({
      dialogs: 'dialogs',
    }),
    ...mapGetters([
      'someDialogIsOpened',
    ]),
    dialogShortcuts () {
      const enter = 'enter'
      const shiftEnter = 'shift+enter'
      return [
        {
          shortcut: enter,
          onKeydown: () => this.onDialogShortcutKeydown(enter),
        },
        {
          shortcut: shiftEnter,
          onKeydown: () => this.onDialogShortcutKeydown(shiftEnter),
        },
      ]
    },
  },
  methods: {
    async onDialogShortcutKeydown (shortcut) {
      this.dialog.data.buttons.find(button => button.shortcut === shortcut)?.onClick?.()
    },
    bindGlobalShortcuts () {
      mousetrap.reset()
      this.$eventHub.$emit('app:method', {
        method: 'bindGeneralMousetrapEvents',
      })
    },
    bindDialogShortcuts () {
      mousetrap.reset()
      this.dialogShortcuts.forEach(shortcut => {
        mousetrap.bind(shortcut.shortcut, (event) => {
          shortcut.onKeydown()
        }, 'keydown')
      })
    },
  },
}
</script>

<style>
.dialog-card__action-toolbar {
  width: 100%;
  background-color: var(--key-color-1-translucent);
}

@media all and (width <= 700px) {
  .dialog-card__action-toolbar {
    display: block;
  }
}

.dialog-card__action-toolbar--transparent {
  background-color: transparent;
}

.dialog-card__action-toolbar
  .v-btn {
    color: var(--color-4) !important;
    margin-left: 4px;
  }

.dialog-card__action-toolbar
  .v-btn.v-btn--disabled.v-btn--flat.v-btn--text {
    color: var(--color-5) !important;
  }

.dialog--note-editor
  .dialog-card__action-toolbar {
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
  margin: 12px 0;
  border-radius: 4px;
}

.dialog-card__list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 2px 0;
  padding: 6px 10px;
  background-color: var(--highlight-color-4);
  border-radius: 4px;
}

.dialog-card__list-item-title {
  color: var(--color-5);
  font-size: 14px;
}

.dialog-card__list-item-subtitle {
  color: var(--color-6);
  font-size: 10px;
}

.dialog-card-content-container--unscrollable {
  flex: 1 1 auto;
  z-index: 1;
  margin: 0px 24px;
}
</style>