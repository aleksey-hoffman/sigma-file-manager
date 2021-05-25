<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="notes-route">
    <div
      id="content-area--notes-route"
      class="content-area custom-scrollbar"
      style="overflow-x: hidden"
    >
      <div v-if="currentNotesList === 'trashed'">
        <v-layout align-start>
          <div class="text--title-1">
            Trashed notes
          </div>
        </v-layout>

        <div v-show="!trashedNotesListIsEmpty">
          Trashed notes are automatically deleted from the drive 7 days after being trashed
        </div>

        <v-btn
          v-show="!trashedNotesListIsEmpty"
          @click="$store.dispatch('DELETE_ALL_NOTES_IN_TRASH')"
          small
          class="my-2 button-1"
        >
          <v-icon size="18px" class="mr-2">
            mdi-trash-can-outline
          </v-icon>
          Delete all trashed
        </v-btn>

        <div class="note-group__container">
          <div v-show="trashedNotesListIsEmpty" class="content__description">
            No trashed notes
          </div>
          <div class="note-card__container">
            <note-card
              v-for="note in filteredDeletedNotes"
              :key="note.hashID"
              :note="note"
            ></note-card>
          </div>
        </div>
      </div>

      <div v-if="currentNotesList === 'existing'">
        <v-layout
          align-center justify-space-between
          class="mb-4"
        >
          <div class="text--title-1">
            Notes
          </div>
          <filter-field/>
        </v-layout>

        <div v-if="notesListIsEmpty" class="content__description">
          No notes
        </div>

        <div v-if="filterQuery.length > 0" class="content__description">
          <v-btn
            @click="filterQuery = ''"
            small
            class="my-2 button-1"
          >
            <v-icon size="18px" class="mr-2">
              mdi-close
            </v-icon>
            Clear filter
          </v-btn>
        </div>

        <div class="note-group__container">
          <div v-show="ungroupedNotes.length > 0" class="text--sub-title-1">
            Ungrouped notes
          </div>
          <div class="note-card__container">
            <note-card
              v-for="note in ungroupedNotes"
              :key="note.hashID"
              :note="note"
            ></note-card>
          </div>

          <div
            v-show="showNoteGroup(group)"
            v-for="group in noteGroups"
            :key="group.value"
          >
            <div class="text--sub-title-1">
              {{`GROUP | ${group.name}`}}
            </div>

            <v-divider class="divider-color-2"></v-divider>

            <div class="note-card__container">
              <note-card
                v-show="note.group === group.value"
                v-for="note in filteredNotes"
                :key="note.hashID"
                :note="note"
              >
              </note-card>
            </div>

          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'

export default {
  name: 'notes',
  data () {
    return {
    }
  },
  beforeRouteLeave (to, from, next) {
    this.$eventHub.$emit('app:method', {
      method: 'setRouteScrollPosition',
      params: {
        toRoute: to,
        fromRoute: from
      }
    })
    next()
  },
  mounted () {
    this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
      route: 'notes'
    })
  },
  computed: {
    ...mapFields({
      notes: 'storageData.notes.items',
      noteGroups: 'storageData.notes.groups',
      filterQuery: 'filterField.view.notes.query',
      filterQueryMatchedItems: 'filterField.view.notes.matchedItems',
      currentNotesList: 'currentNotesList'
    }),
    notesListIsEmpty () {
      return [...this.notes.filter(note => !note.isTrashed)].length === 0
    },
    trashedNotesListIsEmpty () {
      return [...this.notes.filter(note => note.isTrashed)].length === 0
    },
    ungroupedNotes () {
      const ungroupedNotes = [...this.filteredNotes.filter(note => {
        const groupIsDefined = this.noteGroups.some(group => group.value === note.group)
        return note.group === null || !groupIsDefined
      })]
      return ungroupedNotes
    },
    filteredNotes () {
      const items = this.filterQuery.length > 0
        ? this.filterQueryMatchedItems
        : this.notes
      return [...items].filter(note => !note.isTrashed)
    },
    filteredDeletedNotes () {
      const items = this.filterQuery.length > 0
        ? this.filterQueryMatchedItems
        : this.notes
      return [...items].filter(note => note.isTrashed)
    }
  },
  methods: {
    showNoteGroup (group) {
      const groupHasNotes = this.filteredNotes.some(note => note.group === group.value)
      return groupHasNotes
    },
    onDrop (dropResult) {
      this.notes = this.applyDrag(this.notes, dropResult)
    },
    applyDrag (arr, dragResult) {
      const { removedIndex, addedIndex, payload } = dragResult
      if (removedIndex === null && addedIndex === null) return arr

      const result = [...arr]
      let itemToAdd = payload

      if (removedIndex !== null) {
        itemToAdd = result.splice(removedIndex, 1)[0]
      }

      if (addedIndex !== null) {
        result.splice(addedIndex, 0, itemToAdd)
      }

      return result
    }
  }
}
</script>
