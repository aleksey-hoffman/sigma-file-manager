<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialogs.downloadTypeSelector"
    :close-button="{
      onClick: () => dialogs.downloadTypeSelector.value = false
    }"
    title="Select download type"
    max-width="50vw"
    class="dialog"
  >
    <template #content>
      <div class="dialog__button-container">
        <div
          v-for="(item, index) in buttons"
          :key="'dialog-button-item-' + index"
          class="dialog__button"
          @click="item.onClick()"
        >
          <v-icon size="56">
            {{item.icon}}
          </v-icon>
          <div class="dialog__button-title">
            {{item.title}}
          </div>
        </div>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      dialogs: state => state.dialogs,
    }),
    buttons () {
      return [
        {
          title: 'Download URL page',
          icon: 'mdi-file-document-outline',
          onClick: () => {
            this.dialogs.downloadTypeSelector.data.downloadFileButton()
            this.dialogs.downloadTypeSelector.value = false
          },
        },
        {
          title: 'Download URL image',
          icon: 'mdi-file-image-outline',
          onClick: () => {
            this.dialogs.downloadTypeSelector.data.downloadImageButton()
            this.dialogs.downloadTypeSelector.value = false
          },
        },
      ]
    },
  },
}
</script>

<style scoped>
.dialog__button-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding-bottom: 12px;
}

.dialog__button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  cursor: pointer;
}

.dialog__button:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

#app
  .dialog__button
    .v-icon {
      margin-bottom: 16px;
      opacity: 0.5;
    }
</style>