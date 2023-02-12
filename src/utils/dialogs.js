// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

async function showDialog (store, params) {
  return new Promise((resolve, reject) => {
    let dialogs = [
      {
        name: 'trashDirItemsContainsProtected',
        title: 'Attention: sending protected items to trash',
        titleIcon: 'mdi-shield-alert-outline',
        message: `
					Selected items contain ${params?.protectedEditTargetItems?.length} protected items
					`,
        closeButton: {
          onClick: () => {
            reject({status: 'cancel'})
            store.state.dialogs.confirmationDialog.value = false
          },
        },
        buttons: [
          {
            text: 'cancel',
            onClick: () => {
              reject({status: 'cancel'})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'delete unprotected',
            onClick: () => {
              const unprotectedEditTargetItems = [...params?.items].filter(item => {
                return !store.state.storageData.protected.items.some(protectedItem => {
                  return protectedItem.path === item.path
                })
              })
              resolve({status: 'delete-unprotected', items: unprotectedEditTargetItems})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'delete all',
            onClick: () => {
              resolve({status: 'delete-all', items: params?.items})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
        ],
      },
      {
        name: 'deleteDirItemsContainsProtected',
        title: 'Attention: deleting protected items',
        titleIcon: 'mdi-shield-alert-outline',
        message: `
					Selected items contain ${params?.protectedEditTargetItems?.length} protected items
				`,
        closeButton: {
          onClick: () => {
            reject({status: 'cancel'})
            store.state.dialogs.confirmationDialog.value = false
          },
        },
        buttons: [
          {
            text: 'cancel',
            onClick: () => {
              reject({status: 'cancel'})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'delete unprotected',
            onClick: () => {
              const unprotectedEditTargetItems = [...params?.items].filter(item => {
                return !store.state.storageData.protected.items.some(protectedItem => {
                  return protectedItem.path === item.path
                })
              })
              resolve({status: 'delete-unprotected', items: unprotectedEditTargetItems})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'delete all',
            onClick: () => {
              resolve({status: 'delete-all', items: params?.items})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
        ],
      },
      {
        name: 'trashDirItemsContainsCurrentDir',
        height: '220px',
        title: 'Attention: deleting items in drive root',
        titleIcon: 'mdi-delete-forever-outline',
        message: `
				You are about to delete a file / directory located
				in the root of a drive. Make sure these are your personal files and you are not deleting
				any system files, otherwise your computer might become unusable.
				`,
        closeButton: {
          onClick: () => {
            reject({status: 'cancel'})
            store.state.dialogs.confirmationDialog.value = false
          },
        },
        buttons: [
          {
            text: 'cancel',
            onClick: () => {
              reject({status: 'cancel'})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'confirm delete',
            onClick: () => {
              resolve({status: 'success:confirm-delete', items: params?.items})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
        ],
      },
      {
        name: 'deleteDirItems',
        height: '220px',
        title: 'Attention: deleting items from drive',
        titleIcon: 'mdi-delete-forever-outline',
        content: [
          {
            type: 'html',
            value: `
							This operation will permanently delete ${params?.items?.length} items from your computer:
						`,
          },
          {
            type: 'list',
            value: params?.items.map(item => item.path),
          },
        ],
        closeButton: {
          onClick: () => {
            reject({status: 'cancel'})
            store.state.dialogs.confirmationDialog.value = false
          },
        },
        buttons: [
          {
            text: 'cancel',
            onClick: () => {
              reject({status: 'cancel'})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'confirm delete',
            onClick: () => {
              resolve({status: 'delete-all', items: params?.items})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
        ],
      },
      {
        name: 'deleteDirItemsIncludesItemLocatedInRoot',
        height: '300px',
        title: 'Attention: deleting items in drive root',
        titleIcon: 'mdi-delete-forever-outline',
        content: [
          {
            type: 'html',
            value: `
							You are about to delete a file / directory located
							in the root of a drive. Make sure these are your personal files and you are not deleting
							any system files, otherwise your computer might become unusable:
						`,
          },
          {
            type: 'list',
            value: params?.items.map(item => item.path),
          },
        ],
        closeButton: {
          onClick: () => {
            reject({status: 'cancel'})
            store.state.dialogs.confirmationDialog.value = false
          },
        },
        buttons: [
          {
            text: 'cancel',
            onClick: () => {
              reject({status: 'cancel'})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'confirm delete',
            onClick: () => {
              resolve({status: 'delete-all', items: params?.items})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
        ],
      },
      {
        name: 'deleteDirItemsIncludesCurrentDir',
        height: '220px',
        title: 'Attention: deleting current directory',
        titleIcon: 'mdi-delete-forever-outline',
        message: `
					You are about to delete the currently opened directory:
					<br>
					${params?.itemsList}
				`,
        list: params?.itemsList,
        closeButton: {
          onClick: () => {
            reject({status: 'cancel'})
            store.state.dialogs.confirmationDialog.value = false
          },
        },
        buttons: [
          {
            text: 'cancel',
            onClick: () => {
              reject({status: 'cancel'})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
          {
            text: 'confirm delete',
            onClick: () => {
              resolve({status: 'delete-all', items: params?.items})
              store.state.dialogs.confirmationDialog.value = false
            },
          },
        ],
      },
    ]

    store.state.dialogs.confirmationDialog.data = dialogs.find(dialog => dialog.name === params?.name)
    store.state.dialogs.confirmationDialog.value = true
  })
}

module.exports = {
  showDialog,
}