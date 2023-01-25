<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :persistent="true"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'errorDialog'}),
    }"
    :action-buttons="[
      {
        text: $t('dialogs.errorDialog.createTemplate'),
        onClick: () => createNewErrorIssue()
      },
      {
        text: $t('dialogs.errorDialog.reloadApp'),
        onClick: () => $utils.reloadMainWindow()
      },
      {
        text: $t('dialogs.errorDialog.ignore'),
        onClick: () => $store.dispatch('closeDialog', {name: 'errorDialog'})
      }
    ]"
    :title="$t('dialogs.errorDialog.errorOccured')"
    height="80vh"
  >
    <template #content>
      <p>
        {{$t('dialogs.errorDialog.youCanIgnoreError')}}
      </p>
      <div class="text--sub-title-1">
        {{$t('dialogs.errorDialog.reportError')}}
      </div>
      <p>
        {{$t('dialogs.errorDialog.ifYouHaveGithub')}}
      </p>
      <ul>
        <li>{{$t('dialogs.errorDialog.pressButtonToCreateIssueAutomatically')}}</li>
        <li>{{$t('dialogs.errorDialog.openGeneratedLink')}}</li>
        <li>{{$t('dialogs.errorDialog.reviewTemplate')}}</li>
        <li>{{$t('dialogs.errorDialog.publishIssue')}}</li>
      </ul>
      <div class="text--sub-title-1 mt-3">
        {{$t('dialogs.errorDialog.error')}}
      </div>
      <div class="code-block mb-8">
        {{errorDialogErrorMessage}}
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'

const sysInfo = require('systeminformation')
const os = require('os')

export default {
  computed: {
    ...mapState({
      appVersion: state => state.appVersion,
      appPaths: state => state.storageData.settings.appPaths,
      dialog: state => state.dialogs.errorDialog,
      appActionHistory: state => state.appActionHistory,
    }),
    errorDialogErrorMessage () {
      const stack = this.dialog?.data?.errorEvent?.error?.stack
      const message = this.dialog?.data?.errorEvent?.message
      return stack ?? message ?? 'No error message'
    },
    appActionHistoryLog () {
      let log = ''
      this.appActionHistory.forEach(action => {
        log += `${action.readableTime} | ${action.action}\n`
      })
      return log
    },
  },
  methods: {
    async createNewErrorIssue () {
      try {
        const title = '[Auto-generated problem report] unhandled error'
        const body = await this.generateBody()
        const link = this.generateLink(title, body)
        this.showSuccessNotification(link)
      }
      catch (error) {
        this.showErrorNotification(error)
      }
    },
    async generateBody () {
      return [
        '## System info:',
        `- **App version**: ${this.appVersion}`,
        `- **App page**: ${this.dialog?.data?.routeName ?? 'unknown'}`,
        `- **Operating System**: ${os.arch()}, ${process.platform}, ${os.release()}`,
        `- **Free memory**: ${this.$utils.prettyBytes((await sysInfo.mem()).free, 1) ?? 'unknown'}`,
        '## Problem:',
        '### Error:',
        '```js',
        // Automatically wrap the line after every 90 chars
        `${this.errorDialogErrorMessage.replace(/(.{1,90})/g, '$1\n')
        }`,
        '```',
        '### App action history:',
        '```js',
        this.appActionHistoryLog,
        '```',
      ].join('\n')
    },
    generateLink (title, body) {
      return [
        `https://www.github.com/${this.appPaths.githubRepo}/`,
        'issues/new?',
        'labels=unhandledError&',
        `title=${encodeURIComponent(title)}&`,
        `body=${encodeURIComponent(body)}`,
      ].join('\n')
    },
    showSuccessNotification (link) {
      this.$eventHub.$emit('notification', {
        action: 'add',
        timeout: 0,
        closeButton: true,
        colorStatus: 'green',
        title: this.$t('dialogs.errorDialog.errorTemplateLinkWasGenerated'),
        message: this.$t('dialogs.errorDialog.openTheLinkInYourBrowserToContinue'),
        actionButtons: [
          {
            title: this.$t('dialogs.errorDialog.copyLink'),
            action: '',
            onClick: () => {
              this.$utils.copyToClipboard({
                text: link,
                title: this.$t('dialogs.errorDialog.linkWasCopiedToClipboard'),
              })
            },
            closesNotification: false,
          },
          {
            title: this.$t('dialogs.errorDialog.openLinkInDefaultBrowser'),
            action: '',
            onClick: () => {
              this.$utils.openLink(link)
            },
            closesNotification: false,
          },
        ],
      })
    },
    showErrorNotification (error) {
      this.$eventHub.$emit('notification', {
        action: 'add',
        timeout: 5000,
        closeButton: true,
        title: this.$t('dialogs.errorDialog.operationFailed'),
        message: `${this.$t('dialogs.errorDialog.errorDuringTemplateGeneration')}:<br>${error}`,
      })
    },
  },
}
</script>

<style scoped>
.dialog__button-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding-bottom: 12px;
}

.dialog__button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 200px;
  background-color: rgba(255, 255, 255, 0.02);
  border-radius: 8px;
  cursor: pointer;
}

.dialog__button:hover {
  background-color: rgba(255, 255, 255, 0.03);
}

#app
  .dialog__button
    .v-icon {
      margin-bottom: 16px;
      opacity: 0.5;
    }
</style>