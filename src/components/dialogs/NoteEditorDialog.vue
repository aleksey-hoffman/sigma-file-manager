<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialogs.noteEditorDialog"
    :retain-focus="!dialogs.imagePickerDialog.value && !dialogs.mathEditorDialog.value"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'noteEditorDialog'}),
    }"
    :title="$t('dialogs.noteEditorDialog.noteEditor')"
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
          :label="$t('dialogs.noteEditorDialog.noteTitle')"
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
                {{protectedNoteIcon}}
              </v-icon>
            </v-btn>
          </template>
          <span>
            <div v-show="noteEditor.openedNote.isProtected">
              <div>{{$t('dialogs.noteEditorDialog.noteProtectionOn')}}</div>
              <div>{{$t('dialogs.noteEditorDialog.noteCannotBeDeletedModified')}}</div>
            </div>
            <div v-show="!noteEditor.openedNote.isProtected">
              <div>{{$t('dialogs.noteEditorDialog.noteProtectionOff')}}</div>
              <div>{{$t('dialogs.noteEditorDialog.noteCanBeDeletedModified')}}</div>
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
              <span>{{$t('dialogs.noteEditorDialog.loadATemplate')}}</span>
            </v-tooltip>
          </template>
          <div class="text--sub-title-1 ma-4 mb-2">
            {{$t('dialogs.noteEditorDialog.options')}}
          </div>
          <v-list width="380px">
            <v-divider />
            <v-list-item two-line>
              <v-switch
                v-model="spellcheck"
                :label="$t('dialogs.noteEditorDialog.spellcheck')"
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
                :label="$t('dialogs.noteEditorDialog.convertMarkdownWhileTyping')"
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
          {{$t('dialogs.noteEditorDialog.structure')}}: {{noteEditor.currentNodePath.join(' / ')}}
        </div>

        <!-- card::action-bar::char counter -->
        <div
          v-if="noteEditor.openedNote.charCount"
          class="mx-1"
        >
          {{$t('dialogs.noteEditorDialog.chars')}}: {{noteEditor.openedNote.charCount}}
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
              {{$t('dialogs.noteEditorDialog.created')}}: {{$utils.formatDateTime(noteEditor.openedNote.dateCreated, 'D MMM YYYY')}}
            </div>
            <div class="mr-3">
              {{$t('dialogs.noteEditorDialog.modified')}}: {{$utils.formatDateTime(noteEditor.openedNote.dateModified, 'D MMM YYYY')}}
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
              {{$t('dialogs.noteEditorDialog.markdownShortcuts')}}
            </div>
            <div>
              {{$t('dialogs.noteEditorDialog.withTheCursorOnANewLineType')}}
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
              {{$t('dialogs.noteEditorDialog.tips')}}
            </div>
            <div
              v-for="(item, index) in noteEditorTips"
              :key="'item-' + index"
              class="my-2"
            >
              <span class="inline-code--light mr-2">
                {{item.shortcut}}
              </span>
              {{item.shortcutDescription}}
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
      dialog: state => state.dialogs.noteEditorDialog,
      noteEditor: state => state.noteEditor,
      markdownShortcuts: state => state.storageData.settings.markdownShortcuts,
    }),
    protectedNoteIcon () {
      return this.noteEditor.openedNote.isProtected
        ? 'mdi-shield-check-outline'
        : 'mdi-shield-alert-outline'
    },
    spellcheck: {
      get () {return this.$store.state.storageData.settings.spellcheck},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.spellcheck',
          value,
        })
      },
    },
    markdownActions () {
      return [
        {action: '#space', description: this.$t('dialogs.noteEditorDialog.1stLevelHeadline')},
        {action: '#(N)space', description: this.$t('dialogs.noteEditorDialog.n1to6LevelHeadline')},
        {action: '```space', description: this.$t('dialogs.noteEditorDialog.multilineCodeBlock')},
        {action: '`space', description: this.$t('dialogs.noteEditorDialog.inlineCodeBlock')},
        {action: '-space', description: this.$t('dialogs.noteEditorDialog.unorderedList')},
        {action: '+space', description: this.$t('dialogs.noteEditorDialog.orderedList')},
        {action: '*space', description: this.$t('dialogs.noteEditorDialog.italicText')},
        {action: '**space', description: this.$t('dialogs.noteEditorDialog.boldText')},
        {action: '~~space', description: this.$t('dialogs.noteEditorDialog.strikethroughText')},
        {action: '__space', description: this.$t('dialogs.noteEditorDialog.underlinedText')},
        {action: '>space', description: this.$t('dialogs.noteEditorDialog.quote')},
        {action: '---space', description: this.$t('dialogs.noteEditorDialog.divider')},
        {action: '[ ]space', description: this.$t('dialogs.noteEditorDialog.uncheckedCheckbox')},
        {action: '[x]space', description: this.$t('dialogs.noteEditorDialog.checkedCheckbox')},
      ]
    },
    noteEditorTips () {
      return [
        {
          shortcut: this.$t('dialogs.noteEditorDialog.rightMouseButton'),
          shortcutDescription: this.$t('dialogs.noteEditorDialog.willSelectTheWordAndShowOptions'),
        },
        {
          shortcut: 'Ctrl + Shift + V',
          shortcutDescription: this.$t('dialogs.noteEditorDialog.pasteCopiedDataWithoutFormatting'),
        },
        {
          shortcut: 'Enter',
          shortcutDescription: this.$t('dialogs.noteEditorDialog.escapeBlockAddNewLine'),
        },
        {
          shortcut: 'Shift + Enter',
          shortcutDescription: this.$t('dialogs.noteEditorDialog.escapeBlock'),
        },
        {
          shortcut: 'ArrowRight',
          shortcutDescription: this.$t('dialogs.noteEditorDialog.escapeBlockWhenEndIsReached'),
        },
      ]
    },
  },
}
</script>

<style>

</style>