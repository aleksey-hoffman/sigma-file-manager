<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialogs.noteEditorDialog"
    :retain-focus="!dialogs.imagePickerDialog.value && !dialogs.mathEditorDialog.value"
    :close-button="{
      onClick: () => closeDialog('noteEditorDialog'),
    }"
    title="Note editor"
    :show-action-bar="true"
    :unscrollable-content="true"
    height="85vh"
    max-width="85vw"
  >
    <template #unscrollable-content>
      <div style="height: 100%">
        <v-text-field
          ref="titleField"
          v-model="noteEditor.openedNote.title"
          :disabled="noteEditor.openedNote.isProtected || noteEditor.openedNote.isTrashed"
          autofocus
          hide-details
          label="Note title"
          class="mt-0 mb-2"
        />
        <NoteEditor
          v-model="noteEditor.openedNote.content"
          :read-only="noteEditor.openedNote.isProtected || noteEditor.openedNote.isTrashed"
          :spellcheck="spellcheck"
          :markdown-shortcuts="markdownShortcuts"
          @currentNodePath="noteEditor.currentNodePath = $event"
          @charCount="noteEditor.openedNote.charCount = $event"
        />
      </div>
    </template>
    <template #actions>
      <div style="display: flex; gap: 16px">
        <!-- card::action-bar::lock-button -->
        <v-tooltip top>
          <template #activator="{ on }">
            <v-btn
              icon
              v-on="on"
              @click="$store.dispatch('UPDATE_NOTE_PROPERTY', {
                key: 'isProtected',
                value: !noteEditor.openedNote.isProtected,
                note: noteEditor.openedNote
              })"
            >
              <v-icon size="18px">
                {{noteEditor.openedNote.isProtected
                  ? 'mdi-shield-check-outline'
                  : 'mdi-shield-alert-outline'}}
              </v-icon>
            </v-btn>
          </template>
          <span>
            <div v-show="noteEditor.openedNote.isProtected">
              <div>Note protection: ON</div>
              <div>Note cannot be deleted / modified</div>
            </div>
            <div v-show="!noteEditor.openedNote.isProtected">
              <div>Note protection: OFF</div>
              <div>Note can be deleted / modified</div>
            </div>
          </span>
        </v-tooltip>

        <!-- card::action-bar::option-menu -->
        <v-menu
          offset-y
          top
          :close-on-content-click="false"
        >
          <template #activator="{ on: menu, attrs }">
            <v-tooltip bottom>
              <template #activator="{ on: tooltip }">
                <v-btn
                  v-bind="attrs"
                  tabindex="2"
                  icon
                  :class="{ 'is-active': false }"
                  v-on="{ ...tooltip, ...menu }"
                >
                  <v-icon size="20px">
                    mdi-dots-vertical
                  </v-icon>
                </v-btn>
              </template>
              <span>Load a template</span>
            </v-tooltip>
          </template>
          <div class="text--sub-title-1 ma-4 mb-2">
            Options
          </div>
          <v-list width="380px">
            <v-divider />
            <v-list-item two-line>
              <v-switch
                v-model="spellcheck"
                label="Spellcheck"
                class="my-0"
                hide-details
              />
              <v-spacer />
              <v-list-item-avatar>
                <v-icon>mdi-spellcheck</v-icon>
              </v-list-item-avatar>
            </v-list-item>
            <v-list-item two-line>
              <v-switch
                v-model="markdownShortcuts"
                label="Convert basic markdown syntax into HTML while typing"
                class="my-0"
                hide-details
              />
              <v-spacer />
              <v-list-item-avatar>
                <v-icon>mdi-language-markdown-outline</v-icon>
              </v-list-item-avatar>
            </v-list-item>
          </v-list>
        </v-menu>
      </div>
      <v-spacer />

      <div style="display: flex; gap: 24px">
        <!-- card::action-bar::node-path -->
        <div
          v-if="noteEditor.currentNodePath.length > 0"
          class="mx-1 line-clamp-1"
          style="max-width: 300px"
        >
          Structure: {{noteEditor.currentNodePath.join(' / ')}}
        </div>

        <!-- card::action-bar::char counter -->
        <div
          v-if="noteEditor.openedNote.charCount"
          class="mx-1"
        >
          Chars: {{noteEditor.openedNote.charCount}}
        </div>

        <!-- card::action-bar::dates -->
        <v-tooltip top>
          <template #activator="{ on }">
            <v-icon
              size="20px"
              v-on="on"
            >
              mdi-clock-time-four-outline
            </v-icon>
          </template>
          <span>
            <div class="mr-3">
              Created: {{$utils.formatDateTime(noteEditor.openedNote.dateCreated, 'D MMM YYYY')}}
            </div>
            <div class="mr-3">
              Modified: {{$utils.formatDateTime(noteEditor.openedNote.dateModified, 'D MMM YYYY')}}
            </div>
          </span>
        </v-tooltip>

        <!-- card::action-bar::markdown-tips -->
        <v-tooltip
          top
          max-width="300px"
        >
          <template #activator="{ on }">
            <v-icon
              v-show="markdownShortcuts"
              size="26px"
              v-on="on"
            >
              mdi-language-markdown-outline
            </v-icon>
          </template>
          <span>
            <div class="text--sub-title-1 my-2">
              Markdown shortcuts
            </div>
            <div>
              With the cursor on a new line, type specified sequence to add the corresponding element.
            </div>
            <div
              v-for="(markdownAction, index) in markdownActions"
              :key="index"
              class="my-2"
            >
              <span class="inline-code--light mr-2">
                {{markdownAction.action}}
              </span>
              {{markdownAction.description}}
            </div>
          </span>
        </v-tooltip>

        <!-- card::action-bar::note-editor-tips -->
        <v-tooltip top>
          <template #activator="{ on }">
            <v-icon
              size="20px"
              v-on="on"
            >
              mdi-help-circle-outline
            </v-icon>
          </template>
          <span>
            <div class="text--sub-title-1 my-2">
              Tips
            </div>
            <div class="my-2">
              <span class="inline-code--light mr-2">
                Right mouse button
              </span>
              will select the word and show options
            </div>
            <div class="my-2">
              <span class="inline-code--light mr-2">
                Ctrl + Shift + V
              </span>
              paste copied data without formatting
            </div>
            <div class="my-2">
              <span class="inline-code--light mr-2">
                Enter
              </span>
              escape block; add new line
            </div>
            <div class="my-2">
              <span class="inline-code--light mr-2">
                Shift + Enter
              </span>
              escape block
            </div>
            <div class="my-2">
              <span class="inline-code--light mr-2">
                ArrowRight
              </span>
              escape block (when end is reached)
            </div>
          </span>
        </v-tooltip>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'
