<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :persistent="isPersistent"
    :close-button="{
      onClick: () => closeButtonOnClick()
    }"
    :inputs="dialog.data.inputs"
    :action-buttons="dialog.data.buttons"
    :title="dialog.data.title"
    :title-icon="dialog.data.titleIcon"
    :content="dialog.data.content"
    :height="dialog.data.height || 'unset'"
    :max-width="dialog.data.maxWidth"
  >
    <template #content>
      <div
        v-if="dialog.data.message"
        v-html="dialog.data.message"
      />
      <div
        v-for="(contentItem, index) in dialog.data.content"
        :key="'conformation-dialog-content-' + index"
      >
        <div
          v-if="contentItem.type === 'html'"
          v-html="contentItem.value"
        />

        <div
          v-if="contentItem.type === 'list' && contentItem.value.length < 100"
          class="dialog-card__list"
        >
          <div
            v-for="(listItem, index) in contentItem.value"
            :key="'conformation-dialog-content-listItem' + index"
            class="dialog-card__list-item"
          >
            <div class="dialog-card__list-item-content">
              <template v-if="listItem.title">
                <div class="dialog-card__list-item-title">
                  {{listItem.title}}
                </div>
                <div
                  v-if="listItem.subtitle"
                  class="dialog-card__list-item-subtitle"
                >
                  {{listItem.subtitle}}
                </div>
              </template>
              <div
                v-else
                class="dialog-card__list-item-title"
              >
                {{listItem}}
              </div>
            </div>
            <div class="dialog-card__list-item-actions">
              <v-icon v-if="contentItem.showProtectedIndicator && isProtectedItem(listItem.dirItem)">
                mdi-shield-alert-outline
              </v-icon>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template #footer>
      <div
        v-if="dialog.data.footerText"
        class="dialog-card__footer-text"
        v-html="dialog.data.footerText"
      />
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      dialog: state => state.dialogs.confirmationDialog,
      protectedItems: state => state.storageData.protected.items,
    }),
    isPersistent () {
      return this.dialog?.data?.persistent || false
    },
  },
  methods: {
    closeButtonOnClick () {
      this.dialog?.data?.closeButton?.onClick?.()
      this.$store.dispatch('closeDialog', {name: 'confirmationDialog'})
    },
    isProtectedItem (item) {
      return this.protectedItems.some(protectedItem => protectedItem.path === item.path)
    },
  },
}
</script>

<style scoped>
.dialog-card__footer-text {
  margin-left: 8px;
  font-size: 14px;
}
</style>