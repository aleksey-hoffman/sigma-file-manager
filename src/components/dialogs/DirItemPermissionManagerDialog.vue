<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'dirItemPermissionManagerDialog'}),
    }"
    :title="$t('dialogs.dirItemPermissionManagerDialog.permissions')"
    height="unset"
    fade-mask-bottom="0%"
  >
    <template #content>
      <div class="mb-4">
        <div v-html="warningMessage" />
      </div>
      <div>
        <div>
          <span style="font-weight: bold">{{$t('dialogs.dirItemPermissionManagerDialog.path')}}:</span>
          {{dialog.data.dirItem.path}}
        </div>
        <div>
          <span style="font-weight: bold">{{$t('dialogs.dirItemPermissionManagerDialog.owner')}}:</span>
          {{dialog.data.permissionData.owner}}
        </div>
        <div>
          <span style="font-weight: bold">{{$t('dialogs.dirItemPermissionManagerDialog.readOnly')}}:</span>
          {{$utils.getItemPermissions(dialog.data.dirItem).isReadOnly}}
        </div>
        <div>
          <span style="font-weight: bold">{{$t('dialogs.dirItemPermissionManagerDialog.protectedAppScope')}}:</span>
          {{targetItemsIncludeProtected}}
        </div>
        <div>
          <span style="font-weight: bold">{{$t('dialogs.dirItemPermissionManagerDialog.permissions')}}:</span>
          {{$utils.getItemPermissions(dialog.data.dirItem).permissions}}
        </div>
      </div>

      <!-- TODO: finish in v1.1.0 -->
      <!-- input-switch::immutable -->
      <div v-if="false">
        <v-tooltip
          bottom
          max-width="300px"
        >
          <template #activator="{ on }">
            <div
              class="d-inline-flex"
              v-on="on"
            >
              <v-switch
                class="mb-4"
                :value="dialog.data.permissionData.isImmutable"
                :label="$t('dialogs.dirItemPermissionManagerDialog.immutable')"
                hide-details
                @change="setDirItemImmutableState()"
              />
            </div>
          </template>
          <span>
            {{$t('dialogs.dirItemPermissionManagerDialog.ifEnabledImmutable')}}
          </span>
        </v-tooltip>
      </div>

      <!-- TODO: finish in v1.1.0 -->
      <div v-if="false">
        <div v-if="systemInfo.platform === 'win32' && !dialog.data.permissionData.isImmutable">
          <!-- input-select::owner -->
          <v-select
            v-model="dialog.data.user.selected"
            :items="dialog.data.user.items"
            return-object
            item-text="text"
            :label="$t('dialogs.dirItemPermissionManagerDialog.groupOrUser')"
          />

          <!-- input-select::everyone -->
          <v-select
            v-model="dialog.data.win32.selectedPermissions"
            :items="dialog.data.win32.permissions"
            :label="$t('dialogs.dirItemPermissionManagerDialog.permissions')"
            multiple
          />
        </div>

        <div v-if="systemInfo.platform === 'linux'">
          <!-- input-select::owner -->
          <v-select
            v-model="dialog.data.permissionGroups.owner.selected"
            :items="dialog.data.permissionGroups.owner.items"
            :label="$t('dialogs.dirItemPermissionManagerDialog.owner')"
          />

          <!-- input-select::group -->
          <v-select
            v-model="dialog.data.permissionGroups.group.selected"
            :items="dialog.data.permissionGroups.group.items"
            :label="$t('dialogs.dirItemPermissionManagerDialog.group')"
          />

          <!-- input-select::everyone -->
          <v-select
            v-model="dialog.data.permissionGroups.everyone.selected"
            :items="dialog.data.permissionGroups.everyone.items"
            :label="$t('dialogs.dirItemPermissionManagerDialog.everyone')"
          />
        </div>
      </div>

      <div class="button-container">
        <!-- button:learn-more -->
        <v-btn
          class="button-1 mt-4"
          small
          @click="$store.dispatch('openAppGuide', 'data-protection')"
        >
          {{$t('dialogs.dirItemPermissionManagerDialog.learnMore')}}
        </v-btn>

        <!-- button:reset-permissions -->
        <v-btn
          class="button-1 mt-4"
          small
          @click="$store.dispatch('RESET_DIR_ITEM_PERMISSIONS')"
        >
          {{$t('dialogs.dirItemPermissionManagerDialog.resetPermissions')}}
        </v-btn>

        <!-- button:take-ownership -->
        <v-btn
          class="button-1 mt-4"
          small
          @click="$store.dispatch('TAKE_DIR_ITEM_OWNERSHIP')"
        >
          {{$t('dialogs.dirItemPermissionManagerDialog.takeOwnership')}}
        </v-btn>
      </div>
      <!-- <v-text-field
          v-model="dialog.data.name"
          @input="validateNewDirItemInput()"
          @keypress.enter="createDirItem()"
          :label="`New ${dialog.data.type} name`"
          ref="dirItemPermissionManagerDialogNameInput"
          :value="dialog.data.name"
          :error="!dialog.data.isValid"
          :hint="dialog.data.error"
          autofocus
        ></v-text-field> -->
    </template>
  </dialog-generator>