import TimeUtils from '@/utils/timeUtils.js'
import NoteEditor from '@/components/NoteEditor/NoteEditor.vue'

export default {
  components: {
    NoteEditor,
  },
  data () {
    return {
      noteChangeHandlerDebounce: null,
      markdownActions: [
        {action: '#space', description: '1st level headline'},
        {action: '#(N)space', description: 'N[1-6] level headline'},
        {action: '```space', description: 'Multiline code block'},
        {action: '`space', description: 'Inline code block'},
        {action: '-space', description: 'Unordered list'},
        {action: '+space', description: 'Ordered list'},
        {action: '*space', description: 'Italic text'},
        {action: '**space', description: 'Bold text'},
        {action: '~~space', description: 'Strikethrough text'},
        {action: '__space', description: 'Underlined text'},
        {action: '>space', description: 'Quote'},
        {action: '---space', description: 'Divider'},
        {action: '[ ]space', description: 'Unchecked checkbox'},
        {action: '[x]space', description: 'Checked checkbox'},
      ],
    }
  },
  watch: {
    'noteEditor.openedNote': {
      handler (newValue, oldValue) {
        // Note: using debounce to reduce the amount of writes
        // to storage (e.g. when a button is held down)
        this.noteChangeHandlerDebounce.throttle(() => {
          this.$store.dispatch(
            'UPDATE_NOTE',
            newValue,
          )
        }, {time: 1000})
      },
      deep: true,
    },
  },
  mounted () {
    this.noteChangeHandlerDebounce = new TimeUtils()
  },
  computed: {
    ...mapState({
      dialogs: state => state.dialogs,
      noteEditor: state => state.noteEditor,
      markdownShortcuts: state => state.storageData.settings.markdownShortcuts,
    }),
    spellcheck: {
      get () {return this.$store.state.storageData.settings.spellcheck},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.spellcheck',
          value,
        })
      },
    },
  },
}
</script>

<style>

</style>