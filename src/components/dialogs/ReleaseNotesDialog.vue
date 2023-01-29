<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :persistent="true"
    :title="$t('dialogs.releaseNotesDialog.releaseNotes')"
    height="80vh"
    max-width="90vw"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'releaseNotesDialog'}),
    }"
  >
    <template #content>
      <div class="text--sub-title-1">
        {{$t('version')}}: {{dialog.data.appVersion}}
      </div>
      <div v-html="dialog.data.html" />
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      appVersion: state => state.appVersion,
      dialog: state => state.dialogs.releaseNotesDialog,
    }),
  },
}
</script>

<style scoped>

</style>