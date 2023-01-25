<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'mathEditorDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('cancel'),
        onClick: () => $store.dispatch('closeDialog', {name: 'mathEditorDialog'})
      },
      {
        text: dialog.data.type === 'add'
          ? $t('dialogs.mathEditorDialog.addFormula')
          : $t('dialogs.mathEditorDialog.editFormula'),
        onClick: () => dialog.data.addFormula(dialog.data)
      }
    ]"
    :title="`${$t('dialogs.mathEditorDialog.mathEditor')} | ${dialog.data.framework.toUpperCase()}`"
    max-width="50vw"
  >
    <template #content>
      <div>
        {{$t('dialogs.mathEditorDialog.seeDocs')}}:
        <v-btn
          text
          x-small
          class="button-1"
          @click="$utils.openLink('https://katex.org/docs/supported.html')"
        >
          {{$t('dialogs.mathEditorDialog.katex')}}
        </v-btn>
      </div>
      <v-text-field
        v-model="dialog.data.formula"
        :label="`${dialog.data.framework.toUpperCase()} ${$t('dialogs.mathEditorDialog.formula')}`"
        autofocus
        class="mt-4"
        @input="updateMathFormulaPreview()"
      />
      <div class="text--sub-title-1 mt-0 mb-2">
        {{$t('dialogs.mathEditorDialog.preview')}}
      </div>
      <div id="math-formula-preview" />
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'
import katex from 'katex'
import 'katex/dist/katex.min.css'

export default {
  watch: {
    'dialog.value' (value) {
      if (value) {
        setTimeout(() => {
          this.updateMathFormulaPreview()
        }, 250)
      }
    },
  },
  computed: {
    ...mapState({
      dialog: state => state.dialogs.mathEditorDialog,
    }),
  },
  methods: {
    updateMathFormulaPreview () {
      const node = document.querySelector('#math-formula-preview')
      const katexHtml = katex.renderToString(this.dialog.data.formula, {
        throwOnError: false,
      })
      node.innerHTML = katexHtml
    },
  },
}
</script>

<style scoped>

</style>