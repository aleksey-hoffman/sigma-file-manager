<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => closeDialog(),
    }"
    :action-buttons="dialogActionButtons"
    title="Workspace editor"
    fade-mask-bottom="5%"
    height="90vh"
    max-width="600px"
  >
    <template #content>
      <div class="workspace-editor-dialog">
        <!-- workspace_selector -->
        <div class="workspace-editor-dialog__section">
          <div class="text--sub-title-1 mb-2">
            Select workspace to edit
          </div>
          <div class="workspace-editor-dialog__flex-block">
            <v-select
              v-model="dialog.selectedWorkspace"
              :items="dialog.workspaceItems"
              item-text="name"
              item-value="id"
              label="Selected workspace"
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
            <Button
              icon="mdi-plus"
              tooltip="Add new workspace"
              @click="addWorkspace()"
            />
            <Button
              icon="mdi-trash-can-outline"
              icon-size="16px"
              tooltip="Delete workspace"
              :disabled="!isEditing || dialog.selectedWorkspace.isPrimary"
              @click="deleteWorkspace(dialog.selectedWorkspace)"
            />
          </div>
        </div>

        <!-- workspace_properties -->
        <div class="highlight-card workspace-editor-dialog__section">
          <div class="text--sub-title-1 mb-2">
            Workspace properties
          </div>
          <v-text-field
            v-if="!dialog.selectedWorkspace.isPrimary"
            v-model="dialog.selectedWorkspace.name"
            label="Workspace name"
          />
          <v-text-field
            v-model="dialog.selectedWorkspace.defaultPath"
            label="Workspace default directory"
          />
        </div>

        <!-- workspace_actions -->
        <div
          v-if="!dialog.selectedWorkspace.isPrimary"
          class="highlight-card workspace-editor-dialog__section"
        >
          <div class="pb-2">
            <div class="text--sub-title-1 mb-2">
              Workspace launch actions
            </div>
            <div class="mb-4 text--description-1">
              You can trigger these actions when you switch to this workspace
            </div>
            <div v-if="dialog.selectedWorkspace.actions && dialog.selectedWorkspace.actions.length > 0">
              <div class="workspace-editor-dialog__flex-block">
                <v-select
                  v-model="dialog.selectedWorkspaceAction"
                  :items="dialog.selectedWorkspace.actions"
                  item-text="name"
                  label="Selected action"
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

                <Button
                  icon="mdi-plus"
                  tooltip="Add new action"
                  @click="addWorkspaceAction()"
                />
                <Button
                  icon="mdi-trash-can-outline"
                  icon-size="16px"
                  tooltip="Delete workspace action"
                  :disabled="dialog.selectedWorkspaceAction.id === null"
                  @click="deleteWorkspaceAction(dialog.selectedWorkspaceAction)"
                />
              </div>
              <!-- workspace_actions::name -->
              <v-text-field
                v-model="dialog.selectedWorkspaceAction.name"
                label="Action name"
              />

              <!-- workspace_actions::type -->
              <v-select
                v-model="dialog.selectedWorkspaceAction.type"
                :items="dialog.workspaceActionTypes"
                item-text="name"
                label="Action type"
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
                label="Action command"
              />

              <div class="text--sub-title-1">
                Command example:
              </div>
              <div class="workspace-editor-dialog__command-example">
                {{dialog.selectedWorkspaceAction.type.example}}
              </div>

              <template v-if="dialog.selectedWorkspaceAction.type.name === 'terminal-command'">
                <v-switch
                  v-if="dialog.selectedWorkspaceAction.type.options"
                  v-model="dialog.selectedWorkspaceAction.type.options.asAdmin"
                  label="Run command as admin"
                  class="mt-4 mb-2"
                  hide-details
                />
              </template>
            </div>
            <div v-else>
              <Button
                button-class="button-1"
                @click="addWorkspaceAction()"
              >
                Add new action
              </Button>
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
import Button from '@/components/Button/index.vue'

export default {
  components: {
    Button,
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
      dialog: 'dialogs.workspaceEditor',
      workspaces: 'storageData.workspaces',
    }),
    isEditing () {
      return this.dialog.selectedWorkspace.id !== null
    },
    dialogActionButtons () {
      return [
        {
          vIf: true,
          text: 'cancel',
          onClick: () => this.closeDialog(),
        },
        {
          vIf: !this.isEditing,
          text: 'Create workspace',
          onClick: () => this.createWorkspaceButton(),
        },
        {
          vIf: this.isEditing,
          text: 'Save changes',
          onClick: () => this.saveChangesButton(),
        },
      ].filter(item => item.vIf)
    },
  },
  methods: {
    closeDialog () {
      this.dialog.value = false
    },
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
      let name = item.name || 'New workspace'
      return item.id === null ? `Add: ${name}` : `Edit: ${name}`
    },
    newWorkspaceActionName (item) {
      let name = item.name || 'New action'
      return item.id === null ? `Add: ${name}` : `Edit: ${name}`
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
        this.closeDialog()
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
        this.closeDialog()
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