<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<!--
NOTES:
- HISTORY STACK:
  Problem: The default history handler (undo / redo) breaks on certain manipulations with DOM, so don't use it.
  Fix: Implemented a custom one. Gets triggered with UI undo / redo buttons and keyboard undo / redo shortcuts.
-->
<template>
  <div
    id="note-editor"
    class="note-editor"
  >
    <v-menu
      v-model="noteEditorContextMenu"
      :position-x="noteEditorContextMenuX"
      :position-y="noteEditorContextMenuY"
      absolute
      offset-y
      class="z-index--top-level"
    >
      <v-list dense>
        <v-list-item @click="noteEditorOpenExternalLink('google')">
          <v-list-item-action>
            <v-icon color="primary-lighten-2">
              mdi-magnify
            </v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{$t('notes.noteEditor.searchSelectionInGoogle')}}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item @click="noteEditorOpenExternalLink('duckduckgo')">
          <v-list-item-action>
            <v-icon color="primary-lighten-2">
              mdi-magnify
            </v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{$t('notes.noteEditor.searchSelectionInDuckDuckGo')}}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item @click="textTransform('uppercase')">
          <v-list-item-action>
            <v-icon color="primary-lighten-2">
              mdi-format-textbox
            </v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{$t('notes.noteEditor.transformSelectionUppercase')}}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
        <v-list-item @click="textTransform('lowercase')">
          <v-list-item-action>
            <v-icon color="primary-lighten-2">
              mdi-format-textbox
            </v-icon>
          </v-list-item-action>
          <v-list-item-content>
            <v-list-item-title>{{$t('notes.noteEditor.transformSelectionLowercase')}}</v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
    </v-menu>

    <template v-if="!readOnly">
      <div
        class="note-editor__toolbar py-1 px-0"
      >
        <div class="note-editor__toolbar-group">
          <!-- TODO: finish in v1.2.0 -->
          <!--
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                v-on="on"
                tabindex="2"
                x-small text
                class="menubar__button"
                :class="{ 'is-active': false }"
                @click="printNote()"
              >
                <v-icon size="18px">mdi-printer</v-icon>
              </v-btn>
            </template>
            <span>Print note</span>
          </v-tooltip> -->

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': showSourceCode }"
                v-on="on"
                @click="showSourceCode = !showSourceCode"
              >
                <v-icon size="18px">
                  mdi-xml
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.showNoteSourceCode')}}</span>
          </v-tooltip>
        </div>

        <div class="note-editor__toolbar-group">
          <v-menu
            offset-y
            max-width="400px"
          >
            <template #activator="{on: menu, attrs}">
              <v-tooltip bottom>
                <template #activator="{on: tooltip}">
                  <v-btn
                    v-bind="attrs"
                    tabindex="2"
                    x-small
                    text
                    class="menubar__button"
                    :class="{ 'is-active': false }"
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon size="18px">
                      mdi-clipboard-check-multiple-outline
                    </v-icon>
                  </v-btn>
                </template>
                <span>{{$t('notes.noteEditor.loadTemplate')}}</span>
              </v-tooltip>
            </template>
            <v-list>
              <v-list-item
                v-for="(template, index) in templates"
                :key="index"
                @click="loadTemplate(template)"
              >
                <v-list-item-title>{{template.title}}</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>

          <v-tooltip bottom>
            <template #activator="{on: tooltip}">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': false }"
                v-on="tooltip"
              >
                <v-icon size="18px">
                  mdi-clipboard-plus-outline
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.saveTemplate')}}</span>
          </v-tooltip>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': false }"
            :disabled="!historyParams.undoAvailable"
            @click="loadHistory('backward')"
          >
            <v-icon size="18px">
              mdi-undo
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': false }"
            :disabled="!historyParams.redoAvailable"
            @click="loadHistory('forward')"
          >
            <v-icon size="18px">
              mdi-redo
            </v-icon>
          </v-btn>

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': false }"
                v-on="on"
                @click="command('removeFormat')"
              >
                <v-icon size="18px">
                  mdi-cancel
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.removeFormattingFromSelection')}}</span>
          </v-tooltip>

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': false }"
                v-on="on"
                @click="minimizeStructure()"
              >
                <v-icon size="18px">
                  mdi-close
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.removeAllEditingFromSelection')}}</span>
          </v-tooltip>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('P') }"
            @click="customCommand('toggle', 'P')"
          >
            <v-icon size="18px">
              mdi-format-pilcrow
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('H1') }"
            @click="customCommand('toggle', 'H1')"
          >
            <v-icon size="18px">
              mdi-format-header-1
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('H2') }"
            @click="customCommand('toggle', 'H2')"
          >
            <v-icon size="18px">
              mdi-format-header-2
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('H3') }"
            @click="customCommand('toggle', 'H3')"
          >
            <v-icon size="18px">
              mdi-format-header-3
            </v-icon>
          </v-btn>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('B') }"
            @click="command('bold')"
          >
            <v-icon size="18px">
              mdi-format-bold
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('I') }"
            @click="command('italic')"
          >
            <v-icon size="18px">
              mdi-format-italic
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('STRIKE') }"
            @click="command('strikeThrough')"
          >
            <v-icon size="18px">
              mdi-format-strikethrough
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('U') }"
            @click="command('underline')"
          >
            <v-icon size="18px">
              mdi-format-underline
            </v-icon>
          </v-btn>
        </div>

        <div class="note-editor__toolbar-group">
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': isActive('SUP') }"
                v-on="on"
                @click="command('superscript')"
              >
                <v-icon size="18px">
                  mdi-format-superscript
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.turnSelectionIntoSuperscript')}}</span>
          </v-tooltip>

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': isActive('SUB') }"
                v-on="on"
                @click="command('subscript')"
              >
                <v-icon size="18px">
                  mdi-format-subscript
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.turnSelectionIntoSubscript')}}</span>
          </v-tooltip>
        </div>

        <div class="note-editor__toolbar-group">
          <v-menu offset-y>
            <template #activator="{ on: menu, attrs }">
              <v-tooltip bottom>
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-bind="attrs"
                    tabindex="2"
                    x-small
                    text
                    class="menubar__button"
                    :class="{ 'is-active': isActive('color') }"
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon size="18px">
                      mdi-format-text-variant-outline
                    </v-icon>
                  </v-btn>
                </template>
                <span>{{$t('notes.noteEditor.textColor')}}</span>
              </v-tooltip>
            </template>
            <div>
              <v-layout
                v-for="(colorGroup, index) in colors"
                :key="'text-color-palette-group' + index"
              >
                <button
                  v-for="(color) in colorGroup"
                  :key="'text-color-palette-color-' + color"
                  :style="{
                    'background-color': color,
                    'width': '16px',
                    'height': '16px',
                    'cursor': 'pointer'
                  }"
                  @click.prevent="command('foreColor', color)"
                />
              </v-layout>
            </div>
          </v-menu>

          <v-menu offset-y>
            <template #activator="{ on: menu, attrs }">
              <v-tooltip bottom>
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-bind="attrs"
                    tabindex="2"
                    x-small
                    text
                    class="menubar__button"
                    :class="{ 'is-active': isActive('highlight') }"
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon size="18px">
                      mdi-format-color-highlight
                    </v-icon>
                  </v-btn>
                </template>
                <span>{{$t('notes.noteEditor.textHighlighting')}}</span>
              </v-tooltip>
            </template>
            <div>
              <v-layout
                v-for="(colorGroup, index) in colors"
                :key="'highlight-color-group' + index"
              >
                <button
                  v-for="(color) in colorGroup"
                  :key="'highlight-color-palette-color-' + color"
                  :style="{
                    'background-color': color,
                    'width': '16px',
                    'height': '16px',
                    'cursor': 'pointer'
                  }"
                  @click.prevent="highlightNode(color)"
                />
              </v-layout>
            </div>
          </v-menu>

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': false }"
                v-on="on"
                @click="customCommand('insertHTML', 'divider')"
              >
                <v-icon size="18px">
                  mdi-minus
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteEditor.insertDivider')}}</span>
          </v-tooltip>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': currentNodePath.includes('CODE') }"
            @click="customCommand('wrap', 'code')"
          >
            <v-icon size="18px">
              mdi-code-tags
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': currentNodePath.includes('PRE') }"
            @click="wrapWith('pre')"
          >
            <v-icon size="18px">
              mdi-code-braces
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('unorderedList') }"
            @click="command('insertUnorderedList')"
          >
            <v-icon size="18px">
              mdi-order-bool-descending
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('orderedList') }"
            @click="command('insertOrderedList')"
          >
            <v-icon size="18px">
              mdi-order-numeric-ascending
            </v-icon>
          </v-btn>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': selection.nodeTag === 'BLOCKQUOTE' }"
            @click="customCommand('toggle', 'BLOCKQUOTE')"
          >
            <v-icon size="18px">
              mdi-format-quote-open
            </v-icon>
          </v-btn>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': false }"
            @click="command('justifyLeft')"
          >
            <v-icon size="18px">
              mdi-format-align-left
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': false }"
            @click="command('justifyCenter')"
          >
            <v-icon size="18px">
              mdi-format-align-center
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': false }"
            @click="command('justifyRight')"
          >
            <v-icon size="18px">
              mdi-format-align-right
            </v-icon>
          </v-btn>
        </div>

        <div class="note-editor__toolbar-group">
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': false }"
                v-on="on"
                @click="outdentNode()"
              >
                <v-icon size="18px">
                  mdi-format-indent-decrease
                </v-icon>
              </v-btn>
            </template>
            <span>
              {{$t('notes.noteEditor.decreaseIndentation')}}
              <div>Ctrl + [</div>
            </span>
          </v-tooltip>

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                tabindex="2"
                x-small
                text
                class="menubar__button"
                :class="{ 'is-active': false }"
                v-on="on"
                @click="indentNode()"
              >
                <v-icon size="18px">
                  mdi-format-indent-increase
                </v-icon>
              </v-btn>
            </template>
            <span>
              {{$t('notes.noteEditor.increaseIndentation')}}
              <div>Ctrl + ]</div>
            </span>
          </v-tooltip>
        </div>

        <div class="note-editor__toolbar-group">
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('image') }"
            @click="addImage()"
          >
            <v-icon size="18px">
              mdi-image
            </v-icon>
          </v-btn>

          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': isActive('checkbox') }"
            @click="customCommand('insertHTML', 'checkbox')"
          >
            <v-icon size="18px">
              mdi-checkbox-outline
            </v-icon>
          </v-btn>

          <!-- TODO: finish in v1.2.0 -->
          <!--
          <v-tooltip bottom>
            <template v-slot:activator="{ on }">
              <v-btn
                v-on="on"
                tabindex="2"
                x-small text
                class="menubar__button"
                :class="{ 'is-active': selection.nodeTag === 'A' }"
                @click=""
              ><v-icon size="18px">mdi-link-variant</v-icon>
              </v-btn>
            </template>
            <span>Link</span>
          </v-tooltip> -->

          <v-menu offset-y>
            <template #activator="{ on: menu, attrs }">
              <v-tooltip
                bottom
                :disabled="attrs['aria-expanded'] === 'true'"
              >
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-bind="attrs"
                    tabindex="2"
                    x-small
                    text
                    class="menubar__button"
                    :class="{ 'is-active': isActive('math:katex') }"
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon size="18px">
                      mdi-sigma
                    </v-icon>
                  </v-btn>
                </template>
                <span>{{$t('notes.noteEditor.math')}}</span>
              </v-tooltip>
            </template>
            <v-list>
              <v-list-item
                v-for="(framework, index) in mathFrameworks"
                :key="index"
                @click="framework.onClick()"
              >
                <v-list-item-title>
                  {{framework.title === 'Katex' && selection.mathKatexNode === null
                    ? $t('add')
                    : $t('edit')}}
                  {{framework.title}}
                  {{$t('notes.noteEditor.formula')}}
                </v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>

        <!-- TODO: finish in v1.1.0 -->
        <div
          v-if="false"
          class="note-editor__toolbar-group"
        >
          <v-btn
            tabindex="2"
            x-small
            text
            class="menubar__button"
            :class="{ 'is-active': false }"
          >
            <v-icon size="20px">
              mdi-table
            </v-icon>
          </v-btn>

          <span v-if="isActive('table')">
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="deleteTable()"
            ><v-icon size="18px">mdi-table-remove</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="addColumnBefore()"
            ><v-icon size="18px">mdi-table-column-plus-after</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="addColumnAfter()"
            ><v-icon size="18px">mdi-table-column-plus-before</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="deleteColumn()"
            ><v-icon size="18px">mdi-table-column-remove</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="addRowBefore()"
            ><v-icon size="18px">mdi-table-row-plus-after</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="addRowAfter()"
            ><v-icon size="18px">mdi-table-row-plus-before</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="deleteRow()"
            ><v-icon size="18px">mdi-table-row-remove</v-icon>
            </v-btn>
            <v-btn
              tabindex="2"
              x-small
              text
              class="menubar__button"
              @click="toggleCellMerge()"
            ><v-icon size="18px">mdi-table-merge-cells</v-icon>
            </v-btn>
          </span>
        </div>
      </div>
      <v-divider class="divider-color-2 mt-1" />
    </template>

    <overlay-scrollbars
      :options="{
        className: 'os-theme-minimal-light',
        scrollbars: { autoHide: 'move' }
      }"
      class="sticky-scroller__condtent note-editor__content-container"
    >
      <span @click.right.exact="showNoteEditorContextMenu">
        <div
          v-show="showSourceCode"
          class="note-editor__source-code-container"
        >
          <div class="text--sub-title-1">{{$t('notes.noteEditor.noteSourceCode')}}</div>
          <pre>{{htmlNodeToMultilineString(value)}}</pre>
        </div>
        <div
          id="note-editor__content"
          contenteditable="true"
          tabindex="0"
          class="note-editor__content"
          :spellcheck="spellcheck"
          :isEmpty="isEmpty"
          :isReadOnly="readOnly"
          @focus="editorFocusHandler"
          @input="editorInputHandler"
          @keydown="editorKeydownHandler"
          @click="editorMouse1DownHandler"
        />
      </span>
    </overlay-scrollbars>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {colors} from '@/utils/colors.js'
