<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div />
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import * as notifications from '../utils/notifications.js'

const childProcess = require('child_process')
const getPort = require('get-port')
const net = require('net')
const qrCode = require('qrcode')

let express
let expressServer

export default {
  mounted () {
    this.$eventHub.$on('fsLocalServerManager:method', payload => {
      this[payload.method](payload.params)
    })
  },
  computed: {
    ...mapGetters([
      'selectedDirItems',
    ]),
    ...mapFields({
      firstTimeActions: 'storageData.settings.firstTimeActions',
      dialogs: 'dialogs',
      targetItems: 'contextMenus.dirItem.targetItems',
      localServer: 'localServer',
      fileShareIp: 'localServer.fileShare.ip',
      fileSharePort: 'localServer.fileShare.port',
      fileShareType: 'localServer.fileShare.type',
      fileShareItems: 'localServer.fileShare.items',
      directoryShareIp: 'localServer.directoryShare.ip',
      directorySharePort: 'localServer.directoryShare.port',
    }),
  },
  methods: {
    async showFirstTimeLocalSharePermissionsDialog () {
      return new Promise((resolve, reject) => {
        this.$store.dispatch('confirmationDialog', {
          data: {
            title: this.$t('dialogs.confirmationDialog.localSharingFirewall.firewallPermissions'),
            message: `
              <p>${this.$t('dialogs.confirmationDialog.localSharingFirewall.localSharingFeatureAllows')}</p>
              <p>${this.$t('dialogs.confirmationDialog.localSharingFirewall.toUseLocalSharing')}</p>
            `,
            closeButton: {
              onClick: () => {
                resolve({action: 'cancel'})
                this.$store.state.dialogs.confirmationDialog.value = false
              },
            },
            buttons: [
              {
                text: this.$t('cancel'),
                onClick: () => {
                  resolve({action: 'cancel'})
                  this.$store.state.dialogs.confirmationDialog.value = false
                },
              },
              {
                text: this.$t('ok'),
                onClick: () => {
                  resolve({action: 'ok'})
                  this.$store.state.dialogs.confirmationDialog.value = false
                  this.$store.dispatch('SET', {
                    key: 'storageData.settings.firstTimeActions.localShare',
                    value: false,
                  })
                },
              },
            ],
          },
        })
      })
    },
    async handleFirstTimeLocalSharePermissions () {
      if (this.firstTimeActions.localShare) {
        const result = await this.showFirstTimeLocalSharePermissionsDialog()
        if (result.action === 'cancel') {
          throw Error('cancel')
        }
      }
    },
    importExpress () {
      if (express === undefined) {express = require('express')}
      if (expressServer === undefined) {expressServer = express()}
    },
    stopLocalDirectoryShareServer () {
      try {
        this.$store.state.childProcesses.localDirectoryShareServer.kill()
        clearInterval(this.$store.state.intervals.localDirectoryShareServerSelfDistruction)
      }
      catch (error) {}
    },
    stopLocalFileShareServer () {
      try {
        this.$store.state.childProcesses.localFileShareServer.kill()
        clearInterval(this.$store.state.intervals.localFileShareServerSelfDistruction)
      }
      catch (error) {}
    },
    scheduleLocalDirectoryShareServerSelfDistruct () {
      try {
        this.$store.state.childProcesses.localDirectoryShareServer.send({
          action: 'reset-signal::self-distruct',
        })
      }
      catch (error) {}
      clearInterval(this.$store.state.intervals.localDirectoryShareServerSelfDistruction)
      this.$store.state.intervals.localDirectoryShareServerSelfDistruction = setInterval(() => {
        try {
          this.$store.state.childProcesses.localDirectoryShareServer.send({
            action: 'reset-signal::self-distruct',
          })
        }
        catch (error) {}
      }, 10000)
    },
    scheduleLocalFileShareServerSelfDistruct () {
      try {
        this.$store.state.childProcesses.localFileShareServer.send({
          action: 'reset-signal::self-distruct',
        })
      }
      catch (error) {}
      clearInterval(this.$store.state.intervals.localFileShareServerSelfDistruction)
      this.$store.state.intervals.localFileShareServerSelfDistruction = setInterval(() => {
        try {
          this.$store.state.childProcesses.localFileShareServer.send({
            action: 'reset-signal::self-distruct',
          })
        }
        catch (error) {}
      }, 10000)
    },
    initLocalFileShareServerProcess (path) {
      this.$store.state.childProcesses.localFileShareServer = childProcess.fork(
        this.$utils.getSrc('./src/workers/localFileShareServerWorker.js'),
      )
      this.$store.state.childProcesses.localFileShareServer.send({
        action: 'start-server',
        path,
        fileShareType: this.fileShareType,
        fileSharePort: this.fileSharePort,
      })
      this.scheduleLocalFileShareServerSelfDistruct()
    },
    initLocalDirectoryShareServerProcess (path) {
      this.$store.state.childProcesses.localDirectoryShareServer = childProcess.fork(
        this.$utils.getSrc('./src/workers/localDirectoryShareServerWorker.js'),
      )
      this.$store.state.childProcesses.localDirectoryShareServer.send({
        action: 'start-server',
        path,
        __static: __static,
        utils: this.$utils,
        directorySharePort: this.directorySharePort,
      })
      this.scheduleLocalDirectoryShareServerSelfDistruct()
    },
    async setLocalDirectoryShareData () {
      this.dialogs.localShareManagerDialog.value = true
      this.dialogs.localShareManagerDialog.data.shareType = 'directory'
      this.localServer.directoryShare.item = this.selectedDirItems.at(-1)
      this.directoryShareIp = await this.getLocalIPv4()
      this.directorySharePort = await getPort({port: getPort.makeRange(55000, 55999)})
      this.localServer.directoryShare.address = `${this.directoryShareIp}:${this.directorySharePort}/ftp`
      return this.selectedDirItems.at(-1).path
    },
    async setLocalFileShareData () {
      this.dialogs.localShareManagerDialog.value = true
      this.dialogs.localShareManagerDialog.data.shareType = 'file'
      this.localServer.fileShare.item = this.targetItems.at(-1)
      this.fileShareIp = await this.getLocalIPv4()
      this.fileSharePort = await getPort({port: getPort.makeRange(56000, 56999)})
      this.localServer.fileShare.address = `${this.fileShareIp}:${this.fileSharePort}`
      return this.targetItems.at(-1).path
    },
    async initLocalDirectoryShare () {
      try {
        await this.handleFirstTimeLocalSharePermissions()
        await this.stopLocalDirectoryShareServer()
        let path = await this.setLocalDirectoryShareData()
        this.serveDirectoryLocally(path)
        notifications.emit({
          name: 'localFileServer',
          props: {
            stopLocalDirectoryShareServer: this.stopLocalDirectoryShareServer,
            dialogs: this.dialogs,
            utils: this.$utils,
            localServer: this.localServer,
          },
        })
      }
      catch (error) {
        if (error !== 'cancel') {
          throw Error(error)
        }
      }
    },
    async initLocalFileShare () {
      try {
        await this.handleFirstTimeLocalSharePermissions()
        await this.stopLocalFileShareServer()
        let path = await this.setLocalFileShareData()
        this.serveFilesLocally(path)
        notifications.emit({
          name: 'localDirectoryServer',
          props: {
            stopLocalFileShareServer: this.stopLocalFileShareServer,
            dialogs: this.dialogs,
            utils: this.$utils,
            localServer: this.localServer,
          },
        })
      }
      catch (error) {
        if (error !== 'cancel') {
          throw Error(error)
        }
      }
    },
    getLocalIPv4 () {
      // TODO:
      // - When offline, will throw:
      //   "Error: getaddrinfo ENOTFOUND www.google.com"
      //   And local file share will not be accessible.
      //   To fix use another method for detecting ipv4 address.
      return new Promise((resolve, reject) => {
        const socket = net.createConnection(80, 'www.google.com')
        socket.on('connect', () => {
          resolve(socket.address().address)
          socket.end()
        })
        socket.on('error', (error) => {
          reject(error)
        })
      })
    },
    serveDirectoryLocally (path) {
      this.generateQrCode({
        container: document.querySelector('#qr-code'),
        content: this.localServer.directoryShare.address,
      })
      this.importExpress()
      this.initLocalDirectoryShareServerProcess(path)
    },
    serveFilesLocally (path) {
      this.generateQrCode({
        container: document.querySelector('#qr-code'),
        content: `${this.fileShareIp}:${this.fileSharePort}`,
      })
      this.importExpress()
      this.initLocalFileShareServerProcess(path)
    },
    generateQrCode (options) {
      const defaultOptions = {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 96,
        height: 96,
      }
      options = {...defaultOptions, ...options}
      qrCode.toCanvas(options.content, options, (error, canvas) => {
        if (error) {throw error}
        while (options.container.firstChild) {
          options.container.removeChild(options.container.firstChild)
        }
        options.container.appendChild(canvas)
      })
    },
  },
}
</script>