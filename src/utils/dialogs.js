// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {i18n} from '../localization'

const dialogCreators = {
  trashProtected: createTrashProtectedDialog,
  trashCurrentDir: createTrashCurrentDirDialog,
  trashInRoot: createTrashInRootDialog,
  deleteProtected: createDeleteProtectedDialog,
  deleteIrreversibly: createDeleteIrreversiblyDialog,
  deleteCurrentDir: createDeleteCurrentDirDialog,
  deleteInRoot: createDeleteInRootDialog,
}

const cancelButton = {
  type: 'cancel',
  shortcut: 'esc',
  text: i18n.t('cancel'),
  onClick: (store, resolve) => {
    resolve({choice: 'cancel'})
    store.state.dialogs.confirmationDialog.value = false
  },
}

async function showDialog (store, params) {
  return new Promise((resolve, reject) => {
    const createDialogFunc = dialogCreators[params.name]
    if (!createDialogFunc) {
      reject(new Error(`Invalid dialog name: ${params.name}`))
      return
    }

    const dialog = createDialogFunc(store, params, resolve)
    store.state.dialogs.confirmationDialog.data = dialog
    store.state.dialogs.confirmationDialog.value = true
  })
}

function generateSimpleContentList (params) {
  return [
    {
      type: 'list',
      value: params?.items?.map(item => ({title: item.name, subtitle: item.path, dirItem: item})),
      showProtectedIndicator: params.showProtectedIndicator || false,
    },
  ]
}

