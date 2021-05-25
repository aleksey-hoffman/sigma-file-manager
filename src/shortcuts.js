// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Allowed property values:
// conditions: {
//   inputFieldIsActive: Boolean
//   dialogIsOpened: Boolean
//   dirItemIsSelected: Boolean
// }

export default {
  toggleApp: {
    isGlobal: true,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-application',
    action: { name: 'toggleApp' },
    shortcut: 'Ctrl + Shift + Space',
    size: '22px',
    description: 'Open / close the app window'
  },
  newNote: {
    isGlobal: true,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-square-edit-outline',
    action: { name: 'newNote' },
    shortcut: 'Alt + Shift + N',
    size: '22px',
    description: 'Open the app window & create a new note'
  },
  shortcutsDialog: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['all'],
    icon: 'mdi-pound',
    action: {
      name: 'TOGGLE_DIALOG',
      props: {
        dialogName: 'shortcutsDialog'
      }
    },
    shortcut: 'Backtick',
    size: '22px',
    description: 'Display shortcut list'
  },
  escapeAction: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-close',
    action: { name: 'ESCAPE_BUTTON_HANDLER' },
    shortcut: 'Esc',
    size: '22px',
    description: 'Close opened dialog / overlay; dismiss items prepared for copying or moving, deselect items'
  },
  newDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-folder-plus-outline',
    action: {
      name: 'INIT_NEW_DIR_ITEM',
      props: {
        type: 'directory'
      }
    },
    shortcut: 'Alt + N',
    size: '22px',
    description: 'Create new directory in the current directory'
  },
  newFile: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-file-plus-outline',
    action: {
      name: 'INIT_NEW_DIR_ITEM',
      props: {
        type: 'file'
      }
    },
    shortcut: 'Alt + M',
    size: '22px',
    description: 'Create new file in current directory'
  },
  renameSelected: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
      dirItemIsSelected: true
    },
    routes: ['all'],
    icon: 'mdi-form-textbox',
    action: {
      name: 'OPEN_DIALOG',
      props: {
        dialogName: 'renameDirItemDialog'
      }
    },
    shortcut: 'F2',
    size: '20px',
    description: 'Rename selected items'
  },
  fullScreen: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-fullscreen',
    action: { name: 'TOGGLE_FULLSCREEN' },
    shortcut: 'F11',
    size: '26px',
    description: 'Toggle full screen'
  },
  zoomIncrease: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    preventDefaultType: 'always',
    routes: ['all'],
    icon: 'mdi-plus',
    action: { name: 'INCREASE_UI_ZOOM' },
    shortcut: 'Ctrl + Plus',
    size: '26px',
    description: 'UI zoom increase'
  },
  zoomDecrease: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    preventDefaultType: 'always',
    routes: ['all'],
    icon: 'mdi-minus',
    action: { name: 'DECREASE_UI_ZOOM' },
    shortcut: 'Ctrl + Minus',
    size: '26px',
    description: 'UI zoom decrease'
  },
  zoomReset: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    preventDefaultType: 'always',
    routes: ['all'],
    icon: 'mdi-backup-restore',
    action: { name: 'RESET_UI_ZOOM' },
    shortcut: 'Ctrl + 0',
    size: '26px',
    description: 'UI zoom reset'
  },
  openInNewTab: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dirItemIsSelected: true,
      dialogIsOpened: false
    },
    routes: ['navigator', 'dashboard'],
    icon: 'mdi-tab-plus',
    action: {
      name: 'ADD_TAB',
      props: 'selected'
    },
    shortcut: 'Ctrl + T',
    size: '20px',
    description: 'New tab in current workspace'
  },
  scrollTop: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['all'],
    icon: 'mdi-chevron-up',
    action: {
      name: 'SCROLL_TOP_CONTENT_AREA'
    },
    shortcut: 'Shift + T',
    size: '28px',
    description: 'Scroll page to the top'
  },
  switchTab: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-tab',
    action: { name: 'switchTab' },
    shortcut: 'Alt + [1 - 9]',
    size: '20px',
    description: 'Switch between tabs'
  },
  switchWorkspace: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-vector-arrange-below',
    action: { name: 'switchWorkspace' },
    shortcut: 'Alt + Shift + [1 - 9]',
    size: '22px',
    description: 'Switch between workspaces'
  },
  switchView: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-arrange-send-backward',
    action: { name: 'SWITCH_ROUTE' },
    shortcut: 'Shift + [1 - 9]',
    size: '22px',
    description: 'Switch between views'
  },
  focusAddressBar: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-link-variant',
    action: {
      name: 'TOGGLE_ADDRESS_BAR',
      props: 'addressBarEditor'
    },
    shortcut: 'Ctrl + /',
    size: '22px',
    description: 'Toggle address bar'
  },
  copyCurrentDirPath: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-link-variant',
    action: { name: 'copyCurrentDirPath' },
    shortcut: 'Ctrl + <',
    size: '22px',
    description: 'Copy path to clipboard'
  },
  openCopiedPath: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-link-variant',
    action: {
      name: 'OPEN_DIR_PATH_FROM_OS_CLIPBOARD'
    },
    shortcut: 'Ctrl + >',
    size: '22px',
    description: 'Open copied path'
  },
  openTerminal: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dirItemIsSelected: true,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-console',
    action: {
      name: 'OPEN_SELECTED_IN_TERMINAL',
      props: {
        asAdmin: false
      }
    },
    shortcut: 'Alt + T',
    size: '22px',
    description: 'Open current dir in terminal'
  },
  openTerminalAsAdmin: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dirItemIsSelected: true,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-console',
    action: {
      name: 'OPEN_SELECTED_IN_TERMINAL',
      props: {
        asAdmin: true
      }
    },
    shortcut: 'Alt + Shift + T',
    size: '22px',
    description: 'Open current dir in terminal as admin'
  },
  focusFilter: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-filter-variant',
    action: { name: 'TOGGLE_FILTER_FOCUS' },
    shortcut: 'Ctrl + F',
    size: '22px',
    description: 'Focus filter field'
  },
  toggleGlobalSearch: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-magnify',
    action: { name: 'TOGGLE_GLOBAL_SEARCH' },
    shortcut: 'Ctrl + Shift + F',
    size: '22px',
    description: 'Show / hide global search'
  },
  openSelectedDirItem: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-open-in-app',
    action: { name: 'OPEN_LAST_SELECTED_DIRITEM' },
    shortcut: 'Enter',
    size: '22px',
    description: 'Open last selected directory item'
  },
  openSelectedDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-open-in-app',
    action: { name: 'OPEN_LAST_SELECTED_DIRITEM' },
    shortcut: 'Alt + E',
    size: '22px',
    description: 'Enter selected directory'
  },
  quitSelectedDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-open-in-app',
    action: { name: 'GO_UP_DIRECTORY' },
    shortcut: 'Alt + Q',
    size: '22px',
    description: 'Quit current directory'
  },
  navigateDirUp: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-chevron-up',
    action: { name: 'NAVIGATE_DIR_UP' },
    shortcut: 'Alt + W',
    size: '26px',
    description: 'Select directory item in the direction: up'
  },
  navigateDirLeft: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-chevron-left',
    action: { name: 'NAVIGATE_DIR_LEFT' },
    shortcut: 'Alt + A',
    size: '26px',
    description: 'Select directory item in the direction: left'
  },
  navigateDirDown: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-chevron-down',
    action: { name: 'NAVIGATE_DIR_DOWN' },
    shortcut: 'Alt + S',
    size: '26px',
    description: 'Select directory item in the direction: down'
  },
  navigateDirRight: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-chevron-right',
    action: { name: 'NAVIGATE_DIR_RIGHT' },
    shortcut: 'Alt + D',
    size: '26px',
    description: 'Select directory item in the direction: right'
  },
  goToPreviousDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-arrow-left',
    action: { name: 'LOAD_PREVIOUS_HISTORY_PATH' },
    shortcut: 'Alt + Left',
    size: '22px',
    description: 'Go to previous directory in history'
  },
  goToNextDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-arrow-right',
    action: { name: 'LOAD_NEXT_HISTORY_PATH' },
    shortcut: 'Alt + Right',
    size: '22px',
    description: 'Go to next directory in history'
  },
  goUpDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-arrow-up',
    action: { name: 'GO_UP_DIRECTORY' },
    shortcut: 'Alt + Up',
    size: '22px',
    description: 'Go up directory'
  },
  selectDirItem: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-check-box-multiple-outline',
    action: { name: 'selectDirItem' },
    shortcut: 'Ctrl + LeftClick',
    size: '22px',
    description: 'Select / deselect item in the current directory'
  },
  selectDirItemRange: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-priority-low',
    action: { name: 'selectDirItemRange' },
    shortcut: 'Shift + LeftClick',
    size: '22px',
    description: 'Select / deselect item range in the current directory'
  },
  selectAllDirItems: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    preventDefaultType: '!inputFieldIsActive',
    routes: ['navigator'],
    icon: 'mdi-select-all',
    action: { name: 'SELECT_ALL_DIR_ITEMS' },
    shortcut: 'Ctrl + A',
    size: '22px',
    description: 'Select all items in current directory'
  },
  copySelectedDirItems: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-content-copy',
    action: {
      name: 'SET_FS_CLIPBOARD',
      props: {
        type: 'copy'
      }
    },
    shortcut: 'Ctrl + C',
    size: '20px',
    description: 'Prepare selected items for copying'
  },
  moveSelectedDirItems: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-content-duplicate',
    action: {
      name: 'SET_FS_CLIPBOARD',
      props: {
        type: 'move'
      }
    },
    shortcut: 'Ctrl + X',
    size: '20px',
    description: 'Prepare selected items for moving'
  },
  pasteSelectedDirItems: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-swap-horizontal',
    action: {
      name: 'PASTE_PREPARED_DIR_ITEMS'
    },
    shortcut: 'Ctrl + V',
    size: '24px',
    description: 'Transfer prepared items to current directory'
  },
  trashSelected: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-trash-can-outline',
    action: { name: 'TRASH_SELECTED' },
    shortcut: 'Delete',
    size: '22px',
    description: 'Move selected items to trash'
  },
  deleteSelected: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-eraser',
    action: { name: 'INIT_DELETE_SELECTED' },
    shortcut: 'Shift + Delete',
    size: '22px',
    description: 'Delete selected items from drive'
  },
  windowPosition: {
    isGlobal: false,
    isReadOnly: true,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-axis-arrow',
    description: 'Quick window positioning',
    action: { name: 'windowPosition' },
    shortcut: { win32: 'Meta + [Left | Right | Up]', linux: 'Meta + [Left | Right | Up | Down]' }
  },
  emoji: {
    isGlobal: false,
    isReadOnly: true,
    conditions: {
      inputFieldIsActive: true
    },
    routes: ['all'],
    icon: 'mdi-emoticon-outline',
    description: 'Display system emoji and symbol picker',
    action: { name: 'emoji' },
    shortcut: { win32: 'Meta + Dot', darwin: 'Cmd + Ctrl + Space' }
  },
  clipboard: {
    isGlobal: false,
    isReadOnly: true,
    conditions: {
      inputFieldIsActive: true
    },
    routes: ['all'],
    icon: 'mdi-clipboard-text-play-outline',
    description: 'Display system clipboard (must be turned on in system settings)',
    action: { name: 'clipboard' },
    shortcut: { win32: 'Meta + V' }
  }
}