</template>

<script>
import {mapGetters, mapState} from 'vuex'

export default {
  watch: {
    'dialog.value' (value) {
      if (value) {
        this.dialog.data.dirItem = this.targetItems[0]
        this.dialog.data.permissionData.isImmutable = this.dialog.data.dirItem.isImmutable

        this.$store.dispatch('GET_DIR_ITEM_PERMISSION_DATA', {
          dirItem: this.dialog.data.dirItem,
        })
          .then((dirItemPermissionData) => {
            this.dialog.data.permissionData = dirItemPermissionData
          })

        this.$store.dispatch('GET_DIR_ITEM_USER_DATA', {
          dirItem: this.dialog.data.dirItem,
        })
          .then((userItems) => {
            this.dialog.data.user.unspecifiedItems.forEach(item => {
              userItems.unshift(item)
            })
            this.dialog.data.user.items = userItems
            this.dialog.data.user.selected = this.dialog.data.user.items[0]
          })
      }
    },
  },
  computed: {
    ...mapGetters([
      'systemInfo',
    ]),
    ...mapState({
      dialog: state => state.dialogs.dirItemPermissionManagerDialog,
      targetItems: state => state.contextMenus.dirItem.targetItems,
      storageData: state => state.storageData,
      protectedItems: state => state.storageData.protected.items,
    }),
    targetItemsIncludeProtected () {
      const someItemIsProtected = this.targetItems.every(selectedItem => {
        return this.protectedItems.some(protectedItem => protectedItem.path === selectedItem.path)
      })
      return someItemIsProtected
    },
    warningMessage () {
      const warning = this.$t('dialogs.dirItemPermissionManagerDialog.warning')
      const warningDescription = this.$t('dialogs.dirItemPermissionManagerDialog.warningDescription')
      return `⚠ <strong>${warning}:</strong> ${warningDescription}`
    },
  },
  methods: {
    getSudo () {
      return new Promise((resolve, reject) => {
        const isPOSIX = ['linux', 'darwin'].includes(this.systemInfo.platform)
        if (isPOSIX && this.storageData.settings.adminPrompt === 'built-in') {
          this.$store.dispatch('SUDO_PASSWORD_PROMPT').then((result) => resolve(result))
        }
        else {
          resolve({action: 'skip'})
        }
      })
    },
    setDirItemImmutableState () {
      this.getSudo()
        .then((result) => {
          if (result.action === 'enter' || result.action === 'skip') {
            const isImmutable = this.dialog.data.permissionData.isImmutable
            this.$store.dispatch('SET_DIR_ITEM_IMMUTABLE_STATE', {
              dirItem: this.dialog.data.dirItem,
              value: !isImmutable,
              adminPrompt: this.storageData.settings.adminPrompt,
              sudoPassword: result?.data?.inputs?.[0]?.model,
            })
            this.dialog.data.permissionData.isImmutable = !isImmutable
          }
        })
    },
  },
}
</script>

<style scoped>

</style>