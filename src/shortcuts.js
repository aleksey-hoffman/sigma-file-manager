// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Allowed property values:
// conditions: {
//   inputFieldIsActive: Boolean
//   dialogIsOpened: Boolean
//   dirItemIsSelected: Boolean
// }
// eventName: String ('keydown'|'keypress')

export default {
  toggleApp: {
    isGlobal: true,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-application',
    action: {name: 'toggleApp'},
    shortcut: 'Ctrl + Shift + Space',
    description: 'Open / close the app window'
  },
  openGlobalSearch: {
    isGlobal: true,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-magnify',
    action: {name: 'openGlobalSearch'},
    shortcut: 'Alt + Ctrl + Shift + F',
    description: 'Open global search'
  },
  newNote: {
    isGlobal: true,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-square-edit-outline',
    action: {name: 'newNote'},
    shortcut: 'Alt + Shift + N',
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
      name: 'TOGGLE_APP_GUIDE',
      options: 'stortcuts'
    },
    shortcut: 'Backtick',
    description: 'Display shortcut list'
  },
  escapeAction: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-close',
    action: {name: 'ESCAPE_BUTTON_HANDLER'},
    shortcut: 'Esc',
    description: 'Close opened dialog / overlay; dismiss items prepared for copying or moving, deselect items'
  },
  openWithQuickView: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    preventDefaultType: '!inputFieldIsActive',
    routes: ['navigator', 'dashboard', 'home'],
    icon: 'mdi-text-box-search-outline',
    action: {name: 'OPEN_WITH_QUICK_VIEW'}, 
    shortcut: 'Space',
    description: `Open / close selected file in Quick View window. Supported: images, videos, audio, PDF, plain text`
  },
  fullScreen: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-fullscreen',
    iconSize: '26px',
    action: {name: 'TOGGLE_FULLSCREEN'},
    shortcut: 'F11',
    description: 'Toggle full screen'
  },
  zoomIncrease: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    eventName: 'keypress',
    preventDefaultType: 'always',
    routes: ['all'],
    icon: 'mdi-plus',
    iconSize: '26px',
    action: {name: 'INCREASE_UI_ZOOM'},
    shortcut: 'Ctrl + Plus',
    description: 'UI zoom increase'
  },
  zoomDecrease: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    preventDefaultType: 'always',
    routes: ['all'],
    icon: 'mdi-minus',
    iconSize: '26px',
    action: {name: 'DECREASE_UI_ZOOM'},
    shortcut: 'Ctrl + Minus',
    description: 'UI zoom decrease'
  },
  zoomReset: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    preventDefaultType: 'always',
    routes: ['all'],
    icon: 'mdi-backup-restore',
    iconSize: '26px',
    action: {name: 'RESET_UI_ZOOM'},
    shortcut: 'Ctrl + 0',
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
    iconSize: '20px',
    action: {
      name: 'ADD_TAB',
      options: 'selected'
    },
    shortcut: 'Ctrl + T',
    description: 'New tab in current workspace'
  },
  closeCurrentTab: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dirItemIsSelected: true,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-tab-remove',
    iconSize: '20px',
    action: {
      name: 'CLOSE_CURRENT_TAB',
    },
    shortcut: 'Ctrl + W',
    description: 'Close current tab / close app window'
  },
  closeAllTabsInCurrentWorkspace: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dirItemIsSelected: true,
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-tab-remove',
    iconSize: '20px',
    action: {
      name: 'CLOSE_ALL_TABS_IN_CURRENT_WORKSPACE',
    },
    shortcut: 'Ctrl + Shift + W',
    description: 'Close all tabs in current workspace / close app window'
  },
  closeAppWindow: {
    isGlobal: false,
    isReadOnly: false,
    routes: ['all'],
    icon: 'mdi-close-box-outline',
    iconSize: '20px',
    action: {
      name: 'CLOSE_APP_WINDOW',
    },
    shortcut: 'Ctrl + Q',
    description: 'Close app window'
  },
  scrollTop: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['all'],
    icon: 'mdi-chevron-up',
    iconSize: '28px',
    action: {
      name: 'SCROLL_TOP_CONTENT_AREA'
    },
    shortcut: 'Shift + T',
    description: 'Scroll page to the top'
  },
  switchTab: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-tab',
    iconSize: '20px',
    action: {name: 'switchTab'},
    shortcut: 'Alt + [1 - 9]',
    description: 'Switch between tabs'
  },
  switchWorkspace: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-vector-arrange-below',
    action: {name: 'switchWorkspace'},
    shortcut: 'Alt + Shift + [1 - 9]',
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
    action: {name: 'SWITCH_ROUTE'},
    shortcut: 'Shift + [1 - 9]',
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
      options: 'addressBarEditor'
    },
    shortcut: 'Ctrl + /',
    description: 'Toggle address bar'
  },
  copyCurrentDirPath: {
    isGlobal: false,
    isReadOnly: false,
    routes: ['all'],
    icon: 'mdi-link-variant',
    action: {name: 'COPY_CURRENT_DIR_PATH'},
    shortcut: 'Ctrl + <',
    description: 'Copy current directory path to clipboard'
  },
  openCopiedPath: {
    isGlobal: false,
    isReadOnly: false,
    routes: ['all'],
    icon: 'mdi-link-variant',
    action: {
      name: 'OPEN_DIR_PATH_FROM_OS_CLIPBOARD'
    },
    shortcut: 'Ctrl + >',
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
      options: {
        asAdmin: false
      }
    },
    shortcut: 'Alt + T',
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
      options: {
        asAdmin: true
      }
    },
    shortcut: 'Alt + Shift + T',
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
    action: {name: 'TOGGLE_FILTER_FOCUS'},
    shortcut: 'Ctrl + F',
    description: 'Focus / unfocus filter field'
  },
  toggleGlobalSearch: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['all'],
    icon: 'mdi-magnify',
    action: {name: 'TOGGLE_GLOBAL_SEARCH'},
    shortcut: 'Ctrl + Shift + F',
    description: 'Show / hide global search'
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
      name: 'showNewDirItemDialog',
      options: 'directory',
    },
    shortcut: 'Alt + N',
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
      name: 'showNewDirItemDialog',
      options: 'file',
    },
    shortcut: 'Alt + M',
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
    iconSize: '20px',
    action: {
      name: 'OPEN_DIALOG',
      options: {
        dialogName: 'renameDirItemDialog'
      }
    },
    shortcut: 'F2',
    description: 'Rename selected items'
  },
  reloadDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-refresh',
    action: {
      name: 'RELOAD_DIR',
      options: {
        scrollTop: false,
        emitNotification: true
      }
    },
    shortcut: 'F5',
    description: 'Reload current directory'
  },
  openSelectedDirItem: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-open-in-app',
    action: {name: 'OPEN_LAST_SELECTED_DIRITEM'},
    shortcut: 'Enter',
    description: 'Open last selected directory item'
  },
  openSelectedDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-subdirectory-arrow-right',
    action: {name: 'OPEN_LAST_SELECTED_DIRITEM'},
    shortcut: 'Alt + E',
    description: 'Enter selected directory'
  },
  quitSelectedDirectory: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      dialogIsOpened: false
    },
    routes: ['navigator'],
    icon: 'mdi-subdirectory-arrow-left',
    action: {name: 'GO_UP_DIRECTORY'},
    shortcut: 'Alt + Q',
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
    iconSize: '26px',
    action: {name: 'NAVIGATE_DIR_UP'},
    shortcut: 'Alt + W',
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
    iconSize: '26px',
    action: {name: 'NAVIGATE_DIR_LEFT'},
    shortcut: 'Alt + A',
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
    iconSize: '26px',
    action: {name: 'NAVIGATE_DIR_DOWN'},
    shortcut: 'Alt + S',
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
    iconSize: '26px',
    action: {name: 'NAVIGATE_DIR_RIGHT'},
    shortcut: 'Alt + D',
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
    action: {name: 'LOAD_PREVIOUS_HISTORY_PATH'},
    shortcut: 'Alt + Left',
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
    action: {name: 'LOAD_NEXT_HISTORY_PATH'},
    shortcut: 'Alt + Right',
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
    action: {name: 'GO_UP_DIRECTORY'},
    shortcut: 'Alt + Up',
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
    action: {name: 'selectDirItem'},
    shortcut: 'Ctrl + LeftClick',
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
    action: {name: 'selectDirItemRange'},
    shortcut: 'Shift + LeftClick',
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
    action: {name: 'SELECT_ALL_DIR_ITEMS'},
    shortcut: 'Ctrl + A',
    description: 'Select all items in current directory'
  },
  setDirItemsForCopying: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-content-copy',
    iconSize: '20px',
    action: {
      name: 'SET_TO_FS_CLIPBOARD',
      options: {
        type: 'copy'
      }
    },
    shortcut: 'Ctrl + C',
    description: 'Set selected items for copying (replaces current list)'
  },
  addDirItemsForCopying: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-content-copy',
    iconSize: '20px',
    action: {
      name: 'ADD_TO_FS_CLIPBOARD',
      options: {
        type: 'copy'
      }
    },
    shortcut: 'Ctrl + Shift + C',
    description: 'Add selected items for copying. Allows to copy items from multiple directories at once'
  },
  setDirItemsForMoving: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-content-duplicate',
    iconSize: '20px',
    action: {
      name: 'SET_TO_FS_CLIPBOARD',
      options: {
        type: 'move'
      }
    },
    shortcut: 'Ctrl + X',
    description: 'Set selected items for moving'
  },
  addDirItemsForMoving: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-content-copy',
    iconSize: '20px',
    action: {
      name: 'ADD_TO_FS_CLIPBOARD',
      options: {
        type: 'move'
      }
    },
    shortcut: 'Ctrl + Shift + X',
    description: 'Add selected items for moving. Allows to move items from multiple directories at once'
  },
  pasteSelectedDirItems: {
    isGlobal: false,
    isReadOnly: false,
    conditions: {
      inputFieldIsActive: false
    },
    routes: ['navigator'],
    icon: 'mdi-swap-horizontal',
    iconSize: '24px',
    action: {
      name: 'PASTE_FS_CLIPBOARD_DIR_ITEMS'
    },
    shortcut: 'Ctrl + V',
    description: 'Transfer prepared for copying / moving items to current directory'
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
    action: {name: 'TRASH_SELECTED_DIR_ITEMS'},
    shortcut: 'Delete',
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
    action: {name: 'DELETE_SELECTED_DIR_ITEMS'},
    shortcut: 'Shift + Delete',
    description: 'Delete selected items from drive'
  },
  windowPosition: {
    isGlobal: false,
    isReadOnly: true,
    conditions: {},
    routes: ['all'],
    icon: 'mdi-axis-arrow',
    description: 'Quick window positioning',
    action: {name: 'windowPosition'},
    shortcut: {
      win32: 'Meta + [Left | Right | Up]', 
      linux: 'Meta + [Left | Right | Up | Down]'
    }
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
    action: {name: 'emoji'},
    shortcut: {
      win32: 'Meta + Dot', 
      darwin: 'Cmd + Ctrl + Space'
    }
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
    action: {name: 'clipboard'},
    shortcut: {win32: 'Meta + V'}
  }
}
