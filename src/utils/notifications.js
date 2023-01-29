// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import sharedUtils from './sharedUtils.js'
import {i18n} from '../localization/i18n'
const eventHub = require('./eventHub').eventHub

/**
* @param {object} params
* @returns {object}
*/
function getNotification (params) {
  let notifications = {
    error: {
      action: 'update-by-type',
      type: 'error',
      timeout: 8000,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('errorOccured'),
      message: params?.props?.error,
    },
    cannotFetchDirItems: {
      action: 'update-by-type',
      type: 'cannotFetchDirItems',
      timeout: 5000,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('notifications.cannotFetchDirectoryItems'),
      message: params?.props?.error,
    },
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
      title: i18n.t('notifications.errorDuringCopying'),
      message: `
        ${i18n.t('notifications.cannotCopySpecifiedValueAsText')}
        <br>${i18n.t('dataType')}: <span class="inline-code--light">${typeof params?.props?.text}</span>
      `,
    },
    copyDirItemsInProgress: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'copyDirItemsInProgress',
      loader: true,
      colorStatus: 'blue',
      closeButton: true,
      timeout: 0,
      title: i18n.t('notifications.copyingItems'),
    },
    copyDirItemsSuccess: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'copyDirItemsSuccess',
      loader: false,
      colorStatus: 'green',
      icon: '',
      closeButton: true,
      timeout: 3000,
      title: i18n.tc('notifications.copiedNItems', params?.props?.items),
    },
    moveDirItemsInProgress: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'moveDirItemsInProgress',
      loader: true,
      colorStatus: 'blue',
      closeButton: true,
      timeout: 0,
      title: i18n.t('notifications.movingItems'),
    },
    moveDirItemsSuccess: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'moveDirItemsSuccess',
      loader: false,
      colorStatus: 'green',
      icon: '',
      closeButton: true,
      timeout: 3000,
      title: i18n.tc('notifications.movedNItems', params?.props?.items),
    },
    transferDirItemsError: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'transferDirItemsError',
      icon: 'mdi-progress-close',
      loader: false,
      colorStatus: 'red',
      closeButton: true,
      timeout: 0,
      title: params?.title,
      message: params?.props?.error,
    },
    errorGettingStorageDeviceData: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'errorGettingStorageDeviceData',
      loader: false,
      colorStatus: 'red',
      closeButton: true,
      timeout: 5000,
      title: i18n.t('notifications.errorCannotGetStorageDevices'),
      message: params?.props?.error,
    },
    errorGettingOneDriveData: {
      action: 'update-by-hash',
      hashID: sharedUtils.getHash(),
      type: 'errorGettingOneDriveData',
      loader: false,
      colorStatus: 'red',
      closeButton: true,
      timeout: 5000,
      title: i18n.t('notifications.errorCannotGetOneDriveData'),
      message: params?.props?.error,
    },
    renameFailedNoLongerExists: {
      action: 'add',
      colorStatus: 'red',
      timeout: 6000,
      closeButton: true,
      title: i18n.t('notifications.failedToRenameItem'),
      message: `
        ${i18n.t('notifications.fileDirectoryRenamingNoLongerExists')}:
        <br><strong>${i18n.t('path')}:</strong> ${params?.props?.oldPath}
      `,
    },
    renameFailedError: {
      action: 'add',
      colorStatus: 'red',
      timeout: 6000,
      closeButton: true,
      title: i18n.t('notifications.failedToRenameItem'),
      error: params?.props?.error,
    },
    renameFailedAlreadyExistsOrLocked: {
      action: 'add',
      colorStatus: 'red',
      timeout: 5000,
      closeButton: true,
      title: i18n.t('notifications.failedToRenameItem'),
      message: `
        ${i18n.t('notifications.fileNameAlreadyExistsOrLocked')}:
        <br>${params?.props?.newName}
      `,
    },
    renameSuccess: {
      action: 'add',
      colorStatus: 'green',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.renameUndone'),
      message: '',
    },
    tabRemoved: {
      action: 'update-by-type',
      type: 'tabRemoved',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.removedTabFromCurrentWorkspace'),
      message: `${params?.props?.tabPath}`,
    },
    tabAdded: {
      action: 'update-by-type',
      type: 'tabAdded',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.tabAddedToCurrentWorkspace'),
      message: `
        ${i18n.t('notifications.shortcutToOpen')}: 
        <span class="inline-code--light">${params?.props?.tabShortcut}</span>
      `,
    },
    tabIsAlreadyOpened: {
      action: 'update-by-type',
      type: 'tabIsAlreadyOpened',
      timeout: 5000,
      closeButton: true,
      title: i18n.t('notifications.tabForThisDirectoryIsAlreadyOpened'),
      message: `
        ${i18n.t('position')}: ${params?.props?.tabIndex}
      `,
    },
    closedAllTabsInCurrentWorkspace: {
      action: 'update-by-type',
      type: 'closedAllTabsInCurrentWorkspace',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.closedAllTabsInCurrentWorkspace'),
    },
    currentWorkspaceHasNoTabs: {
      action: 'update-by-type',
      type: 'currentWorkspaceHasNoTabs',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.currentWorkspaceHasNoTabs'),
    },
    archiveAddDataError: {
      action: 'update-by-type',
      type: 'archiveAddDataError',
      timeout: 5000,
      title: i18n.t('notifications.errorCannotAddDataToTheArchive'),
      error: params?.props?.error,
    },
    archiveExtractionError: {
      action: 'update-by-type',
      type: 'archiveExtractionError',
      timeout: 8000,
      title: i18n.t('notifications.extractArchiveError'),
      message: params?.props?.error,
    },
    archiveExtractionCanceled: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveExtractionCanceled',
      timeout: 3000,
      actionButtons: [],
      colorStatus: 'red',
      title: i18n.t('notifications.archiveExtractionCanceled'),
    },
    archiveCreationCanceled: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveCreationCanceled',
      timeout: 3000,
      actionButtons: [],
      colorStatus: 'red',
      title: i18n.t('notifications.archiveCreationCanceled'),
    },
    archiveWasCreated: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveWasCreated',
      timeout: 5000,
      actionButtons: [],
      colorStatus: 'green',
      title: i18n.t('notifications.createArchiveSuccess'),
      message: `
        ${i18n.t('done')} • ${i18n.tc('nFiles', params?.props?.progress?.fileCount)}
        <br><strong>${i18n.t('destinationPath')}:</strong> ${params?.props?.params?.destPath}
      `,
    },
    archiveWasExtracted: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      type: 'archiveWasExtracted',
      timeout: 5000,
      actionButtons: [],
      colorStatus: 'green',
      title: i18n.t('notifications.extractArchiveSuccess'),
      message: `
        ${i18n.t('done')} • ${i18n.tc('nFiles', params?.props?.progress?.fileCount)}
        <br><strong>${i18n.t('destinationPath')}:</strong> ${params?.props?.params?.destPath}
      `,
    },
    archiveCreationProgress: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      progress: params?.props?.progress,
      timeout: 0,
      title: i18n.t('notifications.creatingArchive'),
      message: `
        ${params?.props?.progress?.percent}% • 
        ${i18n.tc('nFiles', params?.props?.progress?.fileCount)}
        <br><strong>${i18n.t('sourcePath')}:</strong> ${params?.props?.params?.source}
        <br><strong>${i18n.t('destinationPath')}:</strong> ${params?.props?.params?.dest}
      `,
      actionButtons: [
        {
          title: i18n.t('cancel'),
          onClick: () => {
            params?.props?.archiveStream?._childProcess.kill()
            params.props.archiveState.isCanceled = true
          },
        },
      ],
    },
    archiveExtractionProgress: {
      action: 'update-by-hash',
      hashID: params?.props?.hashID,
      progress: params?.props?.progress,
      timeout: 0,
      title: i18n.t('notifications.extractArchiveInProgress'),
      message: `
        ${params?.props?.progress?.percent}% • 
        ${i18n.tc('nFiles', params?.props?.progress?.fileCount)}
        <br><strong>${i18n.t('sourcePath')}:</strong> ${params?.props?.params?.source}
        <br><strong>${i18n.t('destinationPath')}:</strong> ${params?.props?.params?.dest}
      `,
      actionButtons: [
        {
          title: i18n.t('cancel'),
          onClick: () => {
            params?.props?.archiveStream?._childProcess.kill()
            params.props.archiveState.isCanceled = true
          },
        },
      ],
    },
    cannotDeleteDriveRootDir: {
      action: 'update-by-type',
      type: 'cannotDeleteDriveRootDir',
      icon: 'mdi-delete-forever-outline',
      timeout: 3000,
      title: i18n.t('notifications.youCannotDeleteDriveSRootDirectory'),
    },
    trashItemsSuccess: {
      action: 'update-by-type',
      type: 'trashItemsSuccess',
      icon: 'mdi-trash-can-outline',
      colorStatus: 'green',
      timeout: 5000,
      title: i18n.t('notifications.allItemsWereTrashed'),
      message: `
        <strong>${i18n.t('notifications.trashedItems')}:</strong> 
        ${params?.props?.removedItems?.length}
        <br><strong>${i18n.t('notifications.trashedItemsSize')}:</strong> 
        ${params?.props?.removedItemsSize}
      `,
    },
    deleteItemsSuccess: {
      action: 'update-by-type',
      type: 'deleteItemsSuccess',
      icon: 'mdi-delete-forever-outline',
      colorStatus: 'green',
      timeout: 5000,
      title: i18n.t('notifications.allItemsWereDeleted'),
      message: `
        <strong>${i18n.t('notifications.deletedItems')}:</strong> 
        ${params?.props?.removedItems?.length}
        <br><strong>${i18n.t('notifications.deletedItemsSize')}:</strong> 
        ${params?.props?.removedItemsSize}
      `,
    },
    trashItemsError: {
      action: 'update-by-type',
      type: 'trashItemsError',
      icon: 'mdi-trash-can-outline',
      colorStatus: 'red',
      timeout: 5000,
      title: i18n.t('notifications.errorTrashItems'),
    },
    deleteItemsError: {
      action: 'update-by-type',
      type: 'deleteItemsError',
      icon: 'mdi-delete-forever-outline',
      colorStatus: 'red',
      timeout: 5000,
      title: i18n.t('notifications.errorDeleteItems'),
    },
    trashItemsFailure: {
      action: 'update-by-type',
      type: 'trashItemsFailure',
      icon: 'mdi-trash-can-outline',
      colorStatus: 'red',
      timeout: 10000,
      closeButton: true,
      title: i18n.t('notifications.failedToTrashSomeItems'),
      content: [
        {
          type: 'html',
          value: `
            <strong>${i18n.t('notifications.trashedItems')}:</strong> 
            <span class="inline-code--light py-0">
              ${i18n.t('notifications.removedNItemsOfTotal', {removedAmount: params?.props?.notRemovedItems?.length, totalAmount: params?.props?.items?.length})}
            </span>
            <br><strong>${i18n.t('notifications.deletedItemsSize')}:</strong>
            <span class="inline-code--light py-0">
              ${params?.props?.removedItemSize}
            </span>
            <br><strong>${i18n.t('notifications.couldNotTrash')}:</strong>
            <span class="inline-code--light py-0">
              ${i18n.tc('item', params?.props?.notRemovedItems?.length)}:
            </span>
          `,
        },
        {
          type: 'list',
          value: params?.props?.notRemovedItems,
        },
      ],
    },
    deleteItemsFailure: {
      action: 'update-by-type',
      type: 'deleteItemsFailure',
      icon: 'mdi-delete-forever-outline',
      colorStatus: 'red',
      timeout: 10000,
      closeButton: true,
      title: i18n.t('notifications.failedToDeleteSomeItems'),
      content: [
        {
          type: 'html',
          value: `
            <strong>${i18n.t('notifications.deletedItems')}:</strong> 
            <span class="inline-code--light py-0">
              ${i18n.t('notifications.removedNItemsOfTotal', {removedAmount: params?.props?.removedItems?.length, totalAmount: params?.props?.items?.length})}
            </span>
            <br><strong>${i18n.t('notifications.deletedItemsSize')}:</strong>
            <span class="inline-code--light py-0">
              ${params?.props?.removedItemSize}
            </span>
            <br><strong>${i18n.t('notifications.couldNotDelete')}:</strong>
            <span class="inline-code--light py-0">
              ${i18n.tc('item', params?.props?.notRemovedItems?.length)}:
            </span>
          `,
        },
        {
          type: 'list',
          value: params?.props?.notRemovedItems,
        },
      ],
    },
    noteWasTrashed: {
      action: 'add',
      actionButtons: [
        {
          title: i18n.t('undo'),
          action: 'undoTrashNote',
          closesNotification: true,
        },
      ],
      closeButton: true,
      timeout: 10000,
      title: i18n.t('notifications.noteWasTrashed'),
      message: i18n.t('notifications.switchToTrashedNotesList'),
    },
    removedFromPinnedSuccess: {
      action: 'update-by-type',
      type: 'removedFromPinnedSuccess',
      timeout: 2000,
      closeButton: true,
      title: i18n.tc('notifications.removedNItemsFromPinned', params?.props?.itemCounter),
    },
    addedToPinnedSuccess: {
      action: 'update-by-type',
      type: 'addedToPinnedSuccess',
      timeout: 2000,
      closeButton: true,
      title: i18n.tc('notifications.addedNItemsToPinned', params?.props?.itemCounter),
    },
    removedFromProtectedSuccess: {
      action: 'update-by-type',
      type: 'removedFromProtectedSuccess',
      timeout: 2000,
      closeButton: true,
      title: i18n.tc('notifications.removedNItemsFromProtected', params?.props?.itemCounter),
    },
    addedToProtectedSuccess: {
      action: 'update-by-type',
      type: 'addedToProtectedSuccess',
      timeout: 2000,
      closeButton: true,
      title: i18n.tc('notifications.addedNItemsToProtected', params?.props?.itemCounter),
    },
    actionNotAllowedWhenInputFieldIsActive: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.actionFailed'),
      message: i18n.t('notifications.actionIsNotAllowedWhenInputFieldIsActive'),
    },
    actionNotAllowedWhenDialogIsOpened: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.actionFailed'),
      message: i18n.t('notifications.actionIsNotAllowedWhenADialogIsOpened'),
    },
    actionFailedNoDirItemsSelected: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.actionFailed'),
      message: i18n.t('notifications.noDirectoryItemsAreSelected'),
    },
    actionNotAllowedOnThisPage: {
      action: 'update-by-type',
      type: 'actionFailed',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.actionFailed'),
      message: i18n.t('notifications.actionIsNotAllowedOnThisPage'),
    },
    increaseUIZoom: {
      action: 'update-by-type',
      type: 'UIZoomChange',
      timeout: 2000,
      title: `${i18n.t('notifications.uiScaleChanged')}: ${params?.props?.newZoomFactor}%`,
    },
    decreaseUIZoom: {
      action: 'update-by-type',
      type: 'UIZoomChange',
      timeout: 2000,
      title: `${i18n.t('notifications.uiScaleChanged')}: ${params?.props?.newZoomFactor}%`,
    },
    resetUIZoom: {
      action: 'update-by-type',
      type: 'UIZoomChange',
      timeout: 2000,
      title: `${i18n.t('notifications.uiScaleChanged')}: 100%`,
    },
    directoryWasReloaded: {
      action: 'update-by-type',
      type: 'directoryWasReloaded',
      timeout: 2000,
      title: i18n.t('notifications.directoryWasReloaded'),
      message: `<strong>${i18n.t('directory')}:</strong> ${params?.props?.currentDirPath}`,
    },
    setDirItemPermissionsSuccess: {
      action: 'update-by-type',
      type: 'setDirItemPermissionsSuccess',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.permissionsWereChanged'),
    },
    setDirItemPermissionsFailure: {
      action: 'update-by-type',
      type: 'setDirItemPermissionsFailure',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.failedToChangePermissions'),
      error: params?.props?.error,
    },
    updateUnavailable: {
      action: 'update-by-type',
      type: 'updateUnavailable',
      timeout: 5000,
      colorStatus: 'blue',
      isPinned: true,
      removeWhenHidden: false,
      title: i18n.t('notifications.noUpdatesAvailable'),
      message: `
        <strong>${i18n.t('currentVersion')}:</strong> ${params?.props?.state?.appVersion}
        <br><strong>${i18n.t('latestVersion')}:</strong> ${params?.props?.latestVersion}
      `,
      closeButton: true,
      actionButtons: [
        {
          title: i18n.t('projectGithubButtons.projectPage'),
          action: '',
          extrnalLink: params?.props?.state?.appPaths?.githubRepoLink,
          onClick: () => {
            params?.props?.utils.openLink(params?.props?.state?.appPaths?.githubRepoLink)
          },
          closesNotification: false,
        },
      ],
    },
    updateWasDownloaded: {
      action: 'add',
      type: 'updateWasDownloaded',
      colorStatus: 'blue',
      isPinned: true,
      isUpdate: true,
      removeWhenHidden: false,
      timeout: 0,
      title: `${i18n.t('notifications.updateDownloaded')}: v${params?.props?.latestVersion}`,
      message: i18n.t('notifications.pressInstallToCloseTheAppAndUpdateIt'),
      closeButton: true,
      actionButtons: [
        {
          title: i18n.t('installUpdate'),
          action: '',
          onClick: () => {
            let updateFileDownloadDir = params?.props?.store?.state?.appPaths?.updateDownloadDir
            let updateFileName = params?.props?.info?.filename
            let updateFilePath = `${updateFileDownloadDir}/${updateFileName}`
            params?.props?.store?.dispatch('OPEN_FILE', updateFilePath)
          },
          closesNotification: true,
        },
        {
          title: i18n.t('showInDirectory'),
          action: 'showDownloadedFile',
          closesNotification: false,
          onClick: () => {
            params?.props?.store?.dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', {
              dir: params?.props?.info?.dir,
              itemPath: params?.props?.info?.filePath,
            })
          },
        },
      ],
    },
    removeAppThumbsDirSuccess: {
      action: 'update-by-type',
      type: 'removeAppThumbsDirSuccess',
      timeout: 20000,
      colorStatus: 'green',
      closeButton: true,
      title: i18n.t('notifications.storageLimitForImageThumbnailsWasReached'),
      message: `
        ${i18n.t('notifications.allPreviouslyCreatedImageThumbnailsWereDeleted')} 
        <strong>${i18n.t('notifications.thumbnailStorageLimit')}:</strong> ${params?.props?.thumbDirSizeLimit}
      `,
    },
    removeAppThumbsDirError: {
      action: 'update-by-type',
      type: 'removeAppThumbsDirError',
      timeout: 20000,
      colorStatus: 'red',
      closeButton: true,
      title: i18n.t('notifications.storageLimitForImageThumbnailsWasReached'),
      message: `
        ${i18n.t('notifications.errorCouldNotDeleteExistingImageThumbnails')}
        <br>${i18n.t('notifications.youCanTryToDeleteThemManually')}:
        <br><strong>${i18n.t('notifications.thumbnailDirectory')}:</strong> 
        <br>${params?.props?.thumbDirPath}
        <br><strong>${i18n.t('error')}:</strong>
        <br>${params?.props?.error}
      `,
    },
    localFileServer: {
      action: 'update-by-type',
      type: 'localFileServer',
      closeButton: false,
      timeout: 0,
      colorStatus: 'green',
      title: i18n.t('notifications.directoryIsNowAccessibleFromLocalDevices'),
      message: `${i18n.t('address')}: ${params?.props?.localServer?.directoryShare?.address}`,
      actionButtons: [
        {
          title: i18n.t('stopServer'),
          onClick: () => {
            params?.props?.stopLocalDirectoryShareServer()
            params.props.dialogs.localShareManagerDialog.value = false
          },
          closesNotification: true,
        },
        {
          title: i18n.t('copyAddress'),
          onClick: () => {
            params?.props?.utils?.copyToClipboard({
              text: params?.props?.localServer?.directoryShare?.address,
              title: 'Address was copied to clipboard',
            })
          },
          closesNotification: false,
        },
      ],
    },
    localDirectoryServer: {
      action: 'update-by-type',
      type: 'localDirectoryServer',
      closeButton: false,
      timeout: 0,
      colorStatus: 'green',
      title: i18n.t('notifications.localFileShareIsActive'),
      message: `${i18n.t('address')}: ${params?.props?.localServer?.fileShare?.address}`,
      actionButtons: [
        {
          title: i18n.t('stopServer'),
          onClick: () => {
            params?.props?.stopLocalFileShareServer()
            params.props.dialogs.localShareManagerDialog.value = false
          },
          closesNotification: true,
        },
        {
          title: i18n.t('copyAddress'),
          onClick: () => {
            params?.props?.utils?.copyToClipboard({
              text: params?.props?.localServer?.fileShare?.address,
              title: i18n.t('localShareManagerDialog.addressCopiedToClipboard'),
            })
          },
          closesNotification: false,
        },
      ],
    },
    quickViewFileIsNotSupported: {
      action: 'update-by-type',
      type: 'quickViewFileIsNotSupported',
      closeButton: true,
      timeout: 3000,
      title: i18n.t('notifications.quickViewFileIsNotSupported'),
      message: params?.props?.data?.path?.replace('file:///', ''),
    },
    driveWasConnected: {
      action: 'update-by-type',
      type: 'driveWasConnected',
      timeout: 3000,
      colorStatus: 'green',
      title: i18n.t('notifications.driveWasConnected'),
      closeButton: true,
    },
    searchFileIsDamaged: {
      action: 'update-by-type',
      type: 'searchFileIsDamaged',
      timeout: 8000,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('notifications.driveScanInitiated'),
      message: i18n.t('notifications.oneOfTheSearchFilesIsDamaged'),
    },
    cannotOpenDirItem: {
      action: 'update-by-type',
      type: 'cannotOpenDirItem',
      timeout: 7000,
      title: i18n.t('notifications.cannotOpenThisItem'),
      message: `
        <strong>${i18n.t('reason')}:</strong> ${i18n.t('notifications.itemHasImmutableOrReadOnly')}
        <br>${i18n.t('notifications.youCanResetItemPermissions')}
      `,
    },
    cannotOpenPathFromClipboard: {
      action: 'update-by-type',
      type: 'cannotOpenPathFromClipboard',
      timeout: 6000,
      title: i18n.t('notifications.cannotOpenPathFromClipboard'),
      message: `<strong>${i18n.t('reason')}:</strong> ${i18n.t('notifications.pathDoesNotExistOnTheDrive')}`,
    },
    openedPathFromClipboard: {
      action: 'update-by-type',
      type: 'openedPathFromClipboard',
      timeout: 2000,
      title: i18n.t('notifications.openedPathFromClipboard'),
      message: params?.props?.osClipboardText,
    },
    programWasAdded: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      colorStatus: 'green',
      title: i18n.t('notifications.programWasAdded'),
    },
    programWasEdited: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      colorStatus: 'green',
      title: i18n.t('notifications.programWasEdited'),
    },
    programWasDeleted: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      colorStatus: 'green',
      title: i18n.t('notifications.programWasDeleted'),
    },
    getAppStorageBinDirPermissionsError: {
      action: 'update-by-type',
      type: 'getAppStorageBinDirPermissionsError',
      timeout: 0,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('notifications.shellCommandFailed'),
      message: `
        ${i18n.t('notifications.couldNotGetAppBinsExecPermissions')}
        <br><br><strong>${i18n.t('error')}</strong>: ${params?.props?.error}
      `,
    },
    fileDownloadIsDone: {
      action: 'update-by-hash',
      hashID: params?.props?.data?.hashID,
      type: 'fileDownload',
      closeButton: true,
      timeout: 0,
      title: i18n.t('done') + params?.props?.data?.isUpdate
        ? i18n.t('notifications.downloadingUpdate')
        : i18n.t('notifications.downloadingFile'),
      message: '',
      progress: params?.props?.data,
      actionButtons: [
        {
          title: i18n.t('openFile'),
          action: 'openDownloadedFile',
          closesNotification: true,
          onClick: () => {
            params?.props?.store.dispatch('OPEN_FILE', params?.props?.data.filePath)
          },
        },
        {
          title: i18n.t('showInDirectory'),
          action: 'showDownloadedFile',
          closesNotification: true,
          onClick: () => {
            params?.props?.store?.dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', {
              dir: params?.props?.data.dir,
              itemPath: params?.props?.data.filePath,
            })
          },
        },
      ],
    },
    fileDownloadIsPaused: {
      action: 'update-by-hash',
      hashID: params?.props?.data?.hashID,
      type: 'fileDownload',
      closeButton: true,
      timeout: 0,
      title: i18n.t('paused') + params?.props?.data?.isUpdate
        ? i18n.t('notifications.downloadingUpdate')
        : i18n.t('notifications.downloadingFile'),
      message: '',
      progress: params?.props?.data,
      actionButtons: [
        {
          title: i18n.t('resume'),
          action: 'resumeDownloading',
          closesNotification: false,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:resume', {
              hashID: params?.props?.data?.hashID,
            })
          },
        },
        {
          title: i18n.t('cancel'),
          action: 'cancelDownload',
          closesNotification: true,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:cancel', {
              hashID: params?.props?.data?.hashID,
            })
          },
        },
      ],
    },
    fileDownloadIsInProgress: {
      action: 'update-by-hash',
      hashID: params?.props?.data?.hashID,
      type: 'fileDownload',
      closeButton: true,
      timeout: 0,
      title: i18n.t('inProgress') + params?.props?.data?.isUpdate
        ? i18n.t('notifications.downloadingUpdate')
        : i18n.t('notifications.downloadingFile'),
      message: '',
      progress: params?.props?.data,
      actionButtons: [
        {
          title: i18n.t('pause'),
          action: 'pauseDownloading',
          closesNotification: false,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:pause', {
              hashID: params?.props?.data?.hashID,
            })
          },
        },
        {
          title: i18n.t('cancel'),
          action: 'cancelDownload',
          closesNotification: true,
          onClick: () => {
            params?.props?.electron?.ipcRenderer.send('download-file:cancel', {
              hashID: params?.props?.data?.hashID,
            })
          },
        },
      ],
    },
    addWorkspace: {
      action: 'add',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.workspaceAdded'),
    },
    addWorkspaceError: {
      action: 'add',
      timeout: 8000,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('notifications.addWorkspaceError'),
      message: params?.props?.error,
    },
    editWorkspaceError: {
      action: 'add',
      timeout: 8000,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('notifications.editWorkspaceError'),
      message: params?.props?.error,
    },
    deleteWorkspaceError: {
      action: 'add',
      timeout: 8000,
      closeButton: true,
      colorStatus: 'red',
      title: i18n.t('notifications.deleteWorkspaceError'),
      message: params?.props?.error,
    },
    deleteWorkspace: {
      action: 'add',
      colorStatus: 'green',
      timeout: 3000,
      closeButton: true,
      title: i18n.t('notifications.deletedWorkspaceName', {name: params?.props?.name}),
    },
    switchWorkspace: {
      action: 'update-by-type',
      type: 'switchWorkspace',
      closeButton: true,
      timeout: params?.props?.actionButtons?.length > 0 ? 8000 : 2000,
      title: i18n.t('notifications.openedWorkspaceName', {name: params?.props?.name}),
      actionButtons: params?.props?.actionButtons,
      content: params?.props?.content,
      message: `<b>${i18n.t('directory')}:</b> ${params?.props?.defaultPath}`,
    },
  }
  return params?.name ? notifications[params.name] : {}
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
    hashID,
  })
}

export {
  emit,
  hideByHashID,
}