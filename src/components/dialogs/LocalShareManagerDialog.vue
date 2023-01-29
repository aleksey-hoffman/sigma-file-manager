<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'localShareManagerDialog'}),
    }"
    :title="$t('dialogs.localShareManagerDialog.localShareManager')"
    max-width="50vw"
    fade-mask-bottom="0%"
  >
    <template #content>
      <v-layout>
        <v-tooltip
          bottom
          max-width="320px"
        >
          <template #activator="{ on }">
            <div
              id="qr-code"
              class="qr-code mr-6"
              v-on="on"
            />
          </template>
          <span>
            {{$t('dialogs.localShareManagerDialog.scanQRCore')}}
            <br />{{$t('dialogs.localShareManagerDialog.typeAddressManually')}}
          </span>
        </v-tooltip>
        <div>
          <p>
            {{$t('dialogs.localShareManagerDialog.toSeeSharedFiles')}}
          </p>
        </div>
      </v-layout>

      <div class="text--sub-title-1 mt-4">
        {{$t('dialogs.localShareManagerDialog.localServerAddress')}}
      </div>

      <!-- input:server-address -->
      <v-layout align-center>
        <v-text-field
          :value="
            dialog.data.shareType === 'file'
              ? `${localServer.fileShare.address}`
              : `${localServer.directoryShare.address}`
          "
          class="mt-0 pt-0"
          readonly
          single-line
          hide-details
        />
        <v-btn
          small
          depressed
          class="button-1 ml-3"
          @click="$utils.copyToClipboard({
            text: dialog.data.shareType === 'file'
              ? `${localServer.fileShare.address}`
              : `${localServer.directoryShare.address}`,
            title: $t('dialogs.localShareManagerDialog.addressCopiedToClipboard')
          })"
        >
          {{$t('copy')}}
        </v-btn>
      </v-layout>

      <!-- input-radio-group:share-type -->
      <div v-if="dialog.data.shareType === 'file'">
        <div class="text--sub-title-1 mt-4">
          {{$t('dialogs.localShareManagerDialog.shareType')}}
        </div>
        <v-radio-group
          v-model="localServer.fileShare.type"
          :mandatory="true"
          hide-details
          class="mt-0"
          @change="$eventHub.$emit('app:method', {
            method: 'initLocalFileShare'
          })"
        >
          <v-radio
            :label="$t('stream')"
            value="stream"
          />
          <v-radio
            :label="$t('download')"
            value="download"
          />
        </v-radio-group>
      </div>

      <div v-if="dialog.data.shareType === 'file'">
        <div class="text--sub-title-1 mt-4 mb-2">
          {{$t('dialogs.localShareManagerDialog.sharedFile')}}
        </div>
        <div class="mb-8">
          {{localServer.fileShare.item.path}}
        </div>
      </div>

      <div v-if="dialog.data.shareType === 'directory'">
        <div class="text--sub-title-1 mt-4 mb-2">
          {{$t('dialogs.localShareManagerDialog.sharedDirectory')}}
        </div>
        <div class="mb-8">
          {{localServer.directoryShare.item.path}}
        </div>
      </div>

      <v-tooltip top>
        <template #activator="{ on }">
          <v-layout
            align-center
            style="cursor: default"
            v-on="on"
          >
            {{$t('dialogs.localShareManagerDialog.doesnTWork')}}
            <v-icon
              class="ml-2"
              size="20px"
            >
              mdi-information-outline
            </v-icon>
          </v-layout>
        </template>
        <span>
          {{$t('dialogs.localShareManagerDialog.makeSurNetworkIsSetUp')}}
          <ul>
            <li>{{$t('dialogs.localShareManagerDialog.youShouldAllow')}}</li>
            <li>{{$t('dialogs.localShareManagerDialog.thisDeviceShouldBeDiscoverable')}}</li>
            <li>{{$t('dialogs.localShareManagerDialog.yourWifiRouterShouldNotHaveClientIsolation')}}</li>
          </ul>
        </span>
      </v-tooltip>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

export default {
  computed: {
    ...mapState({
      dialog: state => state.dialogs.localShareManagerDialog,
      localServer: state => state.localServer,
    }),
  },
}
</script>

<style scoped>

</style>