import Filehasher from '@/utils/fileHasher.js'
import TimeUtils from '@/utils/timeUtils.js'
import katex from 'katex'
import 'katex/dist/katex.min.css'

const {ipcRenderer} = require('electron')
const fs = require('fs')
const PATH = require('path')

export default {
  props: ['value', 'readOnly', 'spellcheck', 'markdownShortcuts'],
  data () {
    return {
      colors: colors,
      history: [],
      historyParams: {
        currentIndex: null,
        maxItemsAmount: 1000,
        maxSizeInBytes: 50 * 1024 * 1024,
        undoAvailable: false,
        redoAvailable: false,
      },
      lastAction: null,
      historyUpdateIsPaused: false,
      historySetThrottle: null,
      showSourceCode: false,
      content: '',
      newLineTag: 'p',
      newLine: '<p><br></p>',
      closureTags: ['SUP', 'SUB', 'CODE', 'PRE', 'BLOCKQUOTE', 'B', 'I', 'U', 'STRIKE'],
      editor: null,
      editorMutationObserver: null,
      selection: {
        node: null,
        parentNode: null,
        nodeTag: null,
        nodeEndOffset: null,
        nodeStructure: [],
        parentNodeStructure: [],
        cursorIsAtNodeEnd: false,
        isAtRoot: false,
        isEnclosed: false,
        mathKatexNode: false,
        cursorIsInEditor: false,
      },
      currentNode: null,
      currentNodePath: [],
      charCount: null,
      editorChange: false,
      noteEditorContextMenu: false,
      noteEditorContextMenuX: null,
      noteEditorContextMenuY: null,
      highlightOpacityPerc: 50,
      fonts: [],
      templates: [
        {
          title: 'template 1',
          content: '<strong>Template 1 content:</strong> test',
        },
        {
          title: 'template 2',
          content: '2',
        },
      ],
      mathFrameworks: [
        {
          title: 'Katex',
          onClick: () => this.addMathFormula('katex'),
        },
      ],
    }
  },
  watch: {
    spellcheck () {
      // Refresh input element to reset spellcheck underline
      const temp = this.editor.innerHTML
      this.editor.innerHTML = ''
      this.editor.innerHTML = temp
    },
    readOnly () {
      this.setEditableState()
    },
    value (value) {
      this.editorChangeHandler(value)
    },
    charCount (value) {
      this.$emit('charCount', this.charCount)
    },
    currentNodePath (value) {
      this.$emit('currentNodePath', this.currentNodePath)
    },
  },
  mounted () {
    this.historySetThrottle = new TimeUtils()
    document.onselectionchange = (event) => {
      const isContenteditable = document.activeElement.attributes.contenteditable !== undefined
      if (isContenteditable) {
        const node = window.getSelection().anchorNode
        this.selection.nodeTag = node.parentNode.tagName
        if (node.id !== 'note-editor__content') {
          this.currentNode = node.parentNode
        }
        this.selection.cursorIsInEditor = event.target.activeElement.id === 'note-editor__content'
        this.currentNodePath = this.getNodePath()
      }
    }

    this.initEditor()
    this.initMutationObserver()
    this.setEditableState()
    this.setContent()
    this.updateCharCounter()
    this.handleEmptyEditor()
  },
  beforeDestroy () {
    try {
      this.editor.destroy()
    }
    catch (error) {}
  },
  computed: {
    ...mapFields({
      appPaths: 'storageData.settings.appPaths',
      dialogs: 'dialogs',
    }),
    isEmpty () {
      return this.charCount === null || this.charCount === 0
    },
  },
  methods: {
    initMutationObserver () {
      const config = {
        attributes: true,
        childList: true,
        subtree: true,
      }
      this.editorMutationObserver = new MutationObserver(this.editorMutationObserverHandler)
      this.editorMutationObserver.observe(this.editor, config)
    },
    editorMutationObserverHandler (mutationsList, observer) {
      for (const mutation of mutationsList) {
        this.updateEditor()
      }
    },
    isActive (name) {
      if (this.selection.node === null) {
        return false
      }

      if (name === 'orderedList') {
        return this.currentNodePath.includes('OL') &&
               this.currentNodePath.includes('LI')
      }
      else if (name === 'unorderedList') {
        return this.currentNodePath.includes('UL') &&
               this.currentNodePath.includes('LI')
      }
      else if (name === 'image') {
        let someNodeIsImage = false
        this.selection.nodeStructure.forEach(node => {
          if (node?.nodeName === 'IMG') {
            someNodeIsImage = true
          }
        })
        this.selection.parentNodeStructure.forEach(node => {
          if (node?.nodeName === 'IMG') {
            someNodeIsImage = true
          }
        })
        return someNodeIsImage
      }
      else if (name === 'checkbox') {
        let someNodeIsCheckbox = false
        this.selection.nodeStructure.forEach(node => {
          if (node?.attributes?.type?.value === 'checkbox') {
            someNodeIsCheckbox = true
          }
        })
        this.selection.parentNodeStructure.forEach(node => {
          if (node?.attributes?.type?.value === 'checkbox') {
            someNodeIsCheckbox = true
          }
        })
        return someNodeIsCheckbox
      }
      else if (name === 'color') {
        return this?.selection?.node?.parentNode?.nodeName === 'FONT'
      }
      else if (name === 'highlight') {
        return this?.selection?.node?.parentNode?.dataset?.customHighlight
      }
      else if (name === 'math:katex') {
        return this.selection.mathKatexNode
      }
      else {
        return this.currentNodePath.includes(name)
      }
    },
    replaceTag (element, newElementName) {
      const newElement = document.createElement(newElementName)
      newElement.innerHTML = element.innerHTML
      element.parentNode.replaceChild(newElement, element)
    },
    minimizeStructure (element, newElementName) {
      const selection = window.getSelection()
      const node = selection.anchorNode
      const nodeStructure = this.getNodeStructure(node)
      nodeStructure[0].innerHTML = node.textContent
      // nodeStructure.forEach((childNode, index) => {
      //   if (index > 0) {
      //     // Remove all child nodes
      //     childNode.childNodes.forEach(subChildNode => {
      //     })
      //   }
      // })
      this.command('formatBlock', this.newLineTag)
      this.updateEditor()
    },
    // TODO:
    // When you create a note immidiatelly after the app starts,
    // This function throws the following error because the
    // value (v-model) from the Dialogs.vue is not passed yet at that moment:
    // Error in render: "TypeError: Cannot read property 'trim' of undefined"
    htmlNodeToMultilineString (string) {
      const div = document.createElement('div')
      div.innerHTML = string.trim()
      return this.formatString(div, 0).innerHTML.replace(/\n/, '')
    },
    outdentNode () {
      // Remove tab from node, skip if it's the editor root
      if (this.selection.node.parentNode.id !== 'note-editor__content') {
        const lastSelectedNode = this.selection.parentNode
        this.selection.node.parentNode.innerHTML = this.selection.node.parentNode.innerHTML
          .replace('<span>&nbsp;&nbsp;&nbsp;&nbsp;</span>', '')
        const selection = window.getSelection()
        const textNode = Object.values(lastSelectedNode.childNodes).find(node => node.nodeName === '#text')
        const range = document.createRange()
        selection.removeAllRanges()
        range.setStartBefore(textNode)
        range.setEndAfter(textNode)
        selection.addRange(range)
        selection.collapseToStart()
        // Move the cursor to activate selection
        selection.modify('move', 'forward', 'word')
      }
    },
    indentNode () {
      if (this.selection.node.parentNode.id !== 'note-editor__content') {
        this.selection.node.parentNode.insertAdjacentHTML('afterBegin', '<span>&nbsp;&nbsp;&nbsp;&nbsp;</span>')
      }
    },
    formatString (node, level) {
      level++
      const indentBefore = level === 1
        ? new Array(level).join('')
        : new Array(level).join('  ')
      const indentAfter = level - 1 === 1
        ? new Array(level - 1).join('')
        : new Array(level - 1).join('  ')
      let textNode
      for (let i = 0; i < node.children.length; i++) {
        textNode = document.createTextNode(`\n${indentBefore}`)
        node.insertBefore(textNode, node.children[i])
        this.formatString(node.children[i], level)
        if (node.lastElementChild === node.children[i]) {
          textNode = document.createTextNode(`\n${indentAfter}`)
          node.appendChild(textNode)
        }
      }
      return node
    },
    initEditor () {
      this.editor = document.querySelector('#note-editor__content')
    },
    setContent () {
      this.editor.innerHTML = this.value
    },
    updateEditor () {
      this.$emit('input', this.editor.innerHTML)
    },
    setEditableState () {
      if (this.readOnly) {
        this.editor.classList.add('readonly')
        this.editor.setAttribute('contenteditable', false)
      }
      else {
        this.editor.classList.remove('readonly')
        this.editor.setAttribute('contenteditable', true)
      }
    },
    getNodeStructure (node) {
      const nodeArray = []
      node = (node.nodeType === 1) ? node : node.parentNode
      return this.getParentNode(node, nodeArray).reverse()
    },
    getNodePath () {
      const nodeArray = []
      let node = window.getSelection().getRangeAt(0).commonAncestorContainer
      node = (node.nodeType === 1) ? node : node.parentNode
      return this.getParentTag(node, nodeArray).reverse()
    },
    getParentTag (node, nodeArray) {
      if (node) {
        nodeArray.push(node.tagName)
        if (node?.parentNode?.id !== 'note-editor__content') {
          const next = this.getParentTag(node.parentNode, nodeArray)
          if (next) {
            return next
          }
        }
        else {
          return nodeArray
        }
      }
      else {
        return []
      }
    },
    getParentNode (node, nodeArray) {
      nodeArray.push(node)
      if (node?.parentNode?.id !== 'note-editor__content') {
        const next = this.getParentNode(node.parentNode, nodeArray)
        if (next) {
          return next
        }
      }
      else {
        return nodeArray
      }
    },
    loadTemplate (template) {
      this.editor.innerHTML = template.content
    },
    editorFocusHandler (event) {
      // const editor = document.querySelector('#note-editor__content')
      // if (this.value === '') {
      //   editor.innerHTML =
      // }
    },
    setSelectionData (event) {
      const selection = window.getSelection()
      const node = selection.anchorNode
      this.selection.node = node
      this.selection.parentNode = node.parentNode
      this.selection.nodeTag = node.parentNode.tagName
      this.selection.nodeStructure = node.childNodes
      this.selection.parentNodeStructure = node.parentNode.childNodes
      this.selection.nodeEndOffset = node.length - selection.anchorOffset
      this.selection.cursorIsAtNodeEnd = this.selection.nodeEndOffset === 0
      this.selection.isAtRoot = node.id === 'note-editor__content' || node.parentNode.id === 'note-editor__content'
      this.selection.isEnclosed = this.currentNodePath.some(pathItem => this.closureTags.includes(pathItem))
      this.selection.mathKatexNode = node.parentNode.closest('.katex')

      if (this.selection.mathKatexNode) {
        this.selection.mathKatexNode.classList.add('overlay--selection')
      }
      else {
        this.editor.querySelectorAll('*.overlay--selection').forEach(node => {
          node.classList.remove('overlay--selection')
        })
      }
    },
    editorMouse1DownHandler (event) {
      this.setSelectionData()
    },
    initShortcutHandlers (event) {
      // Setup shortcut handlers
      if (event.ctrlKey && event.code === 'BracketLeft') {
        this.outdentNode()
      }
      if (event.ctrlKey && event.code === 'BracketRight') {
        this.indentNode()
      }
    },
    editorKeydownHandler (event) {
      this.setSelectionData()
      this.initShortcutHandlers(event)
      const selection = window.getSelection()
      const actionUndo = event.ctrlKey && !event.shiftKey && event.code === 'KeyZ'
      const actionRedo1 = event.ctrlKey && event.shiftKey && event.code === 'KeyZ'
      const actionRedo2 = event.ctrlKey && event.code === 'KeyY'
      if (actionUndo) {
        event.preventDefault()
        this.loadHistory('backward')
      }
      else if (actionRedo1 || actionRedo2) {
        event.preventDefault()
        this.loadHistory('forward')
      }
      // Handle escaping from formatted blocks
      if (this.selection.isEnclosed) {
        if (this.selection.cursorIsAtNodeEnd &&
            (event.code === 'ArrowRight' ||
             event.code === 'ArrowDown' ||
             event.code === 'Enter')
        ) {
          this.escapeBlock(selection)
        }
        // else if (event.code === 'Enter') {
        //   event.preventDefault()
        //   this.escapeBlock(selection)
        // }
      }
      // Handle 'Enter' button escape from PRE
      if (event.code === 'Enter' && !event.shiftKey && this.selection.nodeTag === 'PRE') {
        // TODO:
        // Automatically format added <pre> to this.newLine when cursor leaves <pre>
      }
      this.updateEditor()
    },
    escapeBlock (selection) {
      this.currentNode.parentNode.insertAdjacentHTML('beforeend', '&nbsp;')
      selection.selectAllChildren(this.currentNode.parentNode)
      selection.collapseToEnd()
    },
    editorChangeHandler (value) {
      this.updateCharCounter()
      this.updateHistory()
      this.cleanUpContent()
    },
    updateCharCounter () {
      this.charCount = this.editor.innerText.replace(/\n/g, '').length
    },
    convertMarkdownToHtml () {
      if (this.markdownShortcuts && !this.selection.isAtRoot) {
        // Get selection node's text. Replace all non standard html spaces with normal spaces
        const text = this.selection.node.textContent.replace(/\s/g, ' ')
        let node = ''
        if (['# ', '## ', '### ', '#### ', '##### ', '###### '].includes(text)) {
          node = document.createElement(`h${text.length - 1}`)
          node.innerHTML = '<br>'
        }
        else if (text === '``` ') {
          node = document.createElement('pre')
        }
        else if (text === '` ') {
          node = document.createElement('code')
        }
        else if (text === '- ') {
          const ul = document.createElement('ul')
          const li = document.createElement('li')
          ul.appendChild(li)
          node = ul
        }
        else if (text === '+ ') {
          const ol = document.createElement('ol')
          const li = document.createElement('li')
          ol.appendChild(li)
          node = ol
        }
        else if (text === '* ') {
          node = document.createElement('i')
          node.innerHTML = '<br>'
        }
        else if (text === '** ') {
          node = document.createElement('b')
          node.innerHTML = '<br>'
        }
        else if (text === '~~ ') {
          node = document.createElement('strike')
          node.innerHTML = '<br>'
        }
        else if (text === '__ ') {
          node = document.createElement('u')
          node.innerHTML = '<br>'
        }
        else if (text === '> ') {
          node = document.createElement('blockquote')
        }
        else if (text === '--- ') {
          node = document.createElement('hr')
        }
        else if (text === '[ ] ' || text === '[] ') {
          const container = document.createElement('div')
          const checkbox = document.createElement('input')
          const label = document.createElement('label')
          label.innerHTML = '&nbsp;'
          checkbox.type = 'checkbox'
          container.appendChild(checkbox)
          container.appendChild(label)
          node = container
        }
        else if (text === '[x] ') {
          const container = document.createElement('div')
          const checkbox = document.createElement('input')
          const label = document.createElement('label')
          label.innerHTML = '&nbsp;'
          checkbox.type = 'checkbox'
          checkbox.toggleAttribute('checked')
          container.appendChild(checkbox)
          container.appendChild(label)
          node = container
        }
        if (node !== '') {
          this.selection.node.parentNode.replaceChild(node, this.selection.node)
          const selection = window.getSelection()
          selection.modify('move', 'forward', 'line')
        }

        // const text = this.selection.node.parentNode.innerText
        // if (conversionList.includes(text)) {
        //   // Added spaces and &nbsp; into the string to make sure the cursor gets
        //   // automatically inserted into the added HTML content.
        //   // some elements need a space at the beginning, some need &nbsp;
        //   const html = mdConverter.makeHtml(text.replace(' ', ' &nbsp;')).replace('&nbsp;', '<br>')
        //   if (!this.selection.isAtRoot) {
        //     this.selection.node.parentNode.innerHTML = html
        //   }
        // }
      }
    },
    updateHistory () {
      const firstIndexReached = this.historyParams.currentIndex === 0
      this.historyParams.undoAvailable = !firstIndexReached
      const lastIndexReached = this.historyParams.currentIndex === this.history.length - 1
      this.historyParams.redoAvailable = !lastIndexReached
      this.historySetThrottle.throttle(() => {
        let currentHistorySizeInBytes = 0
        this.history.forEach(string => {
          currentHistorySizeInBytes += string.length
        })
        const lengthExceeded = this.history.length > this.historyParams.maxItemsAmount
        const sizeExceeded = currentHistorySizeInBytes > this.historyParams.maxSizeInBytes
        if (!this.historyUpdateIsPaused && !lengthExceeded && !sizeExceeded) {
          this.history.push(this.editor.innerHTML)
        }
        else if (!this.historyUpdateIsPaused && lengthExceeded) {
          this.history.splice(0, 1)
          this.history.push(this.editor.innerHTML)
        }
        else if (!this.historyUpdateIsPaused && (lengthExceeded || sizeExceeded)) {
          this.history.splice(0, 1)
          this.history.push(this.editor.innerHTML)
        }
        this.historyUpdateIsPaused = false
      }, {time: 1000})
    },
    loadHistory (direction) {
      // TODO: save cursor position (range) and restore it along with the content
      if (this.history.length === 0) {return}
      this.historyUpdateIsPaused = true
      if (this.historyParams.currentIndex === null) {
        this.historyParams.currentIndex = this.history.length - 1
      }
      if (direction === 'forward') {
        const lastIndexReached = this.historyParams.currentIndex === this.history.length - 1
        this.historyParams.redoAvailable = !lastIndexReached
        if (!lastIndexReached) {
          // Load next history record
          this.historyParams.currentIndex += 1
          this.editor.innerHTML = this.history[this.historyParams.currentIndex]
        }
      }
      else if (direction === 'backward') {
        const firstIndexReached = this.historyParams.currentIndex === 0
        this.historyParams.undoAvailable = !firstIndexReached
        if (!firstIndexReached) {
          // Load previous history record
          this.historyParams.currentIndex -= 1
          this.editor.innerHTML = this.history[this.historyParams.currentIndex]
        }
      }
    },
    cleanUpContent () {
      // Check all 'span' nodes. If a node doesn't have class 'custom',
      // remove the unwanted 'style' attribute that contenteditable sometimes adds automatically
      this.editor.querySelectorAll('span').forEach(node => {
        const isCustomizedNode = node.classList.contains('custom')
        const isKatexNode = node.closest('.katex')
        if (!isCustomizedNode && !isKatexNode) {
          node.removeAttribute('style')
        }
      })
      this.updateEditor()
    },
    handleEmptyEditor () {
      // If the editor is empty, add the 'newLine' node
      if (this.editor.innerHTML === '' || this.editor.innerHTML === '<br>') {
        this.editor.innerHTML = this.newLine
        this.$emit('input', this.editor.innerHTML)
      }
      // If the editor is effectively empty (only has 'newLine'),
      // select the frist line and remove formatting to prevent old formatting being applied to the first line
      if (this.editor.innerHTML === this.newLine) {
        const selection = window.getSelection()
        selection.selectAllChildren(this.editor)
        this.command('removeFormat')
        selection.modify('move', 'forward', 'line')
      }
    },
    editorInputHandler (event) {
      // Add tag for the first line
      this.handleEmptyEditor()
      this.convertMarkdownToHtml()

      // If input comes from the editor's root element
      if (event.target.id === 'note-editor__content') {
        // this.$emit('input', event.target.innerHTML)
      }
      // If input comes from one of the input elements in the editor
      else if (event.target.type === 'checkbox') {
        event.target.toggleAttribute('checked')
      }
      // Sync changes. Do not remove
      this.updateEditor()
    },
    wrapWith (tag) {
      const node = document.createElement(tag)
      this.currentNode.parentNode.insertBefore(node, this.currentNode)
      node.appendChild(this.currentNode)
      this.updateEditor()
    },
    setStyle (styles, options) {
      if (this.currentNode.tagName === 'SPAN') {
        this.currentNode.classList.add('custom')
        // Set custom attributes
        options.attributes.forEach(attribute => {
          this.currentNode.dataset[attribute] = true
        })
        styles.forEach(style => {
          this.currentNode.style[style.key] = style.value
        })
      }
      else {
        const span = document.createElement('span')
        span.classList.add('custom')
        // Set custom attributes
        options.attributes.forEach(attribute => {
          span.dataset[attribute] = true
        })
        styles.forEach(style => {
          span.style[style.key] = style.value
        })
        span.innerHTML = this.currentNode.innerHTML
        this.currentNode.innerHTML = ''
        this.currentNode.appendChild(span)
      }
    },
    highlightNode (color) {
      this.setStyle([
        {
          key: 'backgroundColor',
          value: color + this.highlightOpacityPerc.toString(16),
        },
        {
          key: 'padding',
          value: '2px 8px',
        },
        {
          key: 'borderRadius',
          value: '4px',
        },
      ],
      {
        attributes: ['customHighlight'],
      })
    },
    customCommand (command, value) {
      const selection = window.getSelection()

      if (command === 'wrap') {
        const node = document.createElement(value)
        if (value === 'code') {
          node.innerHTML = this.currentNode.innerHTML
          this.currentNode.innerHTML = ''
          this.currentNode.appendChild(node)
        }
      }
      else if (command === 'toggle') {
        if (!this.currentNodePath.includes(value)) {
          this.command('formatBlock', value)
        }
        else if (!this.currentNodePath.includes(this.newLineTag.toUpperCase())) {
          this.command('formatBlock', this.newLineTag)
        }
      }
      else {
        if (value === 'checkbox') {
          const command = this.$utils.templateToString(`
            <div>
              <input type="checkbox">
              <label>&nbsp;</label>
            </div>
          `)
          this.command('insertHTML', command)
          selection.modify('move', 'forward', 'line')
        }
        else if (value === 'divider') {
          this.command('insertHorizontalRule')
          this.command('insertHTML', this.newLine)
        }
        else if (value === 'indent') {
          this.currentNode.style.margin = '20px'
          // this.command('insertHTML', this.newLine)
        }
        // selection.focusNode.parentNode.insertAdjacentHTML('afterend', value)
        // this.$emit('input', editor.innerHTML)
      }
    },
    command (command, value) {
      const selection = window.getSelection()

      document.execCommand(command, false, value)
    },
    addImage (command) {
      const range = window.getSelection().getRangeAt(0)
      const nothingIsSelected = range === undefined
      const editorIsSelected = range?.parentNode?.id === 'note-editor__content'
      if (nothingIsSelected || !editorIsSelected) {
        // Set cursor at the start of the editor
        const selection = window.getSelection()
        range.setStart(this.editor, 0)
        range.collapse()
        selection.addRange(range)
        this.editor.focus()
      }
      // Insert a new image tag
      const imageNode = document.createElement('img')
      range.collapse()
      range.insertNode(imageNode)

      this.dialogs.imagePickerDialog.data = {
        path: '',
        float: 'none',
        width: '50%',
        height: 'auto',
        loadImage: (data) => {
          this.loadImage(data, imageNode)
        },
      }
      this.dialogs.imagePickerDialog.value = true
    },
    setImage (data, imageNode, destination) {
      const {path, float, width, height} = data
      imageNode.src = this.$storeUtils.getSafePath(destination)
      imageNode.style.float = float
      imageNode.setAttribute('width', width)
      imageNode.setAttribute('height', height)
    },
    async loadImage (data, imageNode) {
      const {path, float, width, height} = data
      const isImage = true
      const isLocal = fs.existsSync(path)
      if (isImage) {
        this.dialogs.imagePickerDialog.value = false
        if (isLocal) {
          const fileName = PATH.parse(path).name
          const fileExt = PATH.parse(path).ext
          // TODO:
          // To decrease disk space usage, replace random hash with file md5 hash so it doesn't create another copy of a file if it already exists
          this.hasher = new Filehasher(path)
          const hash = await this.hasher.gen()
          const destination = PATH.join(this.appPaths.storageDirectories.appStorageNotesMedia, `${fileName}-${hash}${fileExt}`)
          fs.copyFile(path, destination, (error) => {
            if (error) {throw error}
            this.setImage(data, imageNode, destination)
          })
        }
        else {
          // Download added image to the app directory so it's always accessible
          ipcRenderer.send('download-file', {
            url: path,
            dir: this.appPaths.storageDirectories.appStorageNotesMedia,
            hashID: this.$utils.getHash(),
          })
          ipcRenderer.once('download-file-done', (event, info) => {
            this.setImage(data, imageNode, info.filePath)
          })
        }
      }
    },
    insertMathFormula (data, node) {
      const katexHtml = katex.renderToString(data.formula, {
        throwOnError: false,
      })
      node.contentEditable = false
      node.spellcheck = false
      node.innerHTML = katexHtml
    },
    addMathFormula (framework) {
      const type = this.selection.mathKatexNode ? 'edit' : 'add'
      let selectedKatexNodeValue
      let node
      if (type === 'add') {
        // Create new node for Katex
        node = document.createElement('div')
        const range = window.getSelection().getRangeAt(0)
        const nothingIsSelected = range === undefined
        const editorIsSelected = range?.parentNode?.id === 'note-editor__content'
        if (nothingIsSelected || !editorIsSelected) {
          // Set cursor at the start of the editor
          const selection = window.getSelection()
          range.setStart(this.editor, 0)
          range.collapse()
          selection.addRange(range)
          this.editor.focus()
        }
        // Insert the node into editor
        range.collapse()
        range.insertNode(node)
      }
      else if (type === 'edit') {
        selectedKatexNodeValue = this.selection.mathKatexNode.querySelector('annotation').innerHTML
        node = this.selection.mathKatexNode.parentNode
      }

      this.dialogs.mathEditorDialog.data = {
        type: type,
        formula: selectedKatexNodeValue || '',
        framework: framework,
        addFormula: (data) => {
          this.insertMathFormula(data, node)
          this.dialogs.mathEditorDialog.value = false
        },
      }
      this.dialogs.mathEditorDialog.value = true
    },
    expandSelectionToWord () {
      const selection = window.getSelection()
      // If there's no user selection, select the whole word
      if (selection.isCollapsed) {
        selection.modify('move', 'backward', 'word')
        selection.modify('extend', 'forward', 'word')
        // Remove the last space from the selection
        if (selection.toString().endsWith(' ')) {
          selection.modify('extend', 'backward', 'character')
        }
      }
    },
    showNoteEditorContextMenu (event) {
      this.expandSelectionToWord()
      // event.preventDefault()

      this.noteEditorContextMenu = false
      setTimeout(() => {
        this.noteEditorContextMenuX = event.clientX
        this.noteEditorContextMenuY = event.clientY
        this.$nextTick(() => {
          this.noteEditorContextMenu = true
        })
      }, 200)
    },
    noteEditorOpenExternalLink (name) {
      const selectedText = document.getSelection().toString()
      if (name === 'google') {
        this.$utils.openLink(`https://www.google.com/search?q=${selectedText}`)
      }
      else if (name === 'duckduckgo') {
        this.$utils.openLink(`https://www.duckduckgo.com//?q=${selectedText}`)
      }
    },
    textTransform (transform) {
      const selectedText = window.getSelection()
      let newValue
      if (transform === 'uppercase') {
        newValue = selectedText.toString().toUpperCase()
      }
      else if (transform === 'lowercase') {
        newValue = selectedText.toString().toLowerCase()
      }
      document.execCommand('insertText', false, newValue)
      this.updateEditor()
    },
  },
}
</script>

<style>
.readonly * {
  color: var(--color-8) !important;
}

.menubar__button {
  color: var(--icon-color-2) !important;
  margin: 0px;
  height: 26px !important;
}

.menubar__button.is-active {
  background-color: var(--icon_active-color-1);
  color: var(--color-5) !important;
  border-radius: 0;
  border-bottom: 2px solid rgb(255, 255, 255, 0.2)
}

.overlay--selection {
  outline: 2px dashed var(--key-color-1);
}

.note-editor__source-code-container pre {
  white-space: pre-wrap;
  background-color: var(--bg-color-2);
  padding: 20px;
  font-size: 14px;
}

.note-editor__toolbar-group {
  border: 1px solid var(--highlight-color-3);
  border-radius: 4px;
}

.note-editor__toolbar {
  display: flex;
  column-gap: 8px;
  row-gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.note-editor {
  position: relative;
  padding-bottom: 0;
  height: 100%;
  min-height: 100%;
}

.note-editor__content
  img {
    /* -webkit-user-drag: none  */
    max-width: 100%;
    margin: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  }

.note-editor__content-container {
  height: calc(100% - 32px);
  margin: 0px;
  padding: 0px;
}

.note-editor__content {
  width: 100%;
  min-height: 100%;
  height: 100%;
  padding: 8px;
  /* Fix for:
  Contenteditable is automatically adding a span with background-color:
  rgb(255, 255, 255) and caret-color when you delete some text in-between strings */
  background-color: rgb(48, 46, 55, 0.42);
  caret-color: var(--color-6);
  font-size: 16px !important;
}

.note-editor__content:focus {
  outline: none;
}

/* Placeholder */
.note-editor__content[isEmpty]:not([isReadOnly])::before {
  content: attr(placeholder);
  float: left;
  color: var(--highlight-color-1);
  pointer-events: none;
  height: 0;
  top: 0;
  left: 0;
  /* font-style: italic; */
}

.note-editor__content
  .selectedCell:after {
    z-index: 2;
    position: absolute;
    content: "";
    left: 0; right: 0; top: 0; bottom: 0;
    background: rgb(200, 200, 255, 0.4);
    pointer-events: none;
  }

.note-editor__content
  .column-resize-handle {
    position: absolute;
    right: -2px; top: 0; bottom: 0;
    width: 4px;
    z-index: 20;
    background-color: #adf;
    pointer-events: none;
  }

.note-editor__content
  .resize-cursor {
    cursor: ew-resize;
    cursor: col-resize;
  }

.note-editor__content
  hr {
    margin: 12px 0px;
    border-color: var(--divider-color-2) !important;
    border-style: solid;
    border-top: none;
    border-width: thin;
  }

.note-editor__content
  input[type="checkbox"] {
    margin: 8px;
  }

.note-editor__content
  input[type="checkbox"] + label {
    margin: 8px;
  }

.note-editor__content
  input[type="checkbox"]:checked + label {
    color: var(--color-6);
  }

.note-editor__content
  code:after,
.note-editor__content
  code:before,
.note-editor__content
  kbd:after,
.note-editor__content
  kbd:before {
    content: "" !important;
  }

.note-editor__content
  code {
    padding: 2px 4px;
    display: inline-block;
    margin: 0px 4px;
    border-radius: 4px;
    font-weight: 700;
    background: var(--highlight-color-3);
    box-shadow: none;
    color: unset;
  }

.note-editor__content
  pre {
    all: unset;
    display: block;
    word-break: break-all;
    white-space: pre-wrap;
    padding: 8px 8px;
    margin: 16px 0px;
    border-radius: 5px;
    background: var(--code-bg-color);
    overflow-x: hidden;
    min-height: 24px;
  }

.note-editor__content
  pre
    code {
      padding: 0px 2px;
      background: transparent;
      color: unset;
    }

.note-editor__content
  blockquote {
    border-left: 3px solid var(--blockquote-border) !important;
    color: var(--color-7);
    padding: 8px 16px;
    margin: 8px 0px;
    font-style: italic;
    background: var(--blockquote-bg) !important;
    min-height: 42px;
  }

.note-editor__content
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    overflow: hidden;
    margin-bottom: 16px;
  }

.note-editor__content
  table,
.note-editor__content
  code,
.note-editor__content
  pre
    p {
      margin: 0 !important;
    }

.note-editor__content
  td,
.note-editor__content
  th {
    min-width: 1em;
    border: 2px solid var(--table-color);
    padding: 3px 5px;
    vertical-align: top;
    box-sizing: border-box;
    position: relative;
    font-weight: bold;
    text-align: left;
  }

.note-editor__content
   td > *,
.note-editor__content
   th > * {
    margin-bottom: 0;
  }

.note-editor__content
  .tableWrapper {
    margin-top: 1em;
    overflow-x: auto;
  }

.note-editor__content
   h1 {
    margin: 12px 0 !important;
  }

.note-editor__content
  p {
    margin: unset;
    margin-bottom: 4px !important;
  }

.note-editor__content
  li
    p {
      margin-bottom: 12px;
    }

.note-editor__content
  h2,
.note-editor__content
  h3,
.note-editor__content
  ul,
.note-editor__content
  ol,
.note-editor__content
  li,
.note-editor__content
  pre,
.note-editor__content
  code {
    margin: 8px 0 !important;
  }
</style>