function createTrashProtectedDialog (store, params, resolve) {
  return {
    name: 'trashProtected',
    params,
    persistent: false,
    maxWidth: '700px',
    height: '250px',
    title: i18n.t('dialogs.trashProtected.title'),
    titleIcon: 'mdi-shield-alert-outline',
    message: `
      <p>
        ${i18n.t('dialogs.trashProtected.description', {count: params?.protectedDirItems?.length})}
        ${i18n.t('dialogs.trashProtected.confirm')}
      </p>
    `,
    content: generateSimpleContentList(params),
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        text: i18n.t('dialogs.trashProtected.trashUnprotected'),
        shortcut: 'enter',
        onClick: () => {
          const unprotectedItems = [...params?.items].filter(item => {
            return !store.state.storageData.protected.items.some(protectedItem => {
              return protectedItem.path === item.path
            })
          })
          resolve({choice: 'trash-unprotected', items: unprotectedItems})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
      {
        text: i18n.t('dialogs.trashProtected.trashAll'),
        shortcut: 'shift+enter',
        onClick: () => {
          resolve({choice: 'trash-all', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

function createTrashCurrentDirDialog (store, params, resolve) {
  return {
    name: 'trashCurrentDir',
    params,
    persistent: false,
    height: '250px',
    title: i18n.t('dialogs.trashCurrentDir.title'),
    titleIcon: 'mdi-delete-forever-outline',
    message: `
      <p>
        ${i18n.t('dialogs.trashCurrentDir.description')}
        ${i18n.t('dialogs.trashCurrentDir.confirm')}
      </p>
    `,
    content: generateSimpleContentList(params),
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        type: 'confirm',
        shortcut: 'enter',
        text: i18n.t('dialogs.trashCurrentDir.trash'),
        onClick: () => {
          resolve({choice: 'trash', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

function createDeleteProtectedDialog (store, params, resolve) {
  let notProtectedDirItems = params?.items?.filter(item => !params.protectedDirItems.some(protectedItem => protectedItem.path === item.path))
  let sortedItems = [...params.protectedDirItems, ...notProtectedDirItems]
  return {
    name: 'deleteProtected',
    params,
    persistent: false,
    maxWidth: '700px',
    height: '250px',
    title: i18n.t('dialogs.deleteProtected.title'),
    titleIcon: 'mdi-shield-alert-outline',
    message: `
      <p>
        ${i18n.t('dialogs.deleteProtected.description', {count: params?.protectedDirItems?.length})}
        ${i18n.t('dialogs.deleteProtected.confirm')}
      </p>
    `,
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    content: generateSimpleContentList({...params, items: sortedItems, showProtectedIndicator: true}),
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        type: 'confirm',
        shortcut: 'enter',
        text: i18n.t('dialogs.deleteProtected.deleteUnprotected'),
        onClick: () => {
          const unprotectedItems = [...params?.items].filter(item => {
            return !store.state.storageData.protected.items.some(protectedItem => {
              return protectedItem.path === item.path
            })
          })
          resolve({choice: 'delete-unprotected', items: unprotectedItems})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
      {
        text: i18n.t('dialogs.deleteProtected.deleteAll'),
        shortcut: 'shift+enter',
        onClick: () => {
          resolve({choice: 'delete-all', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

function createDeleteIrreversiblyDialog (store, params, resolve) {
  return {
    name: 'deleteIrreversibly',
    params,
    persistent: false,
    height: '250px',
    title: i18n.t('dialogs.deleteIrreversibly.title'),
    titleIcon: 'mdi-delete-forever-outline',
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    content: [
      {
        type: 'html',
        value: `
          <p>
            ${i18n.t('dialogs.deleteIrreversibly.description', {count: params?.items?.length})}
            ${i18n.t('dialogs.deleteIrreversibly.confirm')}
          </p>
        `,
      },
      {
        type: 'list',
        value: params?.items?.map(item => ({title: item.name, subtitle: item.path, dirItem: item})),
      },
    ],
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        type: 'confirm',
        shortcut: 'enter',
        text: i18n.t('dialogs.deleteIrreversibly.delete'),
        onClick: () => {
          resolve({choice: 'delete', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

function createDeleteCurrentDirDialog (store, params, resolve) {
  return {
    name: 'deleteCurrentDir',
    params,
    persistent: false,
    height: '250px',
    title: i18n.t('dialogs.deleteCurrentDir.title'),
    titleIcon: 'mdi-delete-forever-outline',
    message: `
      <p>
        ${i18n.t('dialogs.deleteCurrentDir.description')}
        ${i18n.t('dialogs.deleteCurrentDir.confirm')}
      </p>
    `,
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    content: generateSimpleContentList(params),
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        type: 'confirm',
        shortcut: 'enter',
        text: i18n.t('dialogs.deleteCurrentDir.delete'),
        onClick: () => {
          resolve({choice: 'delete', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

function createTrashInRootDialog (store, params, resolve) {
  return {
    name: 'trashInRoot',
    params,
    persistent: false,
    height: '250px',
    title: i18n.t('dialogs.trashInRoot.title'),
    titleIcon: 'mdi-delete-forever-outline',
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    content: [
      {
        type: 'html',
        value: `
          <p>
            ${i18n.t('dialogs.trashInRoot.description')}
            ${i18n.t('dialogs.trashInRoot.confirm')}
          </p>
        `,
      },
      {
        type: 'list',
        value: params?.items?.map(item => ({title: item.name, subtitle: item.path, dirItem: item})),
      },
    ],
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        type: 'confirm',
        shortcut: 'enter',
        text: i18n.t('dialogs.trashInRoot.trash'),
        onClick: () => {
          resolve({choice: 'trash', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

function createDeleteInRootDialog (store, params, resolve) {
  return {
    name: 'deleteInRoot',
    params,
    persistent: false,
    height: '250px',
    title: i18n.t('dialogs.deleteInRoot.title'),
    titleIcon: 'mdi-delete-forever-outline',
    footerText: params?.conflictCount > 1
      ? `${i18n.t('conflict')} ${params?.currentConflict} / ${params?.conflictCount}`
      : '',
    content: [
      {
        type: 'html',
        value: `
          <p>
            ${i18n.t('dialogs.deleteInRoot.description')}
            ${i18n.t('dialogs.deleteInRoot.confirm')}
          </p>
        `,
      },
      {
        type: 'list',
        value: params?.items?.map(item => ({title: item.name, subtitle: item.path, dirItem: item})),
      },
    ],
    buttons: [
      {...cancelButton, onClick: () => cancelButton.onClick(store, resolve)},
      {
        type: 'confirm',
        shortcut: 'enter',
        text: i18n.t('dialogs.deleteInRoot.delete'),
        onClick: () => {
          resolve({choice: 'delete', items: params?.items})
          store.state.dialogs.confirmationDialog.value = false
        },
      },
    ],
  }
}

export default {
  showDialog,
}