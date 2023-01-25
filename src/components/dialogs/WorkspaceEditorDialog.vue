<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'workspaceEditorDialog'}),
    }"
    :action-buttons="dialogActionButtons"
    :title="$t('dialogs.workspaceEditorDialog.workspaceEditor')"
    fade-mask-bottom="5%"
    height="90vh"
    max-width="600px"
  >
    <template #content>
      <div class="workspace-editor-dialog">
        <!-- workspace_selector -->
        <div class="workspace-editor-dialog__section">
          <div class="text--sub-title-1 mb-2">
            {{$t('dialogs.workspaceEditorDialog.selectWorkspaceToEdit')}}
          </div>
          <div class="workspace-editor-dialog__flex-block">
            <v-select
              v-model="dialog.selectedWorkspace"
              :items="dialog.workspaceItems"
              item-text="name"
              item-value="id"
              :label="$t('dialogs.workspaceEditorDialog.selectedWorkspace')"
              return-object
              class="mr-4"
              @change="updateDialogProps()"
            >
              <template #selection="{ item }">
                <v-icon
                  size="20px"
                  class="mr-2"
                >
                  {{getWorkspaceTypeIcon(item)}}
                </v-icon>
                <span>{{newWorkspaceName(item)}}</span>
              </template>
              <template #item="{ item }">
                <v-icon
                  size="20px"
                  class="mr-2"
                >
                  {{getWorkspaceTypeIcon(item)}}
                </v-icon>
                <span>{{newWorkspaceName(item)}}</span>
              </template>
            </v-select>
            <AppButton
              icon="mdi-plus"
              :tooltip="$t('dialogs.workspaceEditorDialog.addNewWorkspace')"
              @click="addWorkspace()"
            />
            <AppButton
              icon="mdi-trash-can-outline"
              icon-size="16px"
              :tooltip="$t('dialogs.workspaceEditorDialog.deleteWorkspace')"
              :disabled="!isEditing || dialog.selectedWorkspace.isPrimary"
              @click="deleteWorkspace(dialog.selectedWorkspace)"
            />
          </div>
        </div>

        <!-- workspace_properties -->
        <div class="highlight-card workspace-editor-dialog__section">
          <div class="text--sub-title-1 mb-2">
            {{$t('dialogs.workspaceEditorDialog.workspaceProperties')}}
          </div>
          <v-text-field
            v-if="!dialog.selectedWorkspace.isPrimary"
            v-model="dialog.selectedWorkspace.name"
            :label="$t('dialogs.workspaceEditorDialog.workspaceName')"
          />
          <v-text-field
            v-model="dialog.selectedWorkspace.defaultPath"
            :label="$t('dialogs.workspaceEditorDialog.workspaceDefaultDirectory')"
          />
        </div>

        <!-- workspace_actions -->
        <div
          v-if="!dialog.selectedWorkspace.isPrimary"
          class="highlight-card workspace-editor-dialog__section"
        >
          <div class="pb-2">
            <div class="text--sub-title-1 mb-2">
              {{$t('dialogs.workspaceEditorDialog.workspaceLaunchActions')}}
            </div>
            <div class="mb-4 text--description-1">
              {{$t('dialogs.workspaceEditorDialog.youCanTriggerTheseActions')}}
            </div>
            <div v-if="dialog.selectedWorkspace.actions && dialog.selectedWorkspace.actions.length > 0">
              <div class="workspace-editor-dialog__flex-block">
                <v-select
                  v-model="dialog.selectedWorkspaceAction"
                  :items="dialog.selectedWorkspace.actions"
                  item-text="name"
                  :label="$t('dialogs.workspaceEditorDialog.selectedAction')"
                  return-object
                  class="mr-4"
                >
                  <template #selection="{ item }">
                    <v-icon
                      size="20px"
                      class="mr-2"
                    >
                      {{getWorkspaceTypeIcon(item)}}
                    </v-icon>
                    <span>{{newWorkspaceActionName(item)}}</span>
                  </template>
                  <template #item="{ item }">
                    <v-icon
                      size="20px"
                      class="mr-2"
                    >
                      {{getWorkspaceTypeIcon(item)}}
                    </v-icon>
                    <span>{{newWorkspaceActionName(item)}}</span>
                  </template>
                </v-select>

                <AppButton
                  icon="mdi-plus"
                  :tooltip="$t('dialogs.workspaceEditorDialog.addNewAction')"
                  @click="addWorkspaceAction()"
                />
                <AppButton
                  icon="mdi-trash-can-outline"
                  icon-size="16px"
                  :tooltip="$t('dialogs.workspaceEditorDialog.deleteWorkspaceAction')"
                  :disabled="dialog.selectedWorkspaceAction.id === null"
                  @click="deleteWorkspaceAction(dialog.selectedWorkspaceAction)"
                />
              </div>
              <!-- workspace_actions::name -->
              <v-text-field
                v-model="dialog.selectedWorkspaceAction.name"
                :label="$t('dialogs.workspaceEditorDialog.actionName')"
              />

              <!-- workspace_actions::type -->
              <v-select
                v-model="dialog.selectedWorkspaceAction.type"
                :items="dialog.workspaceActionTypes"
                item-text="name"
                :label="$t('dialogs.workspaceEditorDialog.actionType')"
                return-object
              >
                <template #selection="{ item: actionItem }">
                  <v-icon
                    size="20px"
                    class="mr-2"
                  >
                    {{actionItem.icon}}
                  </v-icon>
                  <span>{{actionItem.name}}</span>
                </template>
                <template #item="{ item: actionItem }">
                  <v-icon
                    size="20px"
                    class="mr-4"
                  >
                    {{actionItem.icon}}
                  </v-icon>
                  <span>{{actionItem.name}}</span>
                </template>
              </v-select>

              <!-- workspace_actions::command -->
              <v-text-field
                v-model="dialog.selectedWorkspaceAction.command"
                :label="$t('dialogs.workspaceEditorDialog.actionCommand')"
              />

              <div class="text--sub-title-1">
                {{$t('dialogs.workspaceEditorDialog.commandExample')}}:
              </div>
              <div class="workspace-editor-dialog__command-example">
                {{dialog.selectedWorkspaceAction.type.example}}
              </div>

              <template v-if="dialog.selectedWorkspaceAction.type.name === 'terminal-command'">
                <v-switch
                  v-if="dialog.selectedWorkspaceAction.type.options"
                  v-model="dialog.selectedWorkspaceAction.type.options.asAdmin"
                  :label="$t('dialogs.workspaceEditorDialog.runCommandAsAdmin')"
                  class="mt-4 mb-2"
                  hide-details
                />
              </template>
            </div>
            <div v-else>
              <AppButton
                button-class="button-1"
                @click="addWorkspaceAction()"
              >
                {{$t('dialogs.workspaceEditorDialog.addNewAction')}}
              </AppButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import * as notifications from '@/utils/notifications.js'
