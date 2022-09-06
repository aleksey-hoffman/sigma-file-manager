<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="notes-route">
    <ActionToolbar />
    <div
      id="content-area--notes-route"
      class="content-area custom-scrollbar"
      style="overflow-x: hidden"
    >
      <v-layout
        class="mb-4"
        align-center
        justify-space-between
      >
        <div class="text--title-1">
          {{currentNotesList === 'trashed'
            ? 'Trashed notes'
            : 'Notes'}}
        </div>
        <filter-field route-name="notes" />
      </v-layout>

      <div v-if="!renderContent">
        Loading notes
        <v-progress-circular
          indeterminate
          color="blue-grey"
        />
      </div>

      <div
        v-if="renderContent"
        class="fade-in-1s"
      >
        <div v-if="currentNotesList === 'trashed'">
          <div v-show="!trashedNotesListIsEmpty">
            Trashed notes are automatically deleted from the drive 7 days after being trashed
          </div>

          <v-btn
            v-show="!trashedNotesListIsEmpty"
            small
            class="my-2 button-1"
            @click="$store.dispatch('DELETE_ALL_NOTES_IN_TRASH')"
          >
            <v-icon
              size="18px"
              class="mr-2"
            >
              mdi-trash-can-outline
            </v-icon>
            Delete all trashed
          </v-btn>

          <div class="note-group__container">
            <div
              v-show="trashedNotesListIsEmpty"
              class="content__description"
            >
              No trashed notes
            </div>
            <div class="note-card__container">
              <note-card
                v-for="note in filteredDeletedNotes"
                :key="note.hashID"
                :note="note"
              />
            </div>
          </div>
        </div>

        <div v-if="currentNotesList === 'existing'">
          <div
            v-if="notesListIsEmpty"
            class="content__description"
          >
            No notes
          </div>

          <FilterClearButton
            v-if="filterQuery.length > 0"
            :filter-query="filterQuery"
            class="mb-4"
            @click="filterQuery = ''"
          />

          <div class="note-group__container">
            <div
              v-show="ungroupedNotes.length > 0"
              class="text--sub-title-1"
            >
              Ungrouped notes
            </div>
            <div class="note-card__container">
              <note-card
                v-for="note in ungroupedNotes"
                :key="note.hashID"
                :note="note"
              />
            </div>

            <div
              v-for="group in noteGroups"
              v-show="showNoteGroup(group)"
              :key="group.value"
            >
              <div class="text--sub-title-1">
                {{`GROUP | ${group.name}`}}
              </div>

              <v-divider class="divider-color-2" />

              <div class="note-card__container">
                <note-card
                  v-for="note in filteredExistingNotes"
                  v-show="note.group === group.value"
                  :key="note.hashID"
                  :note="note"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import itemFilter from '../utils/itemFilter'
import FilterClearButton from '@/components/FilterClearButton/index.vue'
import ActionToolbar from '@/views/NotesView/ActionToolbar/ActionToolbar.vue'

export default {
  name: 'notes',
  components: {
    FilterClearButton,
    ActionToolbar,
  },
  data () {
    return {
      renderContent: false,
    }
  },
  activated () {
    this.$store.dispatch('routeOnActivated', this.$route.name)
  },
  mounted () {
    this.initRenderContent()
    this.$store.dispatch('routeOnMounted', this.$route.name)
  },
  computed: {
    ...mapFields({
      notes: 'storageData.notes.items',
      noteGroups: 'storageData.notes.groups',
      filterQuery: 'filterField.view.notes.query',
      currentNotesList: 'currentNotesList',
    }),
    notesListIsEmpty () {
      return [...this.notes.filter(note => !note.isTrashed)].length === 0
    },
    trashedNotesListIsEmpty () {
      return [...this.notes.filter(note => note.isTrashed)].length === 0
    },
    ungroupedNotes () {
      const ungroupedNotes = [...this.filteredExistingNotes.filter(note => {
        const groupIsDefined = this.noteGroups.some(group => group.value === note.group)
        return note.group === null || !groupIsDefined
      })]
      return ungroupedNotes
    },
    filteredNotes () {
      return this.getItemsMatchingFilter(this.notes)
    },
    filteredExistingNotes () {
      return this.filteredNotes.filter(note => !note.isTrashed)
    },
    filteredDeletedNotes () {
      return this.filteredNotes.filter(note => note.isTrashed)
    },
  },
  methods: {
    initRenderContent () {
      setTimeout(() => {
        this.renderContent = true
      }, 100)
    },
    getItemsMatchingFilter (items) {
      return itemFilter({
        filterQuery: this.filterQuery,
        items,
        filterProperties: this.$store.state.filterField.view.notes.filterProperties,
        filterQueryOptions: this.$store.state.filterField.view.notes.options,
      })
    },
    showNoteGroup (group) {
      const groupHasNotes = this.filteredExistingNotes.some(note => note.group === group.value)
      return groupHasNotes
    },
    onDrop (dropResult) {
      this.notes = this.applyDrag(this.notes, dropResult)
    },
    applyDrag (arr, dragResult) {
      const {removedIndex, addedIndex, payload} = dragResult
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
    },
  },
}
</script>
