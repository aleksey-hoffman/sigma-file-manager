// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import sharedUtils from './sharedUtils.js'
const eventHub = require('./eventHub').eventHub

/** 
* @param {object} params
* @returns {object}
*/
function getNotification (params) {
  let notifications = {
    copyTextToClipboard: {
      action: 'update-by-type',
      type: 'copyTextToClipboard',
      timeout: 2000,
      closeButton: true,
      icon: 'mdi-clipboard-text-multiple-outline',
      title: params?.props?.title,
      message: params?.props?.message,
    },
    copyTextToClipboardError: {
      action: 'update-by-type',
      type: 'copyTextToClipboardError',
      timeout: 5000,
      closeButton: true,
      colorStatus: 'red',
      icon: 'mdi-clipboard-text-multiple-outline',
      title: 'Error during copying',
      message: `
        Cannot copy specified value as text.
        <br>Data type: <span class="inline-code--light">${typeof params?.props?.text}</span>
      `,
    },
    copyDirItemsInProgress: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'copyDirItemsInProgress',
      icon: 'mdi-progress-clock',
      colorStatus: 'blue',
      closeButton: true,
      timeout: 0,
      title: 'In progress: copying items'
    },
    copyDirItemsSuccess: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'copyDirItemsSuccess',
      colorStatus: 'green',
      icon: '',
      closeButton: true,
      timeout: 3000,
      title: `Copied ${params?.props?.items} items`
    },
    moveDirItemsInProgress: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'moveDirItemsInProgress',
      icon: 'mdi-progress-clock',
      colorStatus: 'blue',
      closeButton: true,
      timeout: 0,
      title: 'In progress: moving items'
    },
    moveDirItemsSuccess: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'moveDirItemsSuccess',
      colorStatus: 'green',
      icon: '',
      closeButton: true,
      timeout: 3000,
      title: `Moved ${params?.props?.items} items`
    },
    transferDirItemsError: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'transferDirItemsError',
      icon: 'mdi-progress-close',
      colorStatus: 'red',
      closeButton: true,
      timeout: 5000,
      title: 'Error during transfer',
      error: params?.props?.error
    },
    renameFailedNoLongerExists: {
      action: 'add',
      colorStatus: 'red',
      timeout: 6000,
      closeButton: true,
      title: 'Failed to rename item',
      message: `
        File / directory that you are renaming no longer exists:
        <br><strong>Path:</strong> ${params?.props?.oldPath}
      `
    },
    renameFailedError: {
      action: 'add',
      colorStatus: 'red',
      timeout: 6000,
      closeButton: true,
      title: 'Failed to rename item',
      error: params?.props?.error
    },
    renameFailedAlreadyExistsOrLocked: {
      action: 'add',
      colorStatus: 'red',
      timeout: 5000,
      closeButton: true,
      title: 'Failed to rename item',
      message: `
        Item with that name already exists or locked by another program:
        <br>${params?.props?.newName}
      `
    },
    renameSuccess: {
      action: 'add',
      colorStatus: 'green',
      timeout: 3000,
      closeButton: true,
      title: 'Rename undone',
      message: ''
    },
    tabRemoved: {
      action: 'update-by-type',
      type: 'tabRemoved',
      timeout: 3000,
      closeButton: true,
      title: 'Removed tab from current workspace',
      message: `${params?.props?.tabPath}`
    },
    tabAdded: {
      action: 'update-by-type',
      type: 'tabAdded',
      timeout: 3000,
      closeButton: true,
      title: 'Tab added to current workspace',
      message: `
        Shortcut to open: 
        <span class="inline-code--light">${params?.props?.tabShortcut}</span>
      `
    },
    tabIsAlreadyOpened: {
      action: 'update-by-type',
      type: 'tabIsAlreadyOpened',
      timeout: 5000,
      closeButton: true,
      title: 'Tab for this directory is already opened',
      message: `
        Position: ${params?.props?.tabIndex}
      `
    },
    closedAllTabsInCurrentWorkspace: {
      action: 'update-by-type',
      type: 'closedAllTabsInCurrentWorkspace',
      timeout: 3000,
      closeButton: true,
      title: 'Closed all tabs in current workspace'
    },
    currentWorkspaceHasNoTabs: {
      action: 'update-by-type',
      type: 'currentWorkspaceHasNoTabs',
      timeout: 3000,
      closeButton: true,
      title: 'Current workspace has no tabs'
    },
    archiveAddDataError: {
      action: 'update-by-type',
      type: 'archiveAddDataError',
      timeout: 5000,
      title: 'Error: cannot add data to the archive',
      error: params?.props?.error
    },
    archiveExtractionError: {
      action: 'update-by-type',
      type: 'archiveExtractionError',
      timeout: 2000,
      title: 'Error: cannot extract archive',
      error: params?.props?.error
    },
    archiveExtractionCanceled: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveExtractionCanceled',
      timeout: 3000,
      actionButtons: [],
      colorStatus: 'red',
      title: 'Archive extraction canceled'
    },
    archiveCreationCanceled: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveCreationCanceled',
      timeout: 3000,
      actionButtons: [],
      colorStatus: 'red',
      title: 'Archive creation canceled'
    },
    archiveWasCreated: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveWasCreated',
      timeout: 5000,
      actionButtons: [],
      colorStatus: 'green',
      title: 'Archive was created',
      message: `
        Done • ${params?.props?.progress?.fileCount} files
        <br><strong>Destination:</strong> ${params?.props?.params?.dest}
      `,
    },
    archiveWasExtracted: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveWasExtracted',
      timeout: 5000,
      actionButtons: [],
      colorStatus: 'green',
      title: 'Archive was extracted',
      message: `
        Done • ${params?.props?.progress?.fileCount} files
        <br><strong>Destination:</strong> ${params?.props?.params?.dest}
      `,
    },
    archiveCreationProgress: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      progress: params?.props?.progress,
      timeout: 0,
      title: 'Creating archive',
      message: `
        ${params?.props?.progress?.percent}% • 
        ${params?.props?.progress?.fileCount} files
        <br><strong>Source:</strong> ${params?.props?.params?.source}
        <br><strong>Destination:</strong> ${params?.props?.params?.dest}
      `,
      actionButtons: [
        {
          title: 'cancel',
          onClick: () => {
            params?.props?.archiveStream?._childProcess.kill()
            params.props.archiveState.isCanceled = true
          }
        }
      ]
    },
    archiveExtractionProgress: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      progress: params?.props?.progress,
      timeout: 0,
      title: 'Extracting archive',
      message: `
        ${params?.props?.progress?.percent}% • 
        ${params?.props?.progress?.fileCount} files
        <br><strong>Source:</strong> ${params?.props?.params?.source}
        <br><strong>Destination:</strong> ${params?.props?.params?.dest}
      `,
      actionButtons: [
        {
          title: 'cancel',
          onClick: () => {
            params?.props?.archiveStream?._childProcess.kill()
            params.props.archiveState.isCanceled = true
          }
        }
      ]
    },
    cannotDeleteDriveRootDir: {
      action: 'update-by-type',
      type: 'cannotDeleteDriveRootDir',
      icon: 'mdi-delete-forever-outline',
      timeout: 3000,
      title: `You cannot delete drive's root directory`
    },
    trashItemsSuccess: {
      action: 'update-by-type',
      type: 'trashItemsSuccess',
      icon: 'mdi-trash-can-outline',
      colorStatus: 'green',
      timeout: 5000,
      title: `All items were trashed`,
      message: `
        <strong>Trashed items:</strong> 
        ${params?.props?.removedItems?.length}
        <br><strong>Trashed items size:</strong> 
        ${params?.props?.removedItemsSize}
      `,
    },
    deleteItemsSuccess: {
      action: 'update-by-type',
      type: 'deleteItemsSuccess',
      icon: 'mdi-delete-forever-outline',
      colorStatus: 'green',
      timeout: 5000,
      title: `All items were deleted`,
      message: `
        <strong>Deleted items:</strong> 
        ${params?.props?.removedItems?.length}
        <br><strong>Deleted items size:</strong> 
        ${params?.props?.removedItemsSize}
      `,
    },
    trashItemsError: {
      action: 'update-by-type',
      type: 'trashItemsError',
      icon: 'mdi-trash-can-outline',
      colorStatus: 'red',
      timeout: 5000,
      title: `Error: trash items`
    },
    deleteItemsError: {
      action: 'update-by-type',
      type: 'deleteItemsError',
      icon: 'mdi-delete-forever-outline',
      colorStatus: 'red',
      timeout: 5000,
      title: `Error: delete items`
    },
    trashItemsFailure: {
      action: 'update-by-type',
      type: 'trashItemsFailure',
      icon: 'mdi-trash-can-outline',
      colorStatus: 'red',
      timeout: 10000,
      closeButton: true,
      title: `Failed to trash some items`,
      message: `
        <strong>Trashed items:</strong> 
        <span class="inline-code--light py-0">
          ${params?.props?.items?.length}
          of 
          ${params?.props?.notRemovedItems?.length}
        </span>
        <br><strong>Deleted items size:</strong>
        <span class="inline-code--light py-0">
          ${params?.props?.removedItemSize}
        </span>
        <br><strong>Could not trash:</strong>
        <span class="inline-code--light py-0">
          ${params?.props?.notRemovedItems?.length} items:
        </span>
        <br>${params?.props?.notRemovedItems?.join('<br>')}
      `,
    },
    deleteItemsFailure: {
      action: 'update-by-type',
      type: 'deleteItemsFailure',
      icon: 'mdi-delete-forever-outline',
      colorStatus: 'red',
      timeout: 10000,
      closeButton: true,
      title: `Failed to delete some items`,
      message: `
        <strong>Deleted items:</strong> 
        <span class="inline-code--light py-0">
          ${params?.props?.removedItems?.length}
          of 
          ${params?.props?.items?.length}
        </span>
        <br><strong>Deleted items size:</strong>
        <span class="inline-code--light py-0">
          ${params?.props?.removedItemSize}
        </span>
        <br><strong>Could not delete:</strong>
        <span class="inline-code--light py-0">
          ${params?.props?.notRemovedItems?.length} items:
        </span>
        <br>${params?.props?.notRemovedItems?.join('<br>')}
      `,
    },
    noteWasTrashed: {
      action: 'add',
      actionButtons: [
        {
          title: 'Undo',
          action: 'undoTrashNote',
          closesNotification: true
        }
      ],
      closeButton: true,
      timeout: 10000,
      title: 'Note was trashed',
      message: 'Switch to "trashed notes" list to see all trashed notes'
    },
    removedFromPinnedSuccess: {
      action: 'update-by-type',
      type: 'removedFromPinnedSuccess',
      timeout: 2000,
      closeButton: true,
      title: `Removed ${params?.props?.itemCounter} items from pinned`,
    },
    addedToPinnedSuccess: {
      action: 'update-by-type',
      type: 'addedToPinnedSuccess',
      timeout: 2000,
      closeButton: true,
      title: `Added ${params?.props?.itemCounter} items to pinned`,
    },
    removedFromProtectedSuccess: {
      action: 'update-by-type',
      type: 'removedFromProtectedSuccess',
      timeout: 2000,
      closeButton: true,
      title: `Removed ${params?.props?.itemCounter} items from protected`,
    },
    addedToProtectedSuccess: {
      action: 'update-by-type',
      type: 'addedToProtectedSuccess',
      timeout: 2000,
      closeButton: true,
      title: `Added ${params?.props?.itemCounter} items to protected`,
    },
    actionNotAllowedWhenInputFieldIsActive: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: 'Action failed',
      message: 'Action is not allowed when input field is active'
    },
    actionNotAllowedWhenDialogIsOpened: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: 'Action failed',
      message: 'Action is not allowed when a dialog is opened'
    },
    actionFailedNoDirItemsSelected: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: 'Action failed',
      message: 'No directory items are selected'
    },
    actionNotAllowedOnThisPage: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: 'Action failed',
      message: 'Action is not allowed on this page'
    },
    increaseUIZoom: {
      action: 'update-by-type',
      type: 'UIZoomChange',
      timeout: 2000,
      title: `UI scale changed: ${params?.props?.newZoomFactor}%`
    },
    decreaseUIZoom: {
      action: 'update-by-type',
      type: 'UIZoomChange',
      timeout: 2000,
      title: `UI scale changed: ${params?.props?.newZoomFactor}%`
    },
    resetUIZoom: {
      action: 'update-by-type',
      type: 'UIZoomChange',
      timeout: 2000,
      title: `UI scale changed: 100%`
    },
    directoryWasReloaded: {
      action: 'update-by-type',
      type: 'directoryWasReloaded',
      timeout: 2000,
      title: 'Directory was reloaded',
      message: `<strong>Directory:</strong> ${params?.props?.currentDirPath}`
    },
    setDirItemPermissionsSuccess: {
      action: 'update-by-type',
      type: 'setDirItemPermissionsSuccess',
      timeout: 3000,
      closeButton: true,
      title: 'Permissions were changed',
    },
    setDirItemPermissionsFailure: {
      action: 'update-by-type',
      type: 'setDirItemPermissionsFailure',
      timeout: 3000,
      closeButton: true,
      title: 'Failed to change permissions',
      error: params?.props?.error
    },
    updateUnavailable: {
      action: 'update-by-type',
      type: 'updateUnavailable',
      timeout: 5000,
      colorStatus: 'blue',
      isPinned: true,
      removeWhenHidden: false,
      title: 'No updates available',
      message: `
        <strong>Current version:</strong> ${params?.props?.state?.appVersion}
        <br><strong>Latest version:</strong> ${params?.props?.latestVersion}
      `,
      closeButton: true,
      actionButtons: [
        {
          title: 'Project page',
          action: '',
          extrnalLink: params?.props?.state?.appPaths?.githubRepoLink,
          onClick: () => {
            params?.props?.utils.openLink(params?.props?.state?.appPaths?.githubRepoLink)
          },
          closesNotification: false
        }
      ]
    },	
    updateWasDownloaded: {
      action: 'add',
      type: 'updateWasDownloaded',
      colorStatus: 'blue',
      isPinned: true,
      isUpdate: true,
      removeWhenHidden: false,
      timeout: 0,
      title: `Update downloaded: v${params?.props?.latestVersion}`,
      message: 'Press install to close the app and update it',
      closeButton: true,
      actionButtons: [
        {
          title: 'install update',
          action: '',
          onClick: () => {
            let updateFileDownloadDir = params?.props?.store?.state?.appPaths?.updateDownloadDir
            let updateFileName = params?.props?.info?.filename
            let updateFilePath = `${updateFileDownloadDir}/${updateFileName}`
            params?.props?.store?.dispatch('OPEN_FILE', updateFilePath)
          },
          closesNotification: true
        },
        {
          title: 'show in directory',
          action: 'showDownloadedFile',
          closesNotification: false,
          onClick: () => {
            params?.props?.store?.dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', {
              dir: params?.props?.info?.dir, 
              itemPath: params?.props?.info?.filePath
            })
          }
        }
      ]
    },
    removeAppThumbsDirSuccess: {
      action: 'update-by-type',
      type: 'removeAppThumbsDirSuccess',
      timeout: 20000,
      colorStatus: 'green',
      closeButton: true,
      title: 'Storage limit for image thumbnails was reached',
      message: `
        All previously created image thumbnails were deleted. 
        <strong>Thumbnail storage limit:</strong> ${params?.props?.thumbDirSizeLimit}
      `,
    },
    removeAppThumbsDirError: {
      action: 'update-by-type',
      type: 'removeAppThumbsDirError',
      timeout: 20000,
      colorStatus: 'red',
      closeButton: true,
      title: 'Storage limit for image thumbnails was reached',
      message: `
        Error: could not delete existing image thumbnails.
        <br>You can try to delete them manually:
        <br><strong>Thumbnail directory:</strong> 
        <br>${params?.props?.thumbDirPath}
        <br><strong>Error:</strong>
        <br>${params?.props?.error}
      `
    },
    localFileServer: {
      action: 'update-by-type',
      type: 'localFileServer',
      closeButton: false,
      timeout: 0,
      colorStatus: 'green',
      title: 'Directory is now accessible from local devices',
      message: `Address: ${params?.props?.localServer?.directoryShare?.address}`,
      actionButtons: [
        {
          title: 'stop server',
          onClick: () => {
            params?.props?.stopLocalDirectoryShareServer()
            params.props.dialogs.localShareManagerDialog.value = false
          },
          closesNotification: true
        },
        {
          title: 'copy address',
          onClick: () => {
            params?.props?.utils?.copyToClipboard({
              text: params?.props?.localServer?.directoryShare?.address,
              title: 'Address was copied to clipboard'
            })
          },
          closesNotification: false
        }
      ]
    },
    localDirectoryServer: {
      action: 'update-by-type',
      type: 'localDirectoryServer',
      closeButton: false,
      timeout: 0,
      colorStatus: 'green',
      title: 'Local file share is active',
      message: `Address: ${params?.props?.localServer?.fileShare?.address}`,
      actionButtons: [
        {
          title: 'stop server',
          onClick: () => {
            params?.props?.stopLocalFileShareServer()
            params.props.dialogs.localShareManagerDialog.value = false
          },
          closesNotification: true
        },
        {
          title: 'copy address',
          onClick: () => {
            params?.props?.utils?.copyToClipboard({
              text: params?.props?.localServer?.fileShare?.address,
              title: 'Address was copied to clipboard'
            })
          },
          closesNotification: false
        }
      ]
    },
    quickViewFileIsNotSupported: {
      action: 'update-by-type',
      type: 'quickViewFileIsNotSupported',
      closeButton: true,
      timeout: 3000,
      title: 'Quick view: file is not supported',
      message: params?.props?.data?.path?.replace('file:///', '')
    },
    driveWasConnected: {
      action: 'update-by-type',
      type: 'driveWasConnected',
      timeout: 3000,
      colorStatus: 'green',
      title: 'Drive was connected',
      closeButton: true
    },
    searchFileIsDamaged: {
      action: 'update-by-type',
      type: 'searchFileIsDamaged',
      timeout: 8000,
      closeButton: true,
      colorStatus: 'red',
      title: 'Drive scan initiated',
      message: 'One of the search files is damaged'
    },
    cannotOpenDirItem: {
      action: 'update-by-type',
      type: 'cannotOpenDirItem',
      timeout: 7000,
      title: 'Cannot open this item',
      message: `
        <strong>Reason:</strong> item has immutable or read-only attributes.
        <br>You can reset item permissions in the "permissions" menu.
      `
    },
    cannotOpenPathFromClipboard: {
      action: 'update-by-type',
      type: 'cannotOpenPathFromClipboard',
      timeout: 6000,
      title: 'Cannot open path from clipboard',
      message: '<strong>Reason:</strong> path does not exist on the drive.'
    },
    openedPathFromClipboard: {
      action: 'update-by-type',
      type: 'openedPathFromClipboard',
      timeout: 2000,
      title: 'Opened path from clipboard',
      message: params?.props?.osClipboardText
    },
    programWasAdded: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      colorStatus: 'green',
      title: 'Program was added'
    },
    programWasEdited: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      colorStatus: 'green',
      title: 'Program was edited'
    },
    programWasDeleted: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      colorStatus: 'green',
      title: 'Program was deleted'
    },
    getAppStorageBinDirPermissionsError: {
      action: 'update-by-type',
      type: 'getAppStorageBinDirPermissionsError',
      timeout: 0,
      closeButton: true,
      colorStatus: 'red',
      title: 'Shell command failed',
      message: `
        Could not get exec permissions for app binary dir. 
        Some functionality will not work until permissions are granted.
        <br><br><strong>Error</strong>: ${params?.props?.error}
      `
    },
    fileDownloadIsDone: {
      action: 'update-by-hash',
      hashID: params?.props?.data?.hashID,
      type: 'fileDownload',
      closeButton: true,
      timeout: 0,
      title: `Downloading ${params?.props?.data?.isUpdate ? 'update' : 'file'} • done`,
      message: '',
      progress: params?.props?.data,
      actionButtons: [
        {
          title: 'open file',
          action: 'openDownloadedFile',
          closesNotification: true,
          onClick: () => {
            params?.props?.store.dispatch('OPEN_FILE', params?.props?.data.filePath)
          }
        },
        {
          title: 'show in directory',
          action: 'showDownloadedFile',
          closesNotification: true,
          onClick: () => {
            params?.props?.store?.dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', {
              dir: params?.props?.data.dir, 
              itemPath: params?.props?.data.filePath
            })
          }
        }
      ],
    },
    fileDownloadIsPaused: {
      action: 'update-by-hash',
      hashID: params?.props?.data?.hashID,
      type: 'fileDownload',
      closeButton: true,
      timeout: 0,
      title: `Downloading ${params?.props?.data?.isUpdate ? 'update' : 'file'} • paused`,
      message: '',
      progress: params?.props?.data,
      actionButtons: [
        {
          title: 'resume',
          action: 'resumeDownloading',
          closesNotification: false,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:resume', {
              hashID: params?.props?.data?.hashID
            })
          }
        },
        {
          title: 'cancel',
          action: 'cancelDownload',
          closesNotification: true,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:cancel', {
              hashID: params?.props?.data?.hashID
            })
          }
        }
      ],
    },
    fileDownloadIsInProgress: {
      action: 'update-by-hash',
      hashID: params?.props?.data?.hashID,
      type: 'fileDownload',
      closeButton: true,
      timeout: 0,
      title: `Downloading ${params?.props?.data?.isUpdate ? 'update' : 'file'} • in progress`,
      message: '',
      progress: params?.props?.data,
      actionButtons: [
        {
          title: 'pause',
          action: 'pauseDownloading',
          closesNotification: false,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:pause', {
              hashID: params?.props?.data?.hashID
            })
          }
        },
        {
          title: 'cancel',
          action: 'cancelDownload',
          closesNotification: true,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:cancel', {
              hashID: params?.props?.data?.hashID
            })
          }
        }
      ],
    },
  }
  return notifications[params.name]
}

function emit (params) {
  let notification = getNotification(params)
  notification.hide = () => hide(notification)
  notification.update = (params) => update(notification, params)
  eventHub.$emit('notification', notification)
  return notification
}

function update (notification, params) {
  let newNotification = getNotification(params)
  for (const [key, value] of Object.entries(newNotification)) {
    if (!['hashID', 'id'].includes(key)) {
      notification[key] = value
    }
  }
  eventHub.$emit('notification', notification)
}

function hide (notification) {
  notification.action = 'hide'
  update(notification)
}

function hideByHashID (hashID) {
  eventHub.$emit('notification', {
    action: 'hide',
    hashID
  })
}

export {
  emit,
  hideByHashID
}