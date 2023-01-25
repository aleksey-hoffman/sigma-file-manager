<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    class="note-card"
    :style="noteStyle(note)"
    @click="$store.dispatch('openNoteEditor', {
      type: 'edit',
      note: note
    })"
  >
    <!-- note-card::title -->
    <v-layout
      class="note-card__title-container"
      align-center
      justify-center
    >
      <div class="note-card__title">
        {{note.title}}
      </div>
    </v-layout>
    <v-divider class="mt-0" />

    <!-- note-card::content -->
    <div
      class="note-card__content fade-mask--bottom"
      :style="{
        '--fade-mask-bottom': '30%'
      }"
      v-html="note.content"
    />

    <!-- note-card::action-toolbar: {type: isTrashed}-->
    <div
      v-show="note.isTrashed"
      class="note-card__action-bar"
      :stay-visible="`${note.isProtected}`"
    >
      <!-- note-card::action-toolbar::button:delete-note-permanently -->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            text
            small
            icon
            v-on="on"
            @click="$store.dispatch('DELETE_NOTE', note)"
          >
            <v-icon size="20px">
              mdi-trash-can-outline
            </v-icon>
          </v-btn>
        </template>
        <span>
          {{$t('notes.noteCard.deleteNotePermanently')}}
        </span>
      </v-tooltip>

      <!-- note-card::action-toolbar::button:restore-note -->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            text
            small
            icon
            v-on="on"
            @click="$store.dispatch('RESTORE_NOTE_FROM_TRASH', note)"
          >
            <v-icon size="20px">
              mdi-undo-variant
            </v-icon>
          </v-btn>
        </template>
        <span>
          {{$t('notes.noteCard.restoreNoteFromTrashList')}}
        </span>
      </v-tooltip>

      <!-- note-card::info-bar -->
      <div class="note-card__info-bar">
        <v-tooltip bottom>
          <template #activator="{ on }">
            <div v-on="on">
              <v-icon
                size="22px"
                class="mr-2"
              >
                mdi-progress-close
              </v-icon>
              {{$utils.formatDateTime(note.dateWillBeDeleted, 'D MMM YYYY')}}
            </div>
          </template>
          <span>{{$t('notes.noteCard.noteWillBeDeletedOnSpecifiedDate')}}</span>
        </v-tooltip>
      </div>
    </div>

    <!-- note-card::action-toolbar: {type: !isTrashed}-->
    <div
      v-show="!note.isTrashed"
      :stay-visible="`${note.isProtected}`"
      class="note-card__action-bar"
      @click.stop=""
    >
      <!-- note-card::action-toolbar::toggle-button:isProtected -->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            icon
            small
            :stay-visible="`${note.isProtected}`"
            v-on="on"
            @click.stop="$store.dispatch('UPDATE_NOTE_PROPERTY', {
              key: 'isProtected',
              value: !note.isProtected,
              note: note
            })"
          >
            <v-icon size="18px">
              {{note.isProtected
                ? 'mdi-shield-check-outline'
                : 'mdi-shield-alert-outline'}}
            </v-icon>
          </v-btn>
        </template>
        <span>
          <div v-show="note.isProtected">
            <div>{{$t('notes.noteCard.noteProtectionIsOn')}}</div>
            <div>{{$t('notes.noteCard.itCannotBeDeletedModified')}}</div>
          </div>
          <div v-show="!note.isProtected">
            <div>{{$t('notes.noteCard.noteProtectionIsOff')}}</div>
            <div>{{$t('notes.noteCard.itCanBeDeletedModified')}}</div>
          </div>
        </span>
      </v-tooltip>

      <!-- note-card::action-toolbar::button:change-group -->
      <v-menu
        max-height="200px"
        top
        nudge-top="16px"
      >
        <template #activator="{ on: menu }">
          <v-tooltip bottom>
            <template #activator="{ on: tooltip }">
              <v-btn
                v-show="!note.isProtected"
                stay-visible="false"
                class="mx-1"
                small
                icon
                v-on="{ ...tooltip, ...menu }"
              >
                <v-icon size="22px">
                  mdi-priority-high
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteCard.changeNoteGroup')}}</span>
          </v-tooltip>
        </template>
        <v-list dense>
          <v-list-item class="inactive">
            <div class="text--sub-title-1 unselectable mb-0">
              {{$t('notes.noteCard.noteGroups')}}
            </div>
          </v-list-item>
          <v-divider />
          <v-list-item
            v-for="(group, index) in noteGroups"
            :key="`${index}-${group.value}`"
            :is-active="group.value === note.group"
            @click="$store.dispatch('UPDATE_NOTE_PROPERTY', {
              key: 'group',
              value: group.value,
              note: note
            })"
          >
            <v-list-item-title>{{group.name}}</v-list-item-title>
            <v-list-item-action v-if="group.value === note.group">
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-icon
                    v-on="on"
                    @click.stop="$store.dispatch('UPDATE_NOTE_PROPERTY', {
                      key: 'group',
                      value: null,
                      note: note
                    })"
                  >
                    mdi-close
                  </v-icon>
                </template>
                <span>{{$t('notes.noteCard.ungroup')}}</span>
              </v-tooltip>
            </v-list-item-action>
          </v-list-item>
        </v-list>
      </v-menu>

      <!-- note-card::action-toolbar::button:color-picker -->
      <v-menu
        max-height="200px"
        top
        nudge-top="24px"
      >
        <template #activator="{ on: menu }">
          <v-tooltip bottom>
            <template #activator="{ on: tooltip }">
              <v-btn
                v-show="!note.isProtected"
                stay-visible="false"
                small
                icon
                v-on="{ ...tooltip, ...menu }"
              >
                <v-icon size="18px">
                  mdi-circle-outline
                </v-icon>
              </v-btn>
            </template>
            <span>{{$t('notes.noteCard.changeColor')}}</span>
          </v-tooltip>
        </template>

        <!-- button:color-picker::color-palette -->
        <div class="note-card__color-palette">
          <v-btn
            v-for="color in noteColors"
            :key="color.value"
            :style="`background-color: ${color.value}a6;`"
            icon
            small
            :data-transparent="color.title === 'transparent'"
            @click="$store.dispatch('UPDATE_NOTE_PROPERTY', {
              key: 'color',
              value: color,
              note: note
            })"
          >
            <v-icon
              v-show="
                color.title === 'transparent' &&
                  color.title !== note.color.title
              "
              size="18px"
            >
              mdi-minus
            </v-icon>
            <v-icon
              v-show="color.title === note.color.title"
              size="16px"
            >
              mdi-check
            </v-icon>
          </v-btn>
        </div>
      </v-menu>
      <v-spacer />

      <!-- note-card::action-toolbar::button:move-note-to-trash -->
      <v-tooltip bottom>
        <template #activator="{ on }">
          <v-btn
            v-show="!note.isProtected"
            stay-visible="false"
            small
            icon
            v-on="on"
            @click="$store.dispatch('MOVE_NOTE_TO_TRASH', note)"
          >
            <v-icon size="20px">
              mdi-trash-can-outline
            </v-icon>
          </v-btn>
        </template>
        <span>{{$t('notes.noteCard.moveNoteToTrash')}}</span>
      </v-tooltip>
    </div>

    <!-- note-card::color-bar -->
    <div
      v-show="note.color.title !== 'transparent'"
      class="note-card__color-bar"
      :style="`
        background-color: ${note.color.value}a6;
        box-shadow: 0px 0px 56px ${note.color.value};
        --bottom: 0px
      `"
    />
    <div
      v-show="note.color.title !== 'transparent'"
      class="note-card__color-bar"
      is-neon-core
      :style="`
        --bottom: 2px
      `"
    />
  </div>
</template>

<script>
export default {
  name: 'note-card',
  props: ['note'],
  computed: {
    noteGroups () {return this.$store.state.storageData.notes.groups},
    noteColors () {return this.$store.state.storageData.notes.colors},
  },
  methods: {
    noteStyle (note) {
      if (note.color.title === 'transparent') {
        return {
          '--shadow-color': 'transparent',
        }
      }
      else {
        return {
          '--shadow-color': `${note.color.value}0D`,
        }
      }
    },
  },
}
</script>

<style>
.note-card__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  grid-auto-rows: 256px;
  gap: 32px;
  padding: 16px 0px;
}

.note-card
  hr {
    margin: 12px 0px;
    border-color: var(--divider-color-2) !important;
    border-style: solid;
    border-top: none;
    border-width: thin;
  }

.note-card
  input[type="checkbox"] {
    margin: 8px;
  }

.note-card
  input[type="checkbox"] + label {
    margin: 8px;
  }

.note-card
  input[type="checkbox"]:checked + label {
    color: var(--color-6);
  }

.note-card {
  position: relative;
  padding-bottom: 8px;
  width: 100%;
  height: 100%;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
  background-color: var(--bg-color-1);
  cursor: pointer;
  overflow: hidden;
  box-shadow:
    var(--shadow-2),
    4px 12px 16px var(--shadow-color);
}

.note-card:hover {
  transform: scale(1.05);
  box-shadow:
    var(--shadow-2__hover),
    4px 12px 48px var(--shadow-color);
}

.note-card__title-container {
  height: 36px;
}

.note-card__title {
  padding: 0px 16px;
  font-size: 16px;
  color: var(--color-5);
  width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.note-card__content {
  padding: 0px 16px;
  height: calc(100% - 36px);
  overflow: hidden;
  word-wrap: break-word;
  font-size: 14px !important;
}

.note-card__content
  img {
    width: 100%;
    margin: 8px 0px;
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
  }

.note-card__content
  h1 {
    font-size: 18px;
  }

.note-card__content
  h2 {
    font-size: 16px;
  }

.note-card__content
  h3 {
    font-size: 14px;
  }

.note-card__content
  p {
    margin: unset;
  }

.note-card__content
  li
    p {
      margin-bottom: 12px;
    }

.note-card__content
  table {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    overflow: hidden;
    margin-bottom: 16px;
  }

.note-card__content
  table,
.note-card__content
  code,
.note-card__content
  pre
    p {
      margin: 0 !important;
    }

.note-card__content
  td > *,
.note-card__content
  th > * {
      margin-bottom: 0;
    }

.note-card__content
  td,
.note-card__content
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

.note-card__content
  code:after,
.note-card__content
  code:before,
.note-card__content
  kbd:after,
.note-card__content
  kbd:before {
    content: "" !important;
  }

.note-card__content
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

.note-card__content
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

.note-card__content
  pre
    code {
      padding: 0px 2px;
      background: transparent;
      color: unset;
    }

.note-card__content
  blockquote {
    border-left: 3px solid var(--blockquote-border) !important;
    color: var(--color-7);
    padding: 8px 16px;
    margin: 8px 0px;
    font-style: italic;
    background: var(--blockquote-bg) !important;
    min-height: 42px;
  }

.note-card__action-bar {
  display: flex;
  gap: 4px;
  align-items: center;
  position: absolute;
  bottom: 0px;
  left: 0px;
  width: 100%;
  height: 36px;
  padding: 0px 8px;
  background-color: transparent;
  transition: all 0.3s;
}

.note-card:hover
  .note-card__action-bar
    * {
      opacity: 1 !important;
    }

.note-card:hover
  .note-card__action-bar,
.note-card:hover
  .note-card__action-bar[stay-visible="true"] {
    background-color: var(--bg-color-1);
  }

.note-card__action-bar
  *[stay-visible="false"] {
    opacity: 0 !important;
  }

.note-card__action-bar
  *[stay-visible="true"] {
    opacity: 1 !important;
  }

.note-card__action-bar
  .v-icon {
    color: var(--icon-color-2) !important;
  }

.note-card__info-bar {
  position: absolute;
  bottom: 35px;
  left: 0px;
  width: 100%;
  height: 36px;
  padding: 0px 12px;
  font-size: 14px;
  display: flex;
  align-items: center;
  background-color: var(--highlight-color-3);
  transition: all 0.3s;
}

.note-card__color-bar {
  position: absolute;
  bottom: 0px;
  bottom: var(--bottom);
  left: 0px;
  width: 100%;
  height: 6px;
  opacity: var(--note-color-bar-opacity);
}

.note-card__color-bar[is-neon-core] {
  background-color: #ffffff;
  box-shadow: 0px 0px 24px #ffffff;
  height: 2px;
  bottom: 2px;
  bottom: var(--bottom);
  opacity: 0.5;
  filter: blur(0.5px);
}

.note-card__color-palette {
  display: flex;
  flex-wrap: wrap;
  width: 156px;
  height: 80px;
  background-color: var(--bg-color-1);
  padding: 8px;
  gap: 8px;
}

.note-card__color-palette
  .v-btn {
    width: 24px;
    height: 24px;
  }

.note-card__color-palette
  .v-btn[data-transparent] {
    border: 1px solid var(--color-4);
  }

.note-card__color-palette
  .v-icon {
    color: var(--color-4) !important;
  }
</style>
