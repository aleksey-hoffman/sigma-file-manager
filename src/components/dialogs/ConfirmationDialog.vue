<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :persistent="true"
    :close-button="{
      onClick: () => onClickCloseButton()
    }"
    :inputs="dialog.data.inputs"
    :action-buttons="dialog.data.buttons"
    :title="dialog.data.title"
    :title-icon="dialog.data.titleIcon"
    :content="dialog.data.content"
    :height="dialog.data.height || 'unset'"
  >
    <template #content>
      <div
        v-if="dialog.data.message"
        v-html="dialog.data.message"
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
    }),
  },
  methods: {
    onClickCloseButton () {
      this.dialog?.data?.closeButton?.onClick?.()
      this.$store.dispatch('closeDialog', {name: 'confirmationDialog'})
    },
  },
}
</script>

<style scoped>

</style>