import {cloneDeep as clone} from '@/utils/lodash.min.js'
import AppButton from '@/components/AppButton/AppButton.vue'

export default {
  components: {
    AppButton,
  },
  watch: {
    'dialog.value' (value) {
      if (value) {
        this.initDialogData()
      }
    },
  },
  computed: {
    ...mapFields({
      dialog: 'dialogs.workspaceEditorDialog',
      workspaces: 'storageData.workspaces',
    }),
    isEditing () {
      return this.dialog.selectedWorkspace.id !== null
    },
    dialogActionButtons () {
      return [
        {
          vIf: true,
          text: this.$t('dialogs.workspaceEditorDialog.cancel'),
          onClick: () => this.$store.dispatch('closeDialog', {name: 'workspaceEditorDialog'}),
        },
        {
          vIf: !this.isEditing,
          text: this.$t('dialogs.workspaceEditorDialog.createWorkspace'),
          onClick: () => this.createWorkspaceButton(),
        },
        {
          vIf: this.isEditing,
          text: this.$t('dialogs.workspaceEditorDialog.saveChanges'),
          onClick: () => this.saveChangesButton(),
        },
      ].filter(item => item.vIf)
    },
  },
  methods: {
    initDialogData () {
      const workspaceTemplate = clone(this.dialog.workspaceTemplate)
      const workspaceActionTypes = clone(this.dialog.workspaceActionTypes)
      const workspaceItems = clone(this.workspaces.items)
      // Select template item on the selection list, if no workspace is currently selected (active)
      let selectedWorkspace = workspaceItems.find(item => item.isSelected)
      this.dialog.workspaceItems = workspaceItems
      this.dialog.selectedWorkspace = selectedWorkspace || workspaceTemplate
      this.dialog.workspaceActionTypes = workspaceActionTypes
      if (selectedWorkspace.actions.length >= 0) {
        this.dialog.selectedWorkspaceAction = selectedWorkspace.actions[0]
      }
    },
    newWorkspaceName (item) {
      let name = item.name || this.$t('dialogs.workspaceEditorDialog.newWorkspace')
      return item.id === null ? `${this.$t('common.add')}: ${name}` : `${this.$t('common.edit')}: ${name}`
    },
    newWorkspaceActionName (item) {
      let name = item.name || this.$t('dialogs.workspaceEditorDialog.newAction')
      return item.id === null ? `${this.$t('common.add')}: ${name}` : `${this.$t('common.edit')}: ${name}`
    },
    getWorkspaceTypeIcon (item) {
      return item.id === null ? 'mdi-plus' : 'mdi-pencil-outline'
    },
    updateDialogProps () {
      // Update selectedWorkspaceAction so it's synced with the input fields
      this.dialog.selectedWorkspaceAction = this.dialog.selectedWorkspace.actions[0]
    },
    async createWorkspaceButton () {
      try {
        // Set ids, remove actions with empty commands
        const workspaceCount = this.dialog.workspaceItems.length - 1
        this.dialog.selectedWorkspace.id = workspaceCount
        this.dialog.selectedWorkspace.actions.forEach((action, index) => {
          action.id = index
        })
        await this.$store.dispatch('addWorkspace', this.dialog.selectedWorkspace)
        this.$store.dispatch('closeDialog', {name: 'workspaceEditorDialog'})
      }
      catch (error) {
        notifications.emit({name: 'addWorkspaceError', props: {error}})
      }
    },
    async saveChangesButton () {
      try {
        const updatedWorkspaceItems = clone(this.dialog.workspaceItems).filter(listItem => listItem.id !== null)
        updatedWorkspaceItems.forEach(workspace => {
          workspace.actions.forEach((action, index) => {
            action.id = index
          })
        })
        await this.updateWorkspaceStorage(updatedWorkspaceItems)
        this.$store.dispatch('closeDialog', {name: 'workspaceEditorDialog'})
      }
      catch (error) {
        notifications.emit({name: 'editWorkspaceError', props: {error}})
      }
    },
    async updateWorkspaceStorage (items) {
      await this.$store.dispatch('SET', {
        key: 'storageData.workspaces.items',
        value: items,
      })
    },
    selectPrimaryWorkspace () {
      let primaryWorkspace = this.dialog.workspaceItems.find(listItem => listItem.isPrimary)
      primaryWorkspace.isSelected = true
      this.dialog.selectedWorkspace = primaryWorkspace
    },
    selectNewWorkspace () {
      this.dialog.selectedWorkspace = this.dialog.workspaceItems.find(workspace => workspace.id === null)
    },
    addWorkspace () {
      const workspaceTemplate = clone(this.dialog.workspaceTemplate)
      const workspaceItems = this.dialog.workspaceItems.filter(workspace => workspace.id !== null)
      this.dialog.workspaceItems = [
        ...workspaceItems,
        ...[workspaceTemplate],
      ]
      this.selectNewWorkspace()
    },
    addWorkspaceAction () {
      const workspaceActionTemplate = clone(this.dialog.workspaceActionTemplate)
      const workspaceActions = [
        ...this.dialog.selectedWorkspace.actions,
        ...[workspaceActionTemplate],
      ]
      this.dialog.selectedWorkspace.actions = workspaceActions
      this.dialog.selectedWorkspaceAction = workspaceActionTemplate
    },
    async deleteWorkspace (workspace) {
      try {
        const updatedWorkspaceItems = this.dialog.workspaceItems.filter(_workspace => _workspace.id !== workspace.id)
        this.selectPrimaryWorkspace()
        await this.updateWorkspaceStorage(updatedWorkspaceItems)
        this.initDialogData()
        notifications.emit({name: 'deleteWorkspace', props: {name: workspace.name}})
      }
      catch (error) {
        notifications.emit({name: 'deleteWorkspaceError', props: {error}})
      }
    },
    deleteWorkspaceAction (workspaceAction) {
      const selectedWorkspaceActionsClone = clone(this.dialog.selectedWorkspace.actions)
      this.dialog.selectedWorkspace.actions = selectedWorkspaceActionsClone.filter(listItem => listItem.id !== workspaceAction.id)
      this.dialog.selectedWorkspaceAction = this.dialog.selectedWorkspace.actions[0]
    },
  },
}
</script>

<style>
.workspace-editor-dialog__flex-block {
  display: flex;
  align-items: center;
}

.workspace-editor-dialog__section {
  margin-bottom: 12px;
}

.workspace-editor-dialog__command-example {
  padding: 12px;
  background-color: rgba(var(--bg-color-2-value), 0.3);
  border-radius: 8px;
  word-break: break-all;
}
</style>