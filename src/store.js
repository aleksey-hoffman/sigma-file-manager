// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/* eslint-disable */
import Vue from 'vue'
import Vuex from 'vuex'
import { createNewSortInstance } from 'fast-sort'
import router from './router.js'
import utils from './utils/utils'
import localizeUtils from './utils/localizeUtils'
import TimeUtils from './utils/timeUtils.js'
import * as fsManager from './utils/fsManager'
import { getField, updateField } from 'vuex-map-fields'
import {readFile, readFileSync, writeFile, writeFileSync} from 'atomically'

const electron = require('electron')
const electronRemote = require('@electron/remote')
const fsExtra = require('fs-extra')
const sharedUtils = require('./utils/sharedUtils')
const eventHub = require('./utils/eventHub').eventHub
const localize = require('./utils/localize')
const os = require('os')
const fs = require('fs')
const PATH = require('path')
const childProcess = require('child_process')
const node7z = require('node-7z')
const navigatorCore = require('./utils/navigatorCore')
const externalLinks = require('./utils/externalLinks')
const SigmaAppUpdater = require('./utils/sigmaAppUpdater.js')
const getSystemRulesForPaths = require('./utils/systemRules').paths
const systemRulesForPaths = getSystemRulesForPaths()
const ColorUtils = require('./utils/colorUtils.js')
const appDataPaths = require('./appPaths.js')
const supportedFormats = require('./utils/supportedFormats.js')

const appPaths = {
  ...externalLinks,
  ...appDataPaths,
  public: __static,
  fileProtocol: 'sigma-file-manager',
  updateDownloadDir: appDataPaths.downloads,
  homeBannerMediaData: require('./homeBannerMediaData.js'),
  shortcuts: require('./shortcuts.js').default,
  globalSearchDataFiles: []
}

// Init class instances
let storageThrottle = new TimeUtils()
let appUpdater = new SigmaAppUpdater()
let colorUtils = new ColorUtils()
fsManager.initCliProcess()

const naturalSort = createNewSortInstance({
  comparer: new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }).compare,
})

Vue.use(Vuex)

export default new Vuex.Store({
  // strict: process.env.NODE_ENV === 'development',
  strict: false,
  state: {
    defaultData: {},
    appVersion: electronRemote.app.getVersion(),
    detectedLocale: electronRemote.app.getLocale(),
    appPaths,
    windowSize: {},
    appStatus: {
      state: 'active',
      instance: null,
      idleTreshold: 1000 * 30,
    },
    intervals: {
      lastSearchScanTimeElapsed: null,
      driveListFetchIntervalTime: 1000,
      driveListFetchInterval: null,
      globalSearchDataWatcher: null,
      localDirectoryShareServerSelfDistruction: null,
      localFileShareServerSelfDistruction: null,
    },
    timeouts: {
      tempRecentlyOpenedTimeout: null,
      tempRecentlyOpenedTimeoutTime: 5000,
    },
    workers: {
      globalSearchWorkers: [],
      dirWatcherWorker: null,
    },
    childProcesses: {
      localDirectoryShareServer: null,
      localFileShareServer: null,
      directorySize: null,
    },
    throttles: {
      windowResizeHandler: null
    },
    placeholders: {
      calculatingDirSize: 'Calculating...'
    },
    tasks: [],
    scheduler: {
      storageOperations: [],
    },
    notifications: [],
    drives: [],
    drivesPreviousData: [],
    routeScrollPosition: {},
    clipboardToolbar: false,
    appIsLoaded: false,
    navigatorRouteIsLoaded: false,
    invalidPathChars: systemRulesForPaths.invalidPathChars,
    invalidPaths: systemRulesForPaths.invalidPaths,
    invalidPathEndChars: systemRulesForPaths.invalidPathEndChars,
    appActionHistory: [],
    currentNotesList: 'existing',
    focusedField: '',
    addressBarEditor: false,
    homeBannerIsOffscreen: false,
    globalSearch: {
      query: '',
      results: [],
      widget: false,
      scanInProgress: false,
      searchInProgress: false,
      lastScanTimeElapsed: 0,
      options: {
        includeFiles: true,
        includeDirectories: true,
        selectedDrives: [],
        allDrivesSelected: true,
        exactMatch: false,
        matchSymbols: true,
        increasedTypoTolerance: true,
        exactCharBias: true,
      }
    },
    filterField: {
      view: {
        navigator: {
          query: '',
          options: {
            glob: false
          },
          filterProperties: [
            {
              name: 'name',
              title: 'item name',
              prefix: 'name:',
              property: 'name',
            },
            {
              name: 'itemCount',
              title: 'directory item count',
              prefix: 'items:',
              property: 'dirItemCount',
            },
            {
              name: 'fileSize',
              title: 'file size',
              prefix: 'size:',
              property: 'stat.size',
              isDeepProperty: true,
              processing: (propertyValue) => {
                return utils.prettyBytes(propertyValue, 1)
              }
            },
            {
              name: 'dateMetaModified',
              title: 'date meta modified',
              prefix: 'date-m:',
              property: 'stat.ctime',
              isDeepProperty: true,
              processing: (propertyValue) => {
                return utils.formatDateTime(propertyValue, 'D MMM YYYY')
              }
            }
          ]
        },
        notes: {
          query: '',
          options: {
            glob: false
          },
          filterProperties: [
            {
              name: 'title',
              title: 'note title',
              prefix: 'title:',
              property: 'title',
            },
            {
              name: 'content',
              title: 'note content',
              prefix: 'content:',
              property: 'content',
            },
            {
              name: 'group',
              title: 'note group',
              prefix: 'group:',
              property: 'group',
            },
          ]
        },
        dashboard: {
          query: '',
          options: {
            glob: false
          },
          filterProperties: [
            {
              name: 'path',
              title: 'item path',
              prefix: 'path:',
              property: 'path',
            }
          ]
        }
      }
    },
    sorting: {
      order: 'ascending',
      selectedType: { name: 'name', title: 'By name' },
      types: [
        { name: 'name', title: 'By name' },
        { name: 'size', title: 'By file size & item count' },
        { name: 'modified', title: 'By date | modified' },
        { name: 'created', title: 'By date | created' },
        // TODO: finish in v1.2.0
        // Should request to turn on the 'storeDirItemOpenCount'
        // { name: 'popularity', title: 'By popularity' },
      ]
    },
    navigatorView: {
      info: {},
      visibleDirItems: [],
      dirItemsInfoIsFetched: false,
      timeSinceLoadDirItems: 0,
      currentDir: {},
      dirItems: [],
      selectedDirItems: [],
      previouslySelectedDirItems: [],
      history: {
        currentIndex: 0,
        items: [],
        itemsRaw: [],
      },
      clipboard: {
        fs: {
          type: '',
          items: []
        }
      },
      infoPanelData: {
        title: '',
        type: '',
        mimeDescription: '',
        description: '',
        properties: []
      }
    },
    supportedMediaFormats: {
      image: ['jpg', 'png', 'avif', 'apng', 'gif', 'webp', 'jfif', 'svg', 'bmp', 'ico'],
      video: ['mp4', 'ogg', 'webm'],
      other: ['pdf', 'txt']
    },
    noteEditor: {
      html: '',
      currentNodePath: '',
      openedNote: {},
      defaultNote: {
        hashID: '',
        isTrashed: false,
        isProtected: false,
        dateWillBeDeleted: null,
        dateTrashed: null,
        dateCreated: null,
        dateModified: null,
        charCount: null,
        group: null,
        color: {
          title: 'transparent',
          value: '#ffffff00'
        },
        title: 'Title',
        content: ''
      }
    },
    storageData: {
      pinned: {
        fileName: 'pinned.json',
        items: []
      },
      protected: {
        fileName: 'protected.json',
        items: []
      },
      stats: {
        fileName: 'stats.json',
        dirItemsTimeline: [],
        dirItemsTimelineGroups: [],
      },
      notes: {
        fileName: 'notes.json',
        items: [],
        groups: [
          { name: 'TODO', value: 'todo' },
          { name: 'Work', value: 'work' },
          { name: 'Study', value: 'study' },
          { name: 'Health', value: 'health' },
        ],
        colors: [
          {
            title: 'transparent',
            value: '#ffffff00'
          },
          {
            title: 'red',
            value: '#ef5350'
          },
          {
            title: 'yellow',
            value: '#fff176'
          },
          {
            title: 'green',
            value: '#009688'
          },
          {
            title: 'blue',
            value: '#29b6f6'
          },
          {
            title: 'purple',
            value: '#9c27b0'
          },
          {
            title: 'grey',
            value: '#90a4ae'
          }
        ]
      },
      workspaces: {
        fileName: 'workspaces.json',
        workspaceTemplate: {
          id: null,
          isPrimary: false,
          isSelected: false,
          name: 'New workspace',
          lastOpenedDir: appPaths.userDataRoot,
          defaultPath: appPaths.userDataRoot,
          tabs: [],
          actions: []
        },
        workspaceActionTemplate: {
          id: null,
          name: 'New action',
          type: {
            name: 'open-url',
            icon: 'mdi-web'
          },
          command: ''
        },
        actionTypes: [
          {
            name: 'open-url',
            icon: 'mdi-web'
          },
          {
            name: 'open-path',
            icon: 'mdi-link-variant'
          },
          {
            name: 'terminal-command',
            icon: 'mdi-console'
          }
        ],
        items: [
          {
            id: 0,
            isPrimary: true,
            isSelected: true,
            name: 'Primary workspace',
            lastOpenedDir: appPaths.userDataRoot,
            defaultPath: appPaths.userDataRoot,
            tabs: [],
            actions: []
          }
        ]
      },
      settings: {
        fileName: 'settings.json',
        appProperties: {
          openAtLogin: true,
          openAsHidden: false,
        },
        // TODO: Move to stats:
        time: {
          lastSearchScan: null
        },
        lastRecordedAppVersion: null,
        isFirstAppLaunch: true,
        navigator: {
          showHiddenDirItems: false,
          openDirItemWithSingleClick: false,
          openDirItemSecondClickDelay: 500,
        },
        tips: [
          {
            name: 'firstTime:fileProtection',
            shown: false
          }
        ],
        adminPrompt: 'pkexec',
        adminPromptItems: ['built-in', 'pkexec'],
        appUpdates: {
          autoCheck: true,
          autoDownload: true,
          autoInstall: false,
        },
        globalSearch: {
          disallowedPaths: ['C:/Windows', '**/node_modules'],
          disallowedPathsItems: ['C:/Windows', '**/node_modules'],
        },
        globalSearchScanWasInterrupted: false,
        globalSearchScanDepth: 10,
        globalSearchAutoScanIntervalTime: 1000 * 60 * 30,
        globalSearchAutoScanIntervalItems: [
          1000 * 60 * 20,
          1000 * 60 * 30,
          1000 * 60 * 45,
          1000 * 60 * 60,
          1000 * 60 * 120,
          1000 * 60 * 240,
          1000 * 60 * 480,
          1000 * 60 * 720
        ],
        compressSearchData: true,
        windowCloseButtonAction: 'minimizeAppToTray',
        stats: {
          storeDirItemOpenEvent: true,
          storeDirItemOpenCount: true,
          storeDirItemOpenDate: true,
        },
        UIZoomLevel: 1,
        animations: {
          onRouteChangeMediaBannerIn: true
        },
        input: {
          pointerButtons: {
            button3: {
              onMouseUpEvent: {
                title: 'Open previous page in history',
                action: 'default'
              },
              onMouseUpEventItems: [
                {
                  title: 'Open previous page in history',
                  action: 'default'
                },
                {
                  title: 'Navigator: open previous directory in history',
                  action: 'LOAD_PREVIOUS_HISTORY_PATH'
                }
              ]
            },
            button4: {
              onMouseUpEvent: {
                title: 'Open next page in history',
                action: 'default'
              },
              onMouseUpEventItems: [
                {
                  title: 'Open next page in history',
                  action: 'default'
                },
                {
                  title: 'Navigator: open next directory in history',
                  action: 'LOAD_NEXT_HISTORY_PATH'
                }
              ]
            }
          }
        },
        navigatorLayout: 'list',
        navigatorLayoutItemHeight: {
          directory: 48,
          file: 48
        },
        dirItemHoverEffect: 'scale',
        thumbnailStorageLimit: 100,
        autoCalculateDirSize: false,
        lastOpenedSettingsTab: 0,
        groupDirItems: false,
        focusFilterOnDirectoryChange: false,
        markdownShortcuts: true,
        spellcheck: true,
        focusMainWindowOnDriveConnected: true,
        showUserNameOnUserHomeDir: true,
        shortcuts: appPaths.shortcuts,
        localization: {
          selectedLanguage: {
            name: 'English',
            locale: 'en'
          },
          availableLanguages: [
            {
              name: 'English',
              locale: 'en'
            }
          ]
        },
        driveCard: {
          progressType: 'linearVertical',
          showProgress: true
        },
        dashboard: {
          selectedTab: null,
          tabs: {
            pinned: {
              title: 'Pinned',
              show: true,
              icon: 'mdi-pin-outline'
            },
            protected: {
              title: 'Protected',
              show: true,
              icon: 'mdi-shield-check-outline'
            },
            timeline: {
              title: 'Timeline',
              show: true,
              icon: 'mdi-timeline-clock-outline'
             }
          }
        },
        infoPanels: {
          navigatorView: {
            value: true,
            data: {}
          }
        },
        theme: {
          type: 'dark',
          toolbarColorOptions: {
            light: '#9e9e9e',
            dark: '#757575'
          },
          toolbarColor: 'rgb(44, 47, 53)',
          toolbarColorItems: [
            'rgb(44, 47, 53)',
            'rgb(48, 51, 59)',
            'rgb(52, 55, 63)',
          ]
        },
        externalPrograms: {
          programTemplate: {
            name: 'New program',
            path: '',
            icon: 'mdi-cube-outline',
            targetTypes: [],
            askForArguments: false
          },
          defaultItems: [
             {
              name: 'Quick view',
              action: () => {
                eventHub.$emit('openWithQuickView')
              },
              readonly: true,
              path: '',
              icon: 'mdi-card-search-outline',
              askForArguments: false,
              targetTypes: ['file', 'file-symlink'],
            },
            {
              name: 'Default file manager',
              action: () => {
                eventHub.$emit('openInNativeFileManager')
              },
              readonly: true,
              path: '',
              icon: 'mdi-folder-cog-outline',
              askForArguments: false,
              targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
            },
            {
              name: 'Terminal',
              action: () => {
                eventHub.$emit('openInTerminal')
              },
              readonly: true,
              path: '',
              icon: 'mdi-console',
              askForArguments: false,
              targetTypes: ['directory', 'directory-symlink'],
            },
            {
              name: 'Terminal as admin',
              action: () => {
                eventHub.$emit('openInTerminalAsAdmin')
              },
              readonly: true,
              path: '',
              icon: 'mdi-console',
              askForArguments: false,
              targetTypes: ['directory', 'directory-symlink'],
            }
          ],
          items: [],
          icons: [
            'mdi-cube-outline',
            'mdi-package-variant-closed',
            'mdi-package-variant',
            'mdi-webpack',
            'mdi-console',
            'mdi-code-tags',
            'mdi-code-braces',
            'mdi-atom',
            'mdi-book-open-outline',
            'mdi-television-play',
            'mdi-play-network-outline',
            'mdi-download-outline',
            'mdi-import',
            'mdi-export-variant',
            'mdi-wallpaper',
            'mdi-image-multiple-outline',
            'mdi-music-box-outline',
            'mdi-bookmark-music-outline',
            'mdi-message-video',
            'mdi-movie-open-outline',
            'mdi-file-outline',
            'mdi-file-document-outline',
            'mdi-folder-cog-outline',
            'mdi-video-3d',
            'mdi-gamepad-variant-outline',
            'mdi-microphone-outline',
            'mdi-history',
            'mdi-lock-open-outline',
          ]
        },
        homeBanner: {
          value: true,
          height: 56,
          selectedItem: appPaths.homeBannerMediaData.defaultItem,
          itemTemplate: {
            isDefault: false,
            isCustom: false,
            positionX: 50,
            positionY: 50,
            fileNameBase: '',
            path: '',
            type: ''
          },
          items: appPaths.homeBannerMediaData.items,
          overlay: {
            selectedItem: {
              title: 'Overlay fade',
              name: 'overlayFade',
              params: {
                topFadeHeight: '128px',
                bottomFadeHeight: '128px'
              }
            },
            items: [
              {
                title: 'None',
                name: 'none'
              },
              {
                title: 'Overlay fade',
                name: 'overlayFade',
                params: {
                  topFadeHeight: '128px',
                  bottomFadeHeight: '128px'
                }
              },
              {
                title: 'Mask fade',
                name: 'maskFade',
                params: {
                  bottomMaskHeight: '200px'
                }
              },
              // TODO: finish in v1.2.0
              // {
              //   title: 'Color gradient',
              //   name: 'colorGradient',
              //   params: {}
              // },
              // {
              //   title: 'Custom',
              //   name: 'custom',
              //   params: {}
              // }
            ],
            // TODO: move to types[name === 'colorGradient].params
            selected: 'linear-gradient(45deg, rgb(100, 115, 201, 0.5), rgb(25, 32, 72, 0.5))',
            variants: [
              'linear-gradient(45deg, rgb(100, 115, 201, 0.5), rgb(25, 32, 72, 0.5))',
              'linear-gradient(45deg, rgb(19, 84, 122, 0.5), rgb(128, 208, 199, 0.8))',
              'linear-gradient(45deg, rgb(55, 236, 186, 0.5), rgb(25, 32, 72, 0.5))'
            ]
          },
        },
      }
    },
    navigationPanel: {
      model: false,
      miniVariant: true,
      items: [
        {
          icon: 'mdi-apps',
          title: 'page_home_title',
          to: '/'
        },
        {
          icon: 'mdi-folder-outline',
          title: 'page_navigator_title',
          to: '/navigator'
        },
        {
          // icon: 'mdi-bookmark-outline',
          icon: 'mdi-bookmark-multiple-outline',
          // icon: 'mdi-account-circle-outline',
          title: 'page_dashboard_title',
          to: '/dashboard'
        },
        {
          icon: 'mdi-square-edit-outline',
          title: 'page_notes_title',
          to: '/notes'
        },
        {
          icon: 'mdi-cog-outline',
          title: 'page_settings_title',
          to: '/settings'
        }
      ]
    },
    menus: {
      workspaces: false,
      tabs: false,
    },
    contextMenus: {
      homeBanner: {
        value: false,
        targetItems: [],
        targetItemsStats: {},
      },
      dirItem: {
        value: false,
        x: null,
        y: null,
        targetItems: [],
        targetItemsStats: {},
        subMenu: {
          value: false,
          target: '',
          title: ''
        }
      },
    },
    inputState: {
      alt: false,
      ctrl: false,
      shift: false,
      meta: false,
      pointer: {
        hover: {
          itemType: '',
          item: {}
        },
        button1: false,
        button2: false,
        button3: false,
        hoveredItem: {
          path: '',
          id: ''
        },
      },
    },
    overlays: {
      inboundDrag: false,
      dirItemDrag: false
    },
    drag: {
      targetType: '',
      cursorIsMoving: false,
      mouseIsMoving: false,
      moveTreshold: 16,
      moveTresholdReached: false,
      cursorLeftWindow: false,
      watchingItemOverlap: false,
      dirItemInbound: {
        value: false
      },
      dirItemOutbound: {
        value: false
      },
    },
    localServer: {
      directoryShare: {
        ip: '',
        port: '',
        address: '',
        server: null,
        item: {}
      },
      fileShare: {
        ip: '',
        port: '',
        address: '',
        server: null,
        type: 'stream',
        item: {}
      }
    },
    dialogs: {
      errorDialog: {
        value: false,
        data: {}
      },
      conformationDialog: {
        value: false,
        data: {
          title: '',
          message: '',
          closeButton: {},
          buttons: [
            {
              text: '',
              onClick: () => {}
            }
          ]
        }
      },
      guideDialog: {
        value: false,
        data: {
          guideTabsSelected: 0,
          guideTabs: [
            {text: 'Early development'},
            {text: 'Shortcuts'},
            {text: 'Data protection'},
            {text: 'Address bar'},
            {text: 'Navigator tips'},
            {text: 'COMING SOON'},
          ],
        }
      },
      shortcutsDialog: {
        value: false
      },
      shortcutEditorDialog: {
        value: false,
        data: {
          rawShortcut: '',
          shortcut: '',
          shortcutName: '',
          key: '',
          modifiers: [],
          isValid: false,
          error: ''
        }
      },
      archiverDialog: {
        value: false,
        data: {
          isValid: true,
          error: '',
          selectedFormat: 'zip',
          formats: supportedFormats.formats.fileType.archivePack,
          dest: {
            name: ''
          }
        }
      },
      renameDirItemDialog: {
        value: false,
        data: {
          name: '',
          isValid: false,
          error: ''
        }
      },
      newDirItemDialog: {
        value: false,
        data: {
          type: '',
          name: '',
          isValid: false,
          error: ''
        }
      },
      dirItemPermissionManagerDialog: {
        value: false,
        data: {
          path: '',
          permissionData: {},
          user: {
            selected: {},
            unspecifiedItems: [
              {
                uid: '*S-1-1-0',
                text: 'Everyone'
              }
            ],
            items: []
          },
          win32: {
            selectedPermissions: [],
            permissions: ['read', 'write', 'execute']
          },
          permissionGroups: {
            owner: {
              selected: {},
              items: []
            },
            group: {
              selected: {},
              items: []
            },
            everyone: {
              selected: {},
              items: []
            }
          }
        }
      },
      homeBannerPickerDialog: {
        value: false
      },
      homeBannerPositionDialog: {
        value: false
      },
      homeBannerHeightDialog: {
        value: false
      },
      homeBannerOverlayDialog: {
        value: false
      },
      workspaceEditorDialog: {
        value: false,
        data: {
          items: [],
          selected: [],
          selectedAction: [],
          actionTypes: []
        }
      },
      programEditorDialog: {
        value: false,
        specifiedHashID: null,
        data: {
          programs: [],
          selectedProgram: {},
          allowedFileTypes: [
            'type:image', 'type:video', 'type:audio',
            'exe', 'txt', 'pdf', 'png', 'jpg', 'psd',
            'mp4', 'avi', 'ts', 'mp3', 'wav', 'webm'
          ],
          disallowedFileTypes: [
            'png', 'jpg', 'psd', 'mp4', 'avi', 'ts', 'mp3', 'wav', 'webm'
          ],
          selectedAllowedFileTypes: [],
          selectedDisallowedFileTypes: [],
        }
      },
      noteEditorDialog: {
        value: false
      },
      imagePickerDialog: {
        value: false,
        data: {
          path: '',
          float: 'none',
          width: '25%',
          height: 'auto',
          loadImage: () => {}
        }
      },
      mathEditorDialog: {
        value: false,
        data: {
          type: 'add',
          formula: '',
          framework: '',
          addFormula: () => {}
        }
      },
      externalDownloadDialog: {
        value: false,
        data: {
          url: '',
          directory: '',
          video: {
            selectedType: 'Video with audio',
            types: ['Video with audio', 'Video only', 'Audio only'],
            quality: '720p',
            videoFormat: '',
            qualityItems: ['240p', '360p', '480p', '720p', '1080p', '1440p', '2160p'],
            audioFormat: 'webm',
            audioFormatItems: ['mp3', 'm4a', 'webm'],
          },
        }
      },
      localShareManagerDialog: {
        value: false,
        data: {
          shareType: 'file'
        }
      }
    },
  },
  getters: {
    getField,
    uiState: (state, getters) => {
      const someDialogIsOpen = getters.someDialogIsOpened
      return {
        someDialogIsOpen
      }
    },
    computedShortcuts: (state, getters) => {
      function formatString(string) {
        return string
          .replace(/\s/g, '')
          .replace(/Delete/g, 'del')
          .replace(/Backtick/g, '`')
          .replace(/Plus/g, '+')
          .replace(/Minus/g, '-')
          .replace(/</g, ',')
          .replace(/>/g, '.')
          .toLowerCase()
      }
      let shortcutsList = utils.cloneDeep(state.storageData.settings.shortcuts)
      for (const [key, value] of Object.entries(shortcutsList)) {
        if (typeof value.shortcut === 'string') {
          value.shortcut = formatString(value.shortcut)
        }
        else {
          if (value.shortcut.win32 && getters.systemInfo.platform === 'win32') {
            value.shortcut = formatString(value.shortcut.win32)
          }
          else if (value.shortcut.darwin && getters.systemInfo.platform === 'darwin') {
            value.shortcut = formatString(value.shortcut.darwin)
          }
        }
      }
      return shortcutsList
    },
    someDialogIsOpened: state => {
      return Object.values(state.dialogs).some(dialog => {
        return dialog.value
      })
    },
    firstDirItemIndex: (state, getters) => {
      return utils.getMinObjectNumber({
        items: state.navigatorView.dirItems,
        value: 'dirItemPositionIndex'
      })
    },
    lastDirItemIndex: (state, getters) => {
      return utils.getMaxObjectNumber({
        items: state.navigatorView.dirItems,
        value: 'dirItemPositionIndex'
      })
    },
    firstDirItem: (state, getters) => {
      return state.navigatorView.dirItems.find(item => {
        return item.dirItemPositionIndex === getters.firstDirItemIndex
      })
    },
    lastDirItem: (state, getters) => {
      return state.navigatorView.dirItems.find(item => {
        return item.dirItemPositionIndex === getters.lastDirItemIndex
      })
    },
    lastSelectedDirItem: (state, getters) => {
      return state.navigatorView.selectedDirItems.getLast()
    },
    isFirstDirItemSelected: (state, getters) => {
      return getters.selectedDirItems.some(item => item.path === getters.firstDirItem.path)
    },
    isLastDirItemSelected: (state, getters) => {
      return getters.selectedDirItems.some(item => item.path === getters.lastDirItem.path)
    },
    navigatorGridData: (state, getters) => {
      let rowData = getRowContainingSelectedDirItem()
      let itemData = getItemData(rowData)
      let dirItemNodes = document.querySelectorAll('.dir-item-card')
      let selectedDirItemNode
      dirItemNodes.forEach(node => {
        if (node.dataset.itemPath === state.navigatorView.selectedDirItems.getLast().path) {
          selectedDirItemNode = node
        }
      })

      let data = {
        rowIndex: rowData.rowIndex,
        rowPositionIndex: rowData.row.positionIndex,
        type: rowData.row.type,
        inFirstRow: rowData.rowIndex === 0,
        inLastRow: rowData.rowIndex === getters.dirItemRows.length - 1,
        gridUpIndex: itemData.gridUpIndex,
        gridDownIndex: itemData.gridDownIndex,
        row: itemData.row,
        isDirItemNodeInViewport: isInViewport(selectedDirItemNode),
        selectedDirItemNode
      }

      function isInViewport (node) {
        if (!node) {return false}
        const nodeRect = node.getBoundingClientRect()
        return (
          nodeRect.top >= 0 &&
          nodeRect.left >= 0 &&
          nodeRect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
          nodeRect.right <= (window.innerWidth || document.documentElement.clientWidth)
        )
      }

      function getItemData (rowData) {
        let data = {
          gridUpIndex: 0,
          gridDownIndex: 0,
          row: getters.dirItemRows[rowData.rowIndex],
          previousRow: getters.dirItemRows[rowData.rowIndex - 1],
          nextRow: getters.dirItemRows[rowData.rowIndex + 1],
          previousPotentialItemSelectionIndex: 0,
          nextPotentialItemSelectionIndex: 0,
        }
        if (data.previousRow) {
          data.previousPotentialItemSelectionIndex = data.previousRow.items[rowData.columnIndex]?.dirItemPositionIndex
          if (data.previousPotentialItemSelectionIndex) {
            data.gridUpIndex = data.previousPotentialItemSelectionIndex
          }
          else if (!data.previousPotentialItemSelectionIndex && getters.dirItemRows[rowData.rowIndex - 2]) {
            data.gridUpIndex = getters.dirItemRows[rowData.rowIndex - 2].items[rowData.columnIndex].dirItemPositionIndex
          }
        }
        if (data.nextRow) {
          data.nextPotentialItemSelectionIndex = data.nextRow.items[rowData.columnIndex]?.dirItemPositionIndex
          if (data.nextPotentialItemSelectionIndex) {
            data.gridDownIndex = data.nextPotentialItemSelectionIndex
          }
          else if (!data.nextPotentialItemSelectionIndex && getters.dirItemRows[rowData.rowIndex + 2]) {
            data.gridDownIndex = getters.dirItemRows[rowData.rowIndex + 2].items[rowData.columnIndex].dirItemPositionIndex
          }
        }
        return data
      }

      function getRowContainingSelectedDirItem () {
        let data = {
          rowIndex: null,
          columnIndex: null,
          row: null
        }
        getters.dirItemRows.forEach((row, rowIndex) => {
          row.items.forEach((item, columnIndex) => {
            const rowContainsItem = item.dirItemPositionIndex === state.navigatorView.selectedDirItems.getLast().dirItemPositionIndex
            if (rowContainsItem) {
              data.rowIndex = rowIndex
              data.row = row
              data.columnIndex = columnIndex
            }
          })
        })
        if (data.columnIndex !== null) {
          return data
        }
      }
      return data
    },
    dirItemRows: (state, getters) => {
      const directoryRows = state.navigatorView.info.directoryRowsFormatted
      const fileRows = state.navigatorView.info.fileRowsFormatted
      if (directoryRows && fileRows) {
        return [
          ...state.navigatorView.info.directoryRowsFormatted,
          ...state.navigatorView.info.fileRowsFormatted
        ]
      }
      else {
        return []
      }
    },
    isCurrentDirItemSelected: (state, getters) => {
      return getters.selectedDirItemsPaths.includes(state.navigatorView.currentDir.path)
    },
    isOnlyCurrentDirItemSelected: (state, getters) => {
      return getters.selectedDirItems.length === 1 &&
        getters.selectedDirItems[0].path === state.navigatorView.currentDir.path
    },
    currentDirName: state => {
      const parsed = PATH.parse(state.navigatorView.currentDir.path)
      const isRoot = parsed.base === ''
      return isRoot ? parsed.root : parsed.name
    },
    itemDragIsActive: state => {
      return state.drag.dirItemInbound.value || state.drag.dirItemOutbound.value
    },
    primaryWorkspace: state => {
      return state.storageData.workspaces.items.find(workspace => workspace.isPrimary)
    },
    selectedWorkspace: state => {
      return state.storageData.workspaces.items.find(workspace => workspace.isSelected)
    },
    clipboardToolbarIsVisible: (state, getters) => {
      return getters.selectedDirItems.length > 1
    },
    highlightedDirItems: (state, getters) => {
      return state.navigatorView.dirItems.filter(item => item.isHighlighted)
    },
    selectedDirItems: (state, getters) => {
      return state.navigatorView.selectedDirItems
    },
    selectedDirItemsPaths: (state, getters) => {
      return getters.selectedDirItems.map(item => item.path)
    },
    selectedFilesPaths: (state, getters) => {
      return getters.selectedFiles.map(item => item.path)
    },
    selectedDirectoriesPaths: (state, getters) => {
      return getters.selectedDirectories.map(item => item.path)
    },
    selectedDirItemsExtensions: (state, getters) => {
      if (getters.selectedDirItemsPaths.length === 0) { return [] }
      return [...new Set(getters.selectedDirItemsPaths.map(path => PATH.parse(path).ext.replace('.', '')))]
    },
    selectedDirectories: (state, getters) => {
      return [...getters.selectedDirItems.filter(item => {
        return item.type === 'directory'
      })]
    },
    selectedFiles: (state, getters) => {
      return [...getters.selectedDirItems.filter(item => {
        return item.type === 'file'
      })]
    },
    selectedSymlinks: (state, getters) => {
      return [...getters.selectedDirItems.filter(item => {
        return item.type.includes('symlink')
      })]
    },
    selectedFileSymlinks: (state, getters) => {
      return [...getters.selectedDirItems.filter(item => {
        return item.type.includes('file-symlink')
      })]
    },
    selectedDirectorySymlinks: (state, getters) => {
      return [...getters.selectedDirItems.filter(item => {
        return item.type.includes('directory-symlink')
      })]
    },
    selectedDirItemsFileTypes: (state, getters) => {
      const types = {
        mime: [],
        readable: []
      }
      getters.selectedFiles.forEach(item => {
        const type = utils.getFileType(item.realPath)
        const typeMime = type.mime
        const typeReadable = type.mimeDescription
        if (!types.mime.includes(typeMime)) {
          types.mime.push(typeMime)
        }
        if (!types.readable.includes(typeReadable)) {
          types.readable.push(typeReadable)
        }
      })
      return types
    },
    dirItemsSelectionStats: (state, getters) => {
      const totalCount = getters.selectedDirItems.length
      const directoryCount = getters.selectedDirectories.length
      const fileCount = getters.selectedFiles.length
      const symlinkCount = getters.selectedSymlinks.length
      const directorySymlinkCount = getters.selectedDirectorySymlinks.length
      const fileSymlinkCount = getters.selectedFileSymlinks.length
      const fileExtensions = getters.selectedDirItemsExtensions
      const fileTypes = getters.selectedDirItemsFileTypes.mime
      const fileTypesReadable = getters.selectedDirItemsFileTypes.readable
      const selectionType = totalCount === 1
        ? 'single'
        : totalCount > 1
        ? 'multiple'
        : 'none'

      const data = {
        totalCount,
        directoryCount,
        fileCount,
        symlinkCount,
        fileExtensions,
        fileTypes,
        fileTypesReadable,
        types: ['directory', 'file', 'file-symlink', 'directory-symlink'].filter(type => {
          const conditions = [
            type === 'directory' && directoryCount !== 0,
            type === 'file' && fileCount !== 0,
            type === 'file-symlink' && fileSymlinkCount !== 0,
            type === 'directory-symlink' && directorySymlinkCount !== 0
          ]
          return conditions.some(condition => condition === true)
        }),
        selectionType: selectionType
      }
      return data
    },
    windowToolbarFontColor: state => {
      const color = state.storageData.settings.theme.toolbarColor
      const lightness = colorUtils.getColorData(color).lightness
      if (lightness > 186) {
        return state.storageData.settings.theme.toolbarColorOptions.dark
      }
      else {
        return state.storageData.settings.theme.toolbarColorOptions.light
      }
    },
    systemInfo: state => {
      return {
        platform: process.platform,
        release: os.release()
      }
    },
    homeBannerSelectedMedia: state => {
      return state.storageData.settings.homeBanner.selectedItem
    },
    homeBannerSelectedOverlay: state => {
      return state.storageData.settings.homeBanner.overlay.selected
    }
  },
  mutations: {
    updateField,
    SET (state, payload) {
      // Set specified deep state property
      utils.setDeepProperty(state, payload.key.split('.'), payload.value)
    },
    PUSH (state, payload) {
      let list = utils.getDeepProperty(state, payload.key)
      list.push(payload.value)
      utils.setDeepProperty(state, payload.key.split('.'), list)
    },
    UPDATE_PROPERTY_DIRECTLY (state, payload) {
      // TODO: Cannot handle deep properties yet
      payload.object[payload.key] = payload.value
    },
    TOGGLE (state, key) {
      const value = utils.getDeepProperty(state, key)
      utils.setDeepProperty(state, key.split('.'), !value)
    },
    ADD_TO_HISTORY (state, options) {
      let historyItems = state.navigatorView.history.items
      let historyItemsRaw = state.navigatorView.history.itemsRaw
      let lastHistoryElement = historyItems[historyItems.length - 1]
      let pathMatchesLastHistoryPath = lastHistoryElement === options.path
      // Add path to "raw" list
      historyItemsRaw.push(options.path)
      // Add path to "no-consecutive-dups" list
      if (!pathMatchesLastHistoryPath && !options.skipHistory) {
        historyItems.push(options.path)
        state.navigatorView.history.currentIndex = historyItems.length - 1
      }
    },
    SET_WORKSPACES (state, workspaces) {
      state.storageData.workspaces.items = workspaces
    },
    SELECT_WORKSPACE (state, specifiedWorkspace) {
      // De-select all workspaces
      state.storageData.workspaces.items.forEach(workspace => {
        workspace.isSelected = false
      })
      // Select specified workspace
      specifiedWorkspace.isSelected = true
    },
    DELETE_ALL_NOTES_IN_TRASH (state) {
      const notes = state.storageData.notes.items
      state.storageData.notes.items = notes.filter(note => !note.isTrashed)
    },
    DELETE_NOTE (state, note) {
      const notes = state.storageData.notes.items
      state.storageData.notes.items = notes.filter(item => item.hashID !== note.hashID)
    },
    MOVE_NOTE_TO_TRASH (state, note) {
      const daysUntilDeleted = 7
      const currentDate = new Date().getTime()
      note.isTrashed = true
      note.dateTrashed = currentDate
      note.dateWillBeDeleted = new Date(currentDate + (daysUntilDeleted * 86400000)).getTime()
    },
    RESTORE_NOTE_FROM_TRASH (state, note) {
      note.isTrashed = false
      note.dateTrashed = null
      note.dateWillBeDeleted = null
    },
    SET_SORTING_TYPE (state, sortingType) {
      const types = state.sorting.types
      state.sorting.selectedType = sortingType
    },
    TOGGLE_SORTING_ORDER (state) {
      const order = state.sorting.order
      state.sorting.order = order === 'ascending'
        ? 'descending'
        : 'ascending'
    },
    SORT_DIR_ITEMS (state) {
      const order = state.sorting.order
      const sortingType = state.sorting.selectedType

      if (sortingType.name === 'name') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => dirItem.name)
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => dirItem.name)
      }
      else if (sortingType.name === 'size') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => {
              return ['file', 'file-symlink'].includes(dirItem.type)
                ? dirItem.stat.size
                : dirItem.dirItemCount
            })
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => {
              return ['file', 'file-symlink'].includes(dirItem.type)
                ? dirItem.stat.size
                : dirItem.dirItemCount
            })
      }
      else if (sortingType.name === 'modified') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => Math.round(dirItem.stat.mtimeMs))
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => Math.round(dirItem.stat.mtimeMs))
      }
      else if (sortingType.name === 'created') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => Math.round(dirItem.stat.birthtimeMs))
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => Math.round(dirItem.stat.birthtimeMs))
      }
    },
    HIGHLIGHT_DIR_ITEM_RANGE (state, payload) {
      let startRangeIndex = state.navigatorView.selectedDirItems.getLast().dirItemPositionIndex
      let endRangeIndex = payload.hoveredItem.dirItemPositionIndex
      // Swap indexes, if needed
      if (startRangeIndex > endRangeIndex) {
        [startRangeIndex, endRangeIndex] = [endRangeIndex, startRangeIndex]
      }
      // Highlight items
      state.navigatorView.dirItems.forEach(item => {
        if (startRangeIndex <= item.dirItemPositionIndex && item.dirItemPositionIndex <= endRangeIndex) {
          item.isHighlighted = true
        }
      })
    },
    DEHIGHLIGHT_ALL_DIR_ITEMS (state) {
      state.navigatorView.dirItems.forEach(item => {
        item.isHighlighted = false
      })
    },
    DESELECT_DIR_ITEM (state, payload) {
      const {
        getters,
        specifiedItem
      } = payload

      // Update selectedDirItems list
      const itemIndex = state.navigatorView.selectedDirItems.findIndex(item => {
        return item.path === specifiedItem.path
      })
      if (itemIndex !== -1) {
        state.navigatorView.selectedDirItems.splice(itemIndex, 1)
      }
    },
    ADD_SELECTED_TO_STORAGEDATA_FILE_LIST (state, payload) {
      const { listName, selectedDirItems } = payload
      selectedDirItems.forEach(item => {
        state.storageData[listName].items.unshift(item)
      })
    },
    REMOVE_SELECTED_FROM_STORAGEDATA_FILE_LIST (state, payload) {
      const { listName, selectedDirItems } = payload
      selectedDirItems.forEach(item => {
        const itemIndex = state.storageData[listName].items.findIndex(listItem => listItem.path === item.path)
        const selectedIsOntheList = itemIndex !== -1
        if (selectedIsOntheList) {
          state.storageData[listName].items.splice(itemIndex, 1)
        }
      })
    },
    OPEN_SELECTED_IN_TERMINAL (state, payload) {
      payload.selectedDirItems.forEach(item => {
        if (process.platform === 'win32') {
          const path = item.path.replace(/([!@#$%^&*()_+])/g, '\"$1\"')
          if (payload.asAdmin) {
            try {
              childProcess.exec(`powershell -command "Start-Process cmd '/k cd /d \\"${path}\\"' -Verb RunAs"`)
            } catch (error) { }
          }
          else {
            try {
              childProcess.exec(`start cmd /k cd /d \"${item.path}\"`)
            } catch (error) { }
          }
        }
        else if (process.platform === 'darwin') {
          // Method 1
          // let terminal = spawn("open", ["-a", "Terminal", item.path])
          // Method 2
          childProcess.exec(`open -a Terminal ${item.path}`)
        }
        else if (process.platform === 'linux') {
          const terminalPath = "/usr/bin/gnome-terminal"
          let terminal = childProcess.spawn(terminalPath, { cwd: item.path })
          terminal.on("error", error => {
            alert("Could not launch terminal: ", error)
          })
        }
      })
    },
    OPEN_WITH_CUSTOM_APP (state, app) {
      const path = state.navigatorView.selectedDirItems.getLast().path
      try {
        childProcess.exec(`"${app.path}" "${path}"`)
      }
      catch (error) {
        console.error(error)
      }
    }
  },
  actions: {
    /**
    * @param {string} payload.key
    * @param {any} payload.value
    * @param {object} payload.options
    * @param {boolean} payload.options.updateStorage
    */
    async SET (store, payload) {
      payload.options = {
        ...{
          updateStorage: true,
          postProcess: true
        },
        ...payload.options
      }
      try {
        payload.key = payload.key.replace(/^(state\.)/, '')
        store.commit('SET', payload)
        if (shouldUpdateStorageFile()) {
          let data = await updateStorageFile(payload)
          if (payload.options.postProcess) {
            // await store.dispatch('STORAGE_UPDATE_POST_PROCESS', payload)
          }
          return data
        }
      }
      catch (error) {
        throw Error(error)
      }

      async function updateStorageFile (payload) {
        return new Promise((resolve, reject) => {
          payload = appendStoragePropertyFileName(payload)
          // Throttle storage writing for properties of the same origin
          // to avoid updating specific value too frequently
          storageThrottle.throttleScheduled({
            time: 250,
            debounceOnLastCall: true,
            onThrottleRunning: () => {
              scheduleTask(payload)
              const tasksClone = utils.cloneDeep(store.state.scheduler.storageOperations)
              unscheduleTasks()
              if (tasksClone.length > 0) {
                writeToStorage(tasksClone)
                  .then((data) => {
                    resolve(data)
                  })
              }
              else {
                resolve()
              }
            },
            onThrottleWaiting: () => {
              scheduleTask(payload)
              resolve()
            }
          })
        })
      }

      function scheduleTask (payload) {
        let existingTask = store.state.scheduler.storageOperations.find(task => task.key === payload.key)
        if (existingTask) {
          existingTask.value = payload.value
        }
        else {
          store.state.scheduler.storageOperations.push(payload)
        }
      }

      function unscheduleTasks () {
        store.state.scheduler.storageOperations = []
      }

      function shouldUpdateStorageFile () {
          const propertiesRequireStorageUpdate = [
          'storageData'
        ]
        const propertyRequiresStorageUpdate = propertiesRequireStorageUpdate.some(property => {
          return payload?.key?.startsWith(property)
        })
        return propertyRequiresStorageUpdate && payload?.options?.updateStorage
      }

      function appendStoragePropertyFileName (payload) {
        let updatedPayload = utils.cloneDeep(payload)
        const storageObjectName = updatedPayload.key.split('.')[1]
        const referenceObject = utils.getDeepProperty(store.state, `storageData.${storageObjectName}`)
        const fileName = referenceObject.fileName
        updatedPayload.fileName = fileName
        return updatedPayload
      }

      async function writeToStorage (payload) {
        try {
          let updatedPayload = filterProperties(payload)
          return await store.dispatch('UPDATE_STORAGE_FILE', updatedPayload)
        }
        catch (error) {
          throw Error(error)
        }
      }

      function filterProperties (payload) {
        const storedProperties = {
          'storageData.stats.dirItemsTimeline': ['path', 'openCount', 'openDate'],
          'storageData.pinned.items': ['path'],
          'storageData.protected.items': ['path']
        }
        for (const [key, value] of Object.entries(storedProperties)) {
          if (key === payload[0].key) {
            // Keep only allowed properties
            payload[0].value = payload[0].value.map(listItem => {
              const data = {}
              value.forEach(prop => {
                data[prop] = listItem[prop]
              })
              return data
            })
          }
        }
        return payload
      }
    },
    STORAGE_UPDATE_POST_PROCESS (store, params) {
      if (params.key === 'storageData.settings.stats.storeDirItemOpenEvent') {
        if (params.value === false) {
          store.dispatch('SET', {
            key: 'storageData.stats.dirItemsTimeline',
            value: [],
            options: {postProcess: false}
          })
        }
      }
      if (params.key === 'storageData.settings.stats.storeDirItemOpenCount') {
        if (params.value === false) {
          deleteProperty({
            key: 'storageData.stats.dirItemsTimeline',
            value: store.state.storageData.stats.dirItemsTimeline,
            propertyName: 'openCount'
          })
        }
      }
      else if (params.key === 'storageData.settings.stats.storeDirItemOpenDate') {
        if (params.value === false) {
          deleteProperty({
            key: 'storageData.stats.dirItemsTimeline',
            value: store.state.storageData.stats.dirItemsTimeline,
            propertyName: 'openDate'
          })
        }
      }

      function deleteProperty (params) {
        params.value.forEach(item => {
          delete item[params.propertyName]
        })
        store.dispatch('SET', {
          key: params.key,
          value: params.value,
          options: {postProcess: false}
        })
      }
    },
    /**
    * Description: state-storage writing process:
    * 1. Modify data directly in store
    * 2. Write specific data properties to storage every N ms using throttle with 'debounceOnLastCall' options.
    * Reasoning: this method allows the app to change many properties in memory without using the drive and
    * then write only specific data properties to storage every N ms. Using throttle method instead of
    * debounce method because it waits for the last change before running which can potentially
    * delay writing to storage for a long time (when many consecutive changes occur).
    * @param {object} params
    * @param {string} params.prop1
    */
    async UPDATE_STORAGE_FILE ({ commit, dispatch, getters }, payload) {
      dispatch('ADD_ACTION_TO_HISTORY', { action: 'store.js::UPDATE_STORAGE_FILE()' })
      try {
        payload = utils.ensureArray(payload)
        let fileGroups = groupPropertiesByFile(payload, 'fileName')

        for (const [key, value] of Object.entries(fileGroups)) {
          const properties = value
          const fileName = key
          let fileData = await dispatch('READ_STORAGE_FILE', fileName)
          fileData = await dispatch('WRITE_STORAGE_FILE', {
            fileName,
            properties,
            data: fileData
          })
        }
      }
      catch (error) {
        throw Error(error)
      }

      function groupPropertiesByFile (payload, property) {
        let groups = {}
        for (let i = 0, max = payload.length; i < max ; i++ ){
        if (groups[payload[i][property]] == undefined) {
          groups[payload[i][property]] = []
        }
          groups[payload[i][property]].push(payload[i])
        }
        return groups
      }
    },
    /** Reads specified JSON file and returns its contents as an objects
    * @param {object} params
    * @param {string} params.fileName
    */
    READ_STORAGE_FILE ({ state, commit, dispatch, getters }, fileName) {
      return new Promise((resolve, reject) => {
        const filePath = `${state.appPaths.storageDirectories.appStorage}/${fileName}`
        fs.promises.readFile(filePath, {encoding: 'utf-8'})
          .then((data) => {
            data = JSON.parse(data)
            resolve(data)
          })
          .catch((error) => {
            reject(error)
          })
      })
    },
    // TESTS:
    // - Write different data frequently in short period of time:
    //   - ✅ No errors;
    //   - ✅ File is not corrupted (can happen when multiple processes are writing at the same time);
    async WRITE_STORAGE_FILE ({ state, commit, dispatch, getters }, payload) {
      let { fileName, properties, data } = payload
      const filePath = `${state.appPaths.storageDirectories.appStorage}/${fileName}`
      // Update storage data in memory.
      // If key is provided, update its value,
      // otherwise set the value as file's root property
      properties.forEach(property => {
        if (property.key && property.key !== '') { data[property.key] = property.value }
        else { data = property.value }
      })
      // Write update data to storage
      try {
        const formattedData = JSON.stringify(data, null, 2)
        await writeFile(filePath, formattedData, { fsyncWait: false, encoding: 'utf8' })
      }
      catch (error) {
        throw Error(error)
      }
    },
    async WRITE_DEFAULT_STORAGE_FILE ({ state, commit,dispatch, getters }, payload) {
      const filePath = `${state.appPaths.storageDirectories.appStorage}/${payload.fileName}`
      const defaultData = {}
      try {
        const formattedData = JSON.stringify(defaultData, null, 2)
        await writeFile(filePath, formattedData, { fsyncWait: false, encoding: 'utf8' })
      }
      catch (error) {
        throw Error(error)
      }
    },
    SYNC_SETTINGS ({ state, commit, dispatch, getters }, payload) {
      if (payload.key === 'storageData.settings.navigatorLayout') {
        if (payload.value === 'list') {
          dispatch('SET', {
            key: 'storageData.settings.navigatorLayoutItemHeight',
            value: {
              directory: 48,
              file: 48
            }
          })
        }
        else if (payload.value === 'grid') {
          dispatch('SET', {
            key: 'storageData.settings.navigatorLayoutItemHeight',
            value: {
              directory: 64,
              file: 158
            }
          })
        }
      }
    },
    async RESET_APP_SETTINGS (store) {
      try {
        await store.dispatch('DELETE_APP_FILE', {
          fileName: 'settings.json'
        })
        utils.reloadMainWindow()
      }
      catch (error) {
        throw Error(error)
      }
    },
    async DELETE_APP_FILE (store, payload) {
      try {
        const appStorageDir = store.state.appPaths.storageDirectories.appStorage
        const appStorageFileName = payload.fileName
        const normalizedPath = PATH.normalize(`${appStorageDir}/${appStorageFileName}`)
        await fs.promises.access(normalizedPath, fs.constants.F_OK)
        let item = await store.dispatch('FETCH_DIR_ITEM_INFO', normalizedPath)
        await store.dispatch('DELETE_DIR_ITEMS', {
          items: [item],
          options: { skipSafeCheck: true }
        })
      }
      catch (error) {
        throw Error(error)
      }
    },
    CLONE_STATE  (store) {
       store.state.defaultData = utils.cloneDeep(store.state)
    },
    /**
    * @param {object} task
    * @param {string} task.name
    * @param {string} task.hashID
    * @param {number} task.timeCreated
    */
    ADD_TASK (store, task) {
      if (task.name === undefined) {
        return new Error('ADD_TASK: property task.name is required')
      }
      store.state.tasks.push(task)
      return task
    },
    UPDATE_TASK (store, props) {
      if (props.getBy === 'hashID') {
        let task = store.state.tasks.find(task => task.hashID === props.hashID)
        task = props.task
      }
      else if (props.getBy === 'name') {
        let task = store.state.tasks.find(task => task.name === props.name)
        task = props.task
      }
    },
    REMOVE_TASK (store, task) {
      store.state.tasks = store.state.tasks
        .filter(activeTask => activeTask.hashID !== task.hashID)
    },
    REMOVE_TASKS_BY_NAME (store, taskName) {
      store.state.tasks = store.state.tasks
        .filter(activeTask => activeTask.name !== taskName)
    },
    ADD_ACTION_TO_HISTORY  ({ state, commit, dispatch, getters }, action) {
      const time = new Date().getTime()
      let defaultAction = {
        hashID: utils.getHash(),
        time,
        readableTime: utils.getDateTime('HH:mm:ss:SSS'),
        action: 'action'
      }
      action = {...defaultAction, ...action}
      if (state.appActionHistory.length >= 50) {
        state.appActionHistory.splice(0, 1)
      }
      state.appActionHistory.push(action)
    },
    /**
    * @param {object} payload
    * @param {array<object>} payload.items
    */
    async CONVERT_DATA_OBJECTS_TO_PATHS ({ state, commit, dispatch, getters }, payload) {
      return payload.items.map(item => item?.path)
    },
    /**
    * @param {object} payload
    * @param {array<string>} payload.items
    */
    async CONVERT_PATHS_TO_DATA_OBJECTS ({ state, commit, dispatch, getters }, payload) {
      let newItems = []
      if (payload.items !== undefined) {
        for (let index = 0; index < payload.items.length; index++) {
          const path = payload.items[index]
          let item = await dispatch('FETCH_DIR_ITEM_INFO', path)
          newItems.push(item)
        }
      }
      return newItems
    },
    /**
    * @param {object} payload
    * @param {array<object>} payload.items
    */
    async CONVERT_OBJECTS_TO_DATA_OBJECTS ({ state, commit, dispatch, getters }, payload) {
      let newItems = []
      if (payload.items !== undefined) {
        for (let index = 0; index < payload.items.length; index++) {
          const item = payload.items[index]
          let itemObjectData = await dispatch('FETCH_DIR_ITEM_INFO', item.path)
          newItems.push({...item, ...itemObjectData})
        }
      }
      return newItems
    },
    ADD_TO_DIR_ITEMS_TIMELINE (store, path) {
      if (!store.state.storageData.settings.stats.storeDirItemOpenEvent) {return false}

      const dirItemsTimeline = store.state.storageData.stats.dirItemsTimeline
      const specifiedItemIndex = dirItemsTimeline.findIndex(listItem => listItem.path === path)
      const date = new Date().getTime()

      let itemToAdd = updateItem(path)
      handleAddItem(itemToAdd)

      function updateItem (path) {
        let itemToAdd = {}
        itemToAdd.path = path
        if (store.state.storageData.settings.stats.storeDirItemOpenCount) {
          if (specifiedItemIndex !== -1) {
            itemToAdd.openCount = dirItemsTimeline[specifiedItemIndex].openCount + 1
          }
          else {
            itemToAdd.openCount = 1
          }
        }
        if (store.state.storageData.settings.stats.storeDirItemOpenDate) {
          itemToAdd.openDate = date
        }
        return itemToAdd
      }

      function handleAddItem (itemToAdd) {
        if (fs.statSync(path).isDirectory()) {
          // Add directory to the timeline even if another file has been
          // opened before the timeout for the directory ran out.
          clearTimeout(store.state.timeouts.tempRecentlyOpenedTimeout)
          store.state.timeouts.tempRecentlyOpenedTimeout = setTimeout(() => {
            addItem(itemToAdd)
          }, store.state.timeouts.tempRecentlyOpenedTimeoutTime)
        }
        else {
          addItem(itemToAdd)
        }
      }

      function addItem (itemToAdd) {
        if (specifiedItemIndex !== -1) {
          dirItemsTimeline.splice(specifiedItemIndex, 1)
        }
        if (dirItemsTimeline.length >= 100) {
          dirItemsTimeline.splice(dirItemsTimeline.length - 1, 1)
        }
        dirItemsTimeline.unshift(itemToAdd)
        store.dispatch('SET', {
          key: 'storageData.stats.dirItemsTimeline',
          value: dirItemsTimeline
        })
      }
    },
    TERMINATE_PROCESS ({ state, commit,dispatch, getters }, execProcess) {
      // Kill the process if it's safe to kill (pid !== -1)
      if (execProcess.pid === -1) {
        throw Error('ERROR: TERMINATE_PROCESS: pid === -1')
      }
      if (process.platform === 'win32') {
        childProcess.exec(`taskkill /pid ${execProcess.pid} /T /F`)
      }
      else if (process.platform === 'linux') {
        buildProcessTree(pid, tree, pidsToProcess, (parentPid) => {
          // Kill the process if it's safe to kill (pid !== -1)
          if (execProcess.pid === -1 || parentPid === -1) {
            throw Error('ERROR: TERMINATE_PROCESS: execProcess.pid === -1 || parentPid === -1')
          }
          return childProcess.spawn('ps', ['-o', 'pid', '--no-headers', '--ppid', parentPid])
        },
          () => killAllProcesses(tree)
        )
      }
      else if (process.platform === 'darwin') {
        buildProcessTree(pid, tree, pidsToProcess, (parentPid) => {
          // Kill the process if it's safe to kill (pid !== -1)
          if (execProcess.pid === -1 || parentPid === -1) {
            throw Error('ERROR: TERMINATE_PROCESS: execProcess.pid === -1 || parentPid === -1')
          }
          return childProcess.spawn('pgrep', ['-P', parentPid])
        },
          () => killAllProcesses(tree)
        )
      }

      function killAllProcesses(tree) {
        try {
          Object.keys(tree).forEach((pid) => {
            tree[pid].forEach((pidpid) => {
              execProcess.kill(pidpid)
            })
            execProcess.kill(pidpid)
          })
        }
        catch (error) {
          console.log(error)
        }
      }

      function buildProcessTree (parentPid, tree, pidsToProcess, spawnChildProcessesList) {
        const processesList = spawnChildProcessesList(parentPid)
        let allData = ''
        processesList.stdout.on('data', (data) => {
          allData += data.toString('ascii')
        })
        allData.match(/\d+/g).forEach((pid) => {
          pid = parseInt(pid, 10)
          tree[parentPid].push(pid)
          tree[pid] = []
          pidsToProcess[pid] = 1
          buildProcessTree(pid, tree, pidsToProcess, spawnChildProcessesList)
        })
      }
    },
    CHILD_PROCESS_EXEC ({ state, commit, dispatch, getters }, payload) {
    },
    // actions::download
    // actions::transfer
    /** Universal transfer initiator for local and external items
    * @param {string} payload
    * @returns {string}
    */
    INIT_ITEM_TRANSFER ({ state, commit, dispatch, getters }, payload) {
    },
    async HANDLE_HOME_PAGE_BACKGROUND_ITEM_DROP ({ state, commit, dispatch, getters }, event) {
      // TODO: use universal downloaing / copy method instead
      await processItems()

      async function copyFileToAppStorage (file) {
        const destination = PATH.join(state.appPaths.storageDirectories.appStorageHomeBannerMedia, file.name)
        await fs.promises.copyFile(file.path, destination)
        return {file, destination}
      }

      async function addHomeBackground (params) {
        let template = utils.cloneDeep(state.storageData.settings.homeBanner.itemTemplate)
        template.isCustom = true
        template.type = params.file.type.startsWith('image/') ? 'image' : 'video'
        template.path = params.destination
        template.fileNameBase = params.file.name
        dispatch('ADD_HOME_BANNER_BACKGROUND', template)
      }

      async function processItems () {
        // Handle local file transfer
        if (event.dataTransfer.items) {
          if (event.dataTransfer.items[0].kind === 'file') {
            for (const file of event.dataTransfer.files) {
              let params = await copyFileToAppStorage(file)
              await addHomeBackground(params)
            }
          }
        }
      }
    },
    EXEC_DOWNLOAD_VIDEO ({ state, commit, dispatch, getters }, payload) {
      console.log(payload)
      let status = { isCanceled: false }

      // Add notification
      const progress = {
        started: false,
        filename: null,
        speedIsCalculated: true,
        isDone: false,
        percentDone: 0,
        receivedBytes: 0,
        totalBytes: null,
        speed: 0,
        eta: 0
      }
      const notificationData = {
        action: 'update-by-hash',
        type: 'progress:download-file',
        actionButtons: [],
        closeButton: true,
        timeout: 0,
        title: 'Downloading file',
        message: 'Getting info...',
        progress: progress,
        hashID: payload.hashID
      }
      eventHub.$emit('notification', notificationData)

      // Exec processes
      if (payload.source === 'm3u8') { handleProcessM3U8() }
      else if (payload.source === 'youtube') { handleProcessYouTube() }

      function handleProcessM3U8 () {
        // Method 1: using .spawn() | Problem: doesn't download videos till the end
        // let process = childProcess.spawn('ffmpeg', payload.command, {
        //   cwd: state.appPaths.binFFMPEG,
        //   shell: true
        // })
        // Method 2: using .exec()
        let mainExecProcess = childProcess.exec(
          payload.command.join(' ').replace(/\n/g, ' '),
          (error, stdout, stderr) => {
            if (error) {
              progress.eta = 0
              notificationData.timeout = 5000
              notificationData.title = status.isCanceled ? 'Download canceled' : 'Download failed'
              notificationData.actionButtons = []
              eventHub.$emit('notification', notificationData)
              return
            }
          }
        )

        let fileSizeCheckInterval = startFilSizeWatcher()

        progress.started = true
        progress.filename = payload.fileName

        // Update notification
        const actionButtons = [
          {
            title: 'cancel',
            action: '',
            closesNotification: true,
            onClick: () => {
              status.isCanceled = true
              clearInterval(fileSizeCheckInterval)
              dispatch('TERMINATE_PROCESS', mainExecProcess)
            }
          }
        ]
        notificationData.message = ''
        notificationData.actionButtons = actionButtons
        eventHub.$emit('notification', notificationData)

        // Create listener
        // process.stdout.on('close', (data) => {
        //   if (!status.isCanceled) {
        //     // Update notification
        //     const actionButtons = [
        //       {
        //         title: 'open file',
        //         action: 'openDownloadedFile',
        //         closesNotification: true,
        //         onClick: () => {
        //           electron.shell.openPath(payload.path)
        //         }
        //       },
        //       {
        //         title: 'show in directory',
        //         action: 'showDownloadedFile',
        //         closesNotification: true,
        //         onClick: () => {
        //           dispatch('LOAD_DIR', { path: payload.directory })
        //         }
        //       }
        //     ]
        //     progress.isDone = true
        //     progress.eta = 0
        //     notificationData.timeout = 5000
        //     notificationData.title = 'File was downloaded'
        //     notificationData.message = ''
        //     notificationData.actionButtons = actionButtons
        //     eventHub.$emit('notification', notificationData)
        //   }
        // })
      }

      function startFilSizeWatcher () {
        const fileSizeCheckInterval = setInterval(() => {
          fs.promises.stat(payload.path)
            .then((stats) => {
              progress.receivedBytes = stats.size
              progress.totalBytes = 'unknown'
            })
            .catch((error) => {
              progress.receivedBytes = 'unknown'
              progress.totalBytes = 'unknown'
            })
        }, 500)
        return fileSizeCheckInterval
      }

      function handleProcessYouTube () {
        let fileNameProcess = childProcess.exec(payload.commandForFileName)
        let mainExecProcess = childProcess.exec(
          payload.command,
          (error, stdout, stderr) => {
            if (error) {
              progress.eta = 0
              notificationData.timeout = 5000
              notificationData.title = status.isCanceled ? 'Download canceled' : 'Download failed'
              notificationData.message = error
              notificationData.actionButtons = []
              eventHub.$emit('notification', notificationData)
              return
            }
          }
        )

        fileNameProcess?.stdout.on('data', (data) => {
          // Get file name from the process and update the data
          progress.message = ''
          const filename = data.replace(/\n/g, '')
          payload.filename = filename
          progress.filename = filename
        })

        mainExecProcess.stdout.on('data', (data) => {
          console.log(data)
          const dataArray = data.split(' ')
            .filter(item => item !== '')
          // Get info from 'download' phase
          if (dataArray[1].endsWith('%') && dataArray[5] !== 'unknown') {
            // Update progess data
            progress.started = true
            progress.percentDone = dataArray[1]?.replace(/\%/, '')
            progress.speed = dataArray[5]
            progress.eta = dataArray[7]?.replace(/\[download\]/, '')
            if (!status.isCanceled) {
              // Update notification
              const actionButtons = [
                {
                  title: 'cancel',
                  action: '',
                  closesNotification: true,
                  onClick: () => {
                    status.isCanceled = true
                    dispatch('TERMINATE_PROCESS', mainExecProcess)
                  }
                }
              ]
              notificationData.message = ''
              notificationData.actionButtons = actionButtons
              eventHub.$emit('notification', notificationData)
            }
          }
        })

        mainExecProcess.stdout.on('close', (data) => {
          if (!payload.filename) {
            progress.isDone = true
            progress.eta = 0
            notificationData.timeout = 3000
            notificationData.title = 'File download failed'
            notificationData.message = ''
            eventHub.$emit('notification', notificationData)
          }
          else if (!status.isCanceled) {
            // Update notification
            const actionButtons = [
              {
                title: 'open file',
                action: 'openDownloadedFile',
                closesNotification: true,
                onClick: () => {
                  electron.shell.openPath(payload.filename)
                }
              },
              {
                title: 'show in directory',
                action: 'showDownloadedFile',
                closesNotification: true,
                onClick: () => {
                  const dir = PATH.parse(payload.filename).dir
                  dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', { dir: payload.directory, itemPath: payload.filename })
                }
              }
            ]
            progress.isDone = true
            progress.eta = 0
            notificationData.timeout = 3000
            notificationData.title = 'File was downloaded'
            notificationData.message = ''
            notificationData.actionButtons = actionButtons
            eventHub.$emit('notification', notificationData)
          }
        })
      }
    },
    ROUTE_MOUNTED_HOOK_CALLBACK ({ state, commit,dispatch, getters }, payload) {
      // Restore route scroll position
      eventHub.$emit('app:method', {
        method: 'restoreRouteScrollPosition',
        params: {
          toRoute: {
            name: payload.route
          }
        }
      })
    },
    CHECK_CONDITIONS ({ commit,dispatch, getters }, payload) {
      const defaultOptions = {
        conditions: {}
      }
      payload = {...defaultOptions, ...payload}
      const alertOnConditionUnfullfilled = payload.alertOnConditionUnfullfilled
      const someDirItemIsSelected = getters.selectedDirItems.length > 0
      // Condition: inputFieldIsActive
      const condition1Fullfilled = payload.conditions.inputFieldIsActive === undefined ||
        (payload.conditions.inputFieldIsActive === utils.isCursorInsideATextField())
      // Condition: someDialogIsOpened
      const condition2Fullfilled = payload.conditions.dialogIsOpened === undefined ||
        (payload.conditions.dialogIsOpened === getters.someDialogIsOpened)
      // Condition: dirItemIsSelected
      const condition3Fullfilled = payload.conditions.dirItemIsSelected === undefined ||
        (payload.conditions.dirItemIsSelected === someDirItemIsSelected)
      // Condition: route is allowed
      const condition4Fullfilled = payload.routes[0] === 'all' ||
        payload.routes.includes(router.currentRoute.name)
      if (alertOnConditionUnfullfilled && !condition1Fullfilled) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'action-failed',
          timeout: 3000,
          closeButton: true,
          title: 'Action failed',
          message: 'Action is not allowed when input field is active'
        })
      }
      else if (alertOnConditionUnfullfilled && !condition2Fullfilled) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'action-failed',
          timeout: 3000,
          closeButton: true,
          title: 'Action failed',
          message: 'Action is not allowed when a dialog is opened'
        })
      }
      else if (alertOnConditionUnfullfilled && !condition3Fullfilled) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'action-failed',
          timeout: 3000,
          closeButton: true,
          title: 'Action failed',
          message: 'No directory items are selected'
        })
      }
      else if (alertOnConditionUnfullfilled && !condition4Fullfilled) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'action-failed',
          timeout: 3000,
          closeButton: true,
          title: 'Action failed',
          message: 'Action is not allowed on this page'
        })
      }
      return condition1Fullfilled &&
        condition2Fullfilled &&
        condition3Fullfilled &&
        condition4Fullfilled
    },
    async SHORTCUT_ACTION ({ commit,dispatch, getters }, payload) {
      const { event, value } = payload
      const allConditionsAreFulfilled = await dispatch('CHECK_CONDITIONS', value)
      // Handle preventDefault
      if (value.preventDefaultType === 'always') {
        event.preventDefault()
      }
      else if (value.preventDefaultType === '!inputFieldIsActive' && !utils.isCursorInsideATextField()) {
        event.preventDefault()
      }
      // Handle action if all conditions are fulfilled
      if (allConditionsAreFulfilled) {
        dispatch(value.action.name, value.action.options)
      }
    },
    TOGGLE_DIALOG ({ state, commit, dispatch, getters }, payload) {
      if (payload.dialogData) {
        dispatch('SET', {
          key: payload.dialogData.key,
          value: payload.dialogData.value
        })
      }
      commit('TOGGLE', `dialogs.${payload.dialogName}.value`)
    },
    OPEN_DIALOG ({ state, commit, dispatch, getters }, payload) {
      const specifiedDialog = state.dialogs[payload.dialogName]
      if (!specifiedDialog.value) {
        specifiedDialog.value = true
      }
    },
    TOGGLE_ADDRESS_BAR ({ state, commit, dispatch }) {
      // If previous page was not 'navigator', set 'addressBarEditor' to 'true'
      // instead of toggling it to avoid the case:
      // - address bar is opened
      // - change page
      // - toggle address bar with the shortcut again
      // - address bar will be closed because it was already opened before
      if (router.currentRoute.name !== 'navigator') {
        dispatch('SWITCH_ROUTE', { to: '/navigator' })
        dispatch('SET', { key: 'addressBarEditor', value: true })
      }
      else {
        dispatch('TOGGLE', 'addressBarEditor')
      }
    },
    SWITCH_ROUTE ({ state, commit, dispatch }, item) {
      if (item.to === '/navigator') {
        const someDirLoaded = Object.keys(state.navigatorView.currentDir).length !== 0
        if (!someDirLoaded) {
          dispatch('LOAD_DIR', { path: '' })
        }
      }
      router.push(item.to).catch((error) => {})
    },
    NAVIGATE_DIR_UP (store) {
      // Layout: grid
      if (store.state.storageData.settings.navigatorLayout === 'grid') {
        if (store.getters.isOnlyCurrentDirItemSelected) {
          store.dispatch('SELECT_DIR_ITEM', {index: store.getters.firstDirItemIndex})
        }
        else if (store.state.navigatorView.selectedDirItems.length > 1) {
          store.dispatch('SELECT_DIR_ITEM', {
            index: store.state.navigatorView.selectedDirItems[0].dirItemPositionIndex
          })
        }
        else if (store.state.navigatorView.selectedDirItems.length === 1) {
          let navigatorGridData = store.getters.navigatorGridData
          if (!navigatorGridData.inFirstRow) {
            store.dispatch('SELECT_DIR_ITEM', {
              index: navigatorGridData.gridUpIndex
            })
          }
        }
      }
      // Layout: list
      else {
        if (store.getters.isOnlyCurrentDirItemSelected) {
          store.dispatch('SELECT_DIR_ITEM', {index: store.getters.firstDirItemIndex})
        }
        else {
          if (!store.getters.isFirstDirItemSelected) {
            store.dispatch('SELECT_DIR_ITEM', {
              index: store.getters.lastSelectedDirItem.dirItemPositionIndex - 1
            })
          }
        }
      }
      store.dispatch('HANDLE_NAVIGATOR_ITEM_MOVE_SCROLL', {direction: 'up'})
    },
    NAVIGATE_DIR_DOWN (store) {
      // Layout: grid
      if (store.state.storageData.settings.navigatorLayout === 'grid') {
        if (store.getters.isOnlyCurrentDirItemSelected) {
          store.dispatch('SELECT_DIR_ITEM', {index: store.getters.firstDirItemIndex})
        }
        else if (store.state.navigatorView.selectedDirItems.length > 1) {
          store.dispatch('SELECT_DIR_ITEM', {
            index: store.state.navigatorView.selectedDirItems.getLast().dirItemPositionIndex
          })
        }
        else if (store.state.navigatorView.selectedDirItems.length === 1) {
          let navigatorGridData = store.getters.navigatorGridData
          if (!navigatorGridData.inLastRow) {
            store.dispatch('SELECT_DIR_ITEM', {
              index: navigatorGridData.gridDownIndex
            })
          }
        }
      }
      // Layout: list
      else {
        if (store.getters.isOnlyCurrentDirItemSelected) {
          store.dispatch('SELECT_DIR_ITEM', {index: store.getters.firstDirItemIndex})
        }
        else {
          if (!store.getters.isLastDirItemSelected) {
            store.dispatch('SELECT_DIR_ITEM', {
              index: store.getters.lastSelectedDirItem.dirItemPositionIndex + 1
            })
          }
        }
      }
      store.dispatch('HANDLE_NAVIGATOR_ITEM_MOVE_SCROLL', {direction: 'down'})
    },
    NAVIGATE_DIR_LEFT (store) {
      if (store.getters.isOnlyCurrentDirItemSelected) {
        store.dispatch('SELECT_DIR_ITEM', {index: store.getters.firstDirItemIndex})
      }
      else {
        if (!store.getters.isFirstDirItemSelected) {
          store.dispatch('SELECT_DIR_ITEM', {
            index: store.getters.lastSelectedDirItem.dirItemPositionIndex - 1
          })
        }
      }
    },
    NAVIGATE_DIR_RIGHT (store) {
      if (store.getters.isOnlyCurrentDirItemSelected) {
        store.dispatch('SELECT_DIR_ITEM', {index: store.getters.firstDirItemIndex})
      }
      else {
        if (!store.getters.isLastDirItemSelected) {
          store.dispatch('SELECT_DIR_ITEM', {
            index: store.getters.lastSelectedDirItem.dirItemPositionIndex + 1
          })
        }
      }
    },
    HANDLE_NAVIGATOR_ITEM_MOVE_SCROLL (store, params) {
      // Layout: grid
      if (store.state.storageData.settings.navigatorLayout === 'grid') {
        // TODO: finish
        // updatedNavigatorGridData.selectedDirItemNode is undefined when scrolling up
        // Is the virtual container causing the problem?
        let updatedNavigatorGridData = store.getters.navigatorGridData
        if (!updatedNavigatorGridData.isDirItemNodeInViewport && updatedNavigatorGridData.selectedDirItemNode) {
          let scrollContentNode = utils.getContentAreaNode(router.currentRoute.name)
          // scrollContentNode.scroll({
          //   top: params.direction === 'up'
          //     ? scrollContentNode.scrollTop - updatedNavigatorGridData.row.height
          //     : scrollContentNode.scrollTop + updatedNavigatorGridData.row.height,
          //   left: 0,
          //   behavior: 'smooth'
          // })
          updatedNavigatorGridData.selectedDirItemNode.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
          })
        }
      }
    },
    OPEN_LAST_SELECTED_DIRITEM (store) {
      let item = store.state.navigatorView.selectedDirItems.getLast()
      store.dispatch('OPEN_DIR_ITEM', item)
    },
    TOGGLE_FULLSCREEN () {
      utils.toggleFullscreen()
    },
    INCREASE_UI_ZOOM (store) {
      const currentZoomFactor = electron.webFrame.getZoomFactor()
      if (currentZoomFactor < 1.5) {
        const newZoomFactor = Number(parseFloat(currentZoomFactor + 0.1).toFixed(1))
        electron.webFrame.setZoomFactor(newZoomFactor)
        store.dispatch('SET', {
          key: 'storageData.settings.UIZoomLevel',
          value: newZoomFactor
        })
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'ui-zoom:change',
          timeout: 2000,
          title: `UI scale changed: ${(newZoomFactor * 100).toFixed(0)}%`
        })
      }
    },
    DECREASE_UI_ZOOM (store) {
      const currentZoomFactor = electron.webFrame.getZoomFactor()
      if (currentZoomFactor > 0.6) {
        const newZoomFactor = Number(parseFloat(currentZoomFactor - 0.1).toFixed(1))
        electron.webFrame.setZoomFactor(newZoomFactor)
        store.dispatch('SET', {
          key: 'storageData.settings.UIZoomLevel',
          value: newZoomFactor
        })
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'ui-zoom:change',
          timeout: 2000,
          title: `UI scale changed: ${(newZoomFactor * 100).toFixed(0)}%`
        })
      }
    },
    RESET_UI_ZOOM (store) {
      electron.webFrame.setZoomFactor(1)
      store.dispatch('SET', {
        key: 'storageData.settings.UIZoomLevel',
        value: 1.0
      })
      eventHub.$emit('notification', {
        action: 'update-by-type',
        type: 'ui-zoom:change',
        timeout: 2000,
        title: `UI scale changed: 100%`
      })
    },
    TOGGLE ({ commit }, key) {
      commit('TOGGLE', key)
    },
    TOGGLE_FILTER_FOCUS ({ commit }, key) {
      eventHub.$emit('focusFilter')
    },
    ESCAPE_BUTTON_HANDLER ({ state, commit, dispatch, getters }) {
      // CLose elements in specified order top to bottom
      // Hide inboundDrag overlay
      if (state.overlays.inboundDrag) {
        dispatch('SET', {
          key: 'drag.dirItemInbound.value',
          value: false
        })
      }
      // Hide drag overlay
      else if (state.overlays.dirItemDrag) {
        eventHub.$emit('cancel:drag')
      }
      // Close address bar
      else if (state.addressBarEditor) {
        dispatch('SET', {
          key: 'addressBarEditor',
          value: false
        })
      }
      // Close dir item context menu
      else if (state.contextMenus.dirItem.value) {
        state.contextMenus.dirItem.value = false
      }
      // Hide fs clipboard toolbar
      else if (state.navigatorView.clipboard.fs.items.length > 0) {
        dispatch('CLEAR_FS_CLIPBOARD')
      }
      // Deselect items. Will also clear filter field
      else if (getters.selectedDirItems.length > 0) {
        dispatch('DESELECT_ALL_DIR_ITEMS')
      }
    },
    CLOSE_ALL_TABS_IN_CURRENT_WORKSPACE ({ commit, dispatch, getters }) {
      let tabs = [...getters.selectedWorkspace.tabs]
      tabs = []
      dispatch('SET_TABS', tabs)
    },
    CLOSE_TAB ({ state, commit, dispatch, getters }, tab) {
      let tabs = [...getters.selectedWorkspace.tabs]
      const tabIndex = tabs.findIndex(item => item.path === tab.path)
      const tabExists = tabIndex !== -1
      // Remove tab
      if (tabExists) {
        tabs.splice(tabIndex, 1)
      }
      dispatch('SET_TABS', tabs)
    },
    ADD_TAB ({ state, commit, dispatch, getters }) {
      let item = state.navigatorView.selectedDirItems.getLast()
      let tabs = [...getters.selectedWorkspace.tabs]
      let newTab = {
        name: item.name,
        path: item.path
      }
      const tabIndex = getters.selectedWorkspace.tabs.findIndex(tab => tab.path === newTab.path)
      if (tabIndex === -1) {
        tabs.push(newTab)
        dispatch('SET_TABS', tabs)
        eventHub.$emit('notification', {
          action: 'add',
          timeout: 3000,
          type: '',
          closeButton: true,
          title: 'Tab added to current workspace',
          message: `
            Shortcut to open:
            ${state.storageData.settings.shortcuts.switchTab.shortcut.replace('[1 - 9]', tabs.length)}
          `
        })
      }
      else {
        eventHub.$emit('notification', {
          action: 'add',
          timeout: 5000,
          type: '',
          closeButton: true,
          title: 'Tab for this directory is already opened',
          message: `Position: ${tabIndex + 1}`
        })
        setTimeout(() => {
          state.menus.tabs = true
        }, 1000)
      }
    },
    SET_TABS (store, tabs) {
      store.getters.selectedWorkspace.tabs = tabs
      store.dispatch('SYNC_WORKSPACE_STORAGE_DATA')
    },
    SET_WORKSPACES ({ state, commit, dispatch, getters }, workspaces) {
      commit('SET_WORKSPACES', workspaces)
      dispatch('SYNC_WORKSPACE_STORAGE_DATA')
    },
    ADD_WORKSPACE_TO_STORAGE ({ state, commit, dispatch, getters }, workspace) {
      // Add workspace to the list of existing workspaces
      const items = [...state.storageData.workspaces.items, ...[workspace]]
      // Update store
      dispatch('SET', {
        key: 'storageData.workspaces.items',
        value: items
      })
    },
    SYNC_WORKSPACE_STORAGE_DATA ({ state, commit, dispatch, getters }) {
      dispatch('SET', {
        key: 'storageData.workspaces.items',
        value: state.storageData.workspaces.items
      })
    },
    CLEAR_FILTER_FIELD ({ state, commit, dispatch, getters }) {
      dispatch('SET', {
        key: `filterField.view.${router.history.current.name}.query`,
        value: ''
      })
    },
    SET_STATS (store) {
      store.state.navigatorView.timeSinceLoadDirItems = Date.now()
    },
    LOAD_ROUTE (store, routeName) {
      router.push(routeName).catch((error) => {})
    },
    // TODO:
    // performance: instead of fetching all dir items,
    // fetch info for single item when it becomes visible (intersectionObserver)
    async LOAD_DIR (store, options) {
      store.dispatch('ADD_ACTION_TO_HISTORY', { action: 'store.js::LOAD_DIR()' })
      options = {
        ...{
          path: '/',
          skipHistory: false,
          scrollTop: true,
          selectCurrentDir: true
        },
        ...options
      }
      options.path = sharedUtils.normalizePath(options.path)

      store.dispatch('SET_NAVIGATOR_STATE')
      store.dispatch('LOAD_ROUTE', 'navigator')
      let {dirInfo} = await store.dispatch('LOAD_DIR_ITEMS', options.path)
      eventHub.$emit('app:method', {
        method: 'startWatchingCurrentDir',
        params: options.path
      })
      store.commit('ADD_TO_HISTORY', options)
      store.dispatch('ADD_TO_DIR_ITEMS_TIMELINE', dirInfo.path)
      store.dispatch('SORT_DIR_ITEMS')
      store.dispatch('CLEAR_FILTER_FIELD')
      store.dispatch('SET_STATS')
      await store.dispatch('RESTORE_NAVIGATOR_STATE')
      store.dispatch('AUTO_FOCUS_FILTER')
      if (options.scrollTop) {
        store.dispatch('SCROLL_TOP_CONTENT_AREA', {behavior: 'auto'})
      }
      if (options.selectCurrentDir) {
        store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [dirInfo])
      }
    },
    RELOAD_DIR (store, params) {
      params = {
        ...{
          scrollTop: true,
          selectCurrentDir: true,
          emitNotification: false
        }, 
        ...params 
      }
      if (router.history.current.name === 'navigator') {
        store.dispatch('LOAD_DIR', {
          path: store.state.navigatorView.currentDir.path,
          ...params
        })
        if (params.emitNotification) {
          eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'navigator:reload',
            timeout: 2000,
            title: 'Directory reloaded',
            message: `<b>Directory:</b> ${store.state.navigatorView.currentDir.path}`
          })
        }
      }
    },
    async LOAD_DIR_ITEMS ({ state, commit, dispatch, getters }, path) {
      if (path === '') {
        path = state.appPaths.home
      }
      dispatch('SET', {
        key: 'navigatorView.dirItemsInfoIsFetched',
        value: false
      })
      try {
        const dirInfo = await dispatch('FETCH_DIR_ITEM_INFO', path)
        dispatch('SET', {
          key: 'navigatorView.currentDir',
          value: dirInfo
        })
        const dirItems = await dispatch('FETCH_DIR_ITEMS', path)
        dispatch('SET', {
          key: 'navigatorView.dirItems',
          value: dirItems
        })
        dispatch('SET', {
          key: 'navigatorView.dirItemsInfoIsFetched',
          value: true
        })
        return { dirInfo, dirItems }
      }
      catch (error) {
        throw Error(error)
      }
    },
    OPEN_FILE ({ state, commit, dispatch, getters }, path) {
      // Open in the default external program
      electron.shell.openPath(PATH.normalize(path))
      dispatch('ADD_TO_DIR_ITEMS_TIMELINE', path)
    },
    AUTO_FOCUS_FILTER (store) {
      // TODO:
      // - Needs an option to ignore dir updates triggered by Chokidar
      // - Manual refresh would not focus the field.

      // Focus filter on directory change
      if (store.state.storageData.settings.focusFilterOnDirectoryChange) {
        setTimeout(() => {
          if (!store.state.addressBarEditor) {
            eventHub.$emit('focusFilter')
          }
        }, 100)
      }
    },
    /**
    * @param {string} params.dest
    * @param {string[]} params.source
    */
    ADD_TO_ARCHIVE (store, params) {
      if (params.source === 'target-items') {
        params.source = store.state.contextMenus.dirItem.targetItemsStats.dirItemsPaths
      }
      if (params.dest) {
        params.dest = utils.getUniquePath(params.dest)
      }
      else if (!params.dest) {
        const parsed = PATH.parse(params.source[0])
        const uniqueDestPath = utils.getUniquePath(PATH.join(parsed.dir, 'Archive.zip'))
        params.dest = uniqueDestPath
      }
      console.log(params.dest, params.source, store.state.appPaths.bin7Zip)
      const appBinExtractStream = node7z.add(
        params.dest,
        params.source,
        {
          $bin: store.state.appPaths.bin7Zip,
          $progress: true
        }
      )
      appBinExtractStream.on('error', (error) => {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'archiver:add',
          timeout: 5000,
          title: 'Error: cannot add data to the archive',
          message: error
        })
      })
      appBinExtractStream.on('end', () => {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'archiver:add',
          timeout: 5000,
          title: 'Archive was created',
          message: params.dest
        })
      })
    },
    /**
    * @param {string} params.dest
    * @param {string} params.source
    */
    EXTRACT_ARCHIVE (store, params) {
      if (params.source === 'target-items') {
        params.source = store.state.contextMenus.dirItem.targetItemsStats.dirItemsPaths[0]
      }

      if (!params.dest) {
        const parsed = PATH.parse(params.source)
        const dest = utils.getUniquePath(PATH.join(parsed.dir, parsed.name))
        params.dest = dest
      }

      const hash = utils.getHash()

      let state = {
        isCanceled: false
      }

      let notification = {
        progress: {
          percent: 0,
          fileCount: 0,
          file: ''
        },
        action: 'update-by-type',
        hash,
        type: `archiver:extract-progress-${hash}`,
        colorStatus: 'blue',
        timeout: 0,
      }

      const appBinExtractStream = node7z.extractFull(
        params.source,
        params.dest,
        {
          $bin: store.state.appPaths.bin7Zip,
          $progress: true
        }
      )

      appBinExtractStream.on('error', (error) => {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'archiver:extract-error',
          colorStatus: 'red',
          timeout: 5000,
          title: 'Error: cannot extract the archive',
          message: error
        })
      })

      appBinExtractStream.on('progress', (progress) => {
        notification.progress = progress
        notification.title = 'Extracting archive'
        notification.message = `
          ${notification.progress.percent}% • 
          ${notification.progress.fileCount} files
          <br><b>Archive:</b> ${params.source}
        `
        notification.actionButtons = [
          {
            title: 'cancel',
            onClick: () => {
              appBinExtractStream._childProcess.kill()
              state.isCanceled = true
            }
          }
        ]
        eventHub.$emit('notification', notification)
      })

      appBinExtractStream.on('end', () => {
        notification.timeout = 5000
        notification.actionButtons = []
        notification.message = `
          Done • ${notification.progress.fileCount} files
          <br><b>Destination:</b> ${params.dest}
        `
        if (!state.isCanceled) {
          notification.colorStatus = 'teal'
          notification.title = 'Archive was extracted'
          eventHub.$emit('notification', notification)
        }
        else {
          notification.colorStatus = 'red'
          notification.title = 'Archive extraction canceled',
          eventHub.$emit('notification', notification)
        }
      })
    },
    SET_NAVIGATOR_STATE (store) {
      store.state.navigatorView.state = {
        selectedDirItems: utils.cloneDeep(store.getters.selectedDirItems),
        currentDir: store.state.navigatorView.currentDir
      }
    },
    async RESTORE_NAVIGATOR_STATE (store) {
      // When the current directory is reloaded,
      // restore the last navigator state so that the dir item
      // selection is not lost, only the data is refreshed
      const navigatorView = store.state.navigatorView
      if (navigatorView.state.currentDir.path === navigatorView.currentDir.path) {
        await store.dispatch('REPLACE_SELECTED_DIR_ITEMS', navigatorView.state.selectedDirItems)
      }
    },
     async FOCUS_DIR_ITEM (store, params) {
      if (params.focusPath) {
        const dirInfo = await store.dispatch('FETCH_DIR_ITEM_INFO', params.focusPath)
        await store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [dirInfo])
      }
    },
    async FETCH_DIR_ITEM_INFO ({ state, commit, getters }, path) {
      if (path === '' || !path) {
        path = state.appPaths.home
      }
      const navigatorLayoutItemHeight = state.storageData.settings.navigatorLayoutItemHeight
      const dirInfo = await navigatorCore.getDirItemInfo(path, navigatorLayoutItemHeight)
      return dirInfo
    },
    async FETCH_DIR_ITEMS ({ state, commit, getters }, path) {
      console.time('time::FETCH_DIR_ITEMS')
      const navigatorLayoutItemHeight = state.storageData.settings.navigatorLayoutItemHeight
      const dirItems = await navigatorCore.getDirItems(path, navigatorLayoutItemHeight)
      console.timeEnd('time::FETCH_DIR_ITEMS')
      return dirItems
    },
    OPEN_DIR_ITEM (store, item) {
      if (item.isInaccessible) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'copyValue',
          timeout: 7000,
          title: 'Cannot open this item',
          message: `
            <b>Reason:</b> item has immutable or read-only attributes.
            <br>You can reset item permissions in the "permissions" menu.
          `
        })
        return
      }
      if (item.type === 'file' || item.type === 'file-symlink') {
        store.dispatch('OPEN_FILE', item.path)
      }
      else {
        store.dispatch('LOAD_DIR', { path: item.realPath })
      }
    },
    OPEN_DIR_ITEM_FROM_PATH (store, path) {
      store.dispatch('FETCH_DIR_ITEM_INFO', path)
        .then((item) => {
          store.dispatch('OPEN_DIR_ITEM', item)
        })
    },
    OPEN_DIR_PATH_FROM_OS_CLIPBOARD (store) {
      const osClipboardText = electron.clipboard.readText()
      const path = PATH.normalize(osClipboardText)
      fs.access(path, fs.constants.F_OK, (error) => {
        if (error) {
          eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'open-os-clipboard-path',
            timeout: 6000,
            title: 'Cannot open the path in the clipboard',
            message: '<b>Reason:</b> path does not exist on the drive.'
          })
        }
        else {
          store.dispatch('LOAD_DIR', { path: osClipboardText })
          eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'open-os-clipboard-path',
            timeout: 2000,
            title: 'Opened path from clipboard',
            message: osClipboardText
          })
        }
      })
    },
    SHOW_DIR_ITEM_IN_DIRECTORY (store, payload) {
      store.dispatch('LOAD_DIR', {path: payload.dir})
        .then(() => {
          const dirItemNodes = document.querySelectorAll('.dir-item-card')
          const itemPath = payload.itemPath.replace(/\\/g, '/')
          dirItemNodes.forEach(node => {
            const itemExists = node.getAttribute('data-item-path') === itemPath
            if (itemExists) {
              itemNodeToHighlight.scrollIntoView(true)
              dispatch('FOCUS_DIR_ITEM', {focusPath: itemPath})
            }
          })
        })
    },
    COPY_CURRENT_DIR_PATH (store) {
      const path = store.state.navigatorView.currentDir.path
      store.dispatch('COPY_DIR_PATH_TO_CLIPBOARD', {path})
    },
    COPY_DIR_PATH_TO_CLIPBOARD (store, params = {}) {
      if (params.path) {
        utils.copyToClipboard({
          text: params.path,
          title: 'Path was copied to clipboard',
          message: params.path,
          asPath: true,
          pathSlashes: sharedUtils.platform === 'win32'
            ? 'single-backward'
            : ''
        })
      }
    },
    OPEN_ADDRESS_BAR_EDITOR (store) {
      store.state.addressBarEditor = true
    },
    TOGGLE_GLOBAL_SEARCH (store) {
      if (router.history.current.name === 'navigator') {
        store.state.globalSearch.widget = !store.state.globalSearch.widget
      }
      else {
        const someDirLoaded = Object.keys(store.state.navigatorView.currentDir).length !== 0
        if (!someDirLoaded) {
          store.dispatch('OPEN_DIR_ITEM_FROM_PATH', '')
        }
        else {
          router.push('navigator').catch((error) => {})
        }
        store.state.globalSearch.widget = true
      }
    },
    LOAD_PREVIOUS_HISTORY_PATH ({ state, commit, dispatch, getters }) {
      const historyItems = state.navigatorView.history.items
      const currentHistoryIndex = state.navigatorView.history.currentIndex
      const previousHistoryPath = historyItems[currentHistoryIndex - 1]
      if (currentHistoryIndex > 0) {
        dispatch('LOAD_DIR', { path: previousHistoryPath, skipHistory: true })
        dispatch('SET', {
          key: 'navigatorView.history.currentIndex',
          value: currentHistoryIndex - 1
        })
      }
    },
    LOAD_NEXT_HISTORY_PATH ({ state, commit, dispatch, getters }) {
      const historyItems = state.navigatorView.history.items
      const currentHistoryIndex = state.navigatorView.history.currentIndex
      const nextHistoryPath = historyItems[currentHistoryIndex + 1]
      if (currentHistoryIndex < historyItems.length - 1) {
        dispatch('LOAD_DIR', { path: nextHistoryPath, skipHistory: true })
        dispatch('SET', {
          key: 'navigatorView.history.currentIndex',
          value: currentHistoryIndex + 1
        })
      }
    },
    GO_UP_DIRECTORY ({ state, commit, dispatch, getters }) {
      const dir = PATH.parse(state.navigatorView.currentDir.path).dir
      dispatch('LOAD_DIR', { path: dir })
    },
    ADD_WORKSPACE ({ state, commit, dispatch, getters }, workspace) {
      dispatch('ADD_WORKSPACE_TO_STORAGE', workspace)
      eventHub.$emit('notification', {
        action: 'add',
        timeout: 3000,
        type: '',
        closeButton: true,
        title: localize.get('text_workspace_added')
      })
    },
    ADD_EXTERNAL_PROGRAM ({ state, commit, dispatch, getters }, program) {
      // Add program to the list of existing programs
      program.hashID = utils.getHash()
      const items = [...state.storageData.settings.externalPrograms.items, ...[program]]
      // Update store
      dispatch('SET', {
        key: 'storageData.settings.externalPrograms.items',
        value: items
      })
      eventHub.$emit('notification', {
        action: 'add',
        timeout: 3000,
        type: '',
        closeButton: true,
        title: 'Success: program was added'
      })
    },
    EDIT_EXTERNAL_PROGRAM ({ state, commit, dispatch, getters }, updatedProgram) {
      const items = state.storageData.settings.externalPrograms.items
      let currentProgramIndex = items.findIndex(item => item.hashID === updatedProgram.hashID)
      items[currentProgramIndex] = updatedProgram
      // Update store
      dispatch('SET', {
        key: 'storageData.settings.externalPrograms.items',
        value: items
      })
      eventHub.$emit('notification', {
        action: 'add',
        timeout: 3000,
        type: '',
        closeButton: true,
        title: 'Success: program was edited'
      })
    },
    DELETE_EXTERNAL_PROGRAM ({ state, commit, dispatch, getters }, programToDelete) {
      const items = state.storageData.settings.externalPrograms.items
      let programToDeleteIndex = items.findIndex(item => item.hashID === programToDelete.hashID)
      items.splice(programToDeleteIndex, 1)
      // Update store
      dispatch('SET', {
        key: 'storageData.settings.externalPrograms.items',
        value: items
      })
      eventHub.$emit('notification', {
        action: 'add',
        timeout: 3000,
        type: '',
        closeButton: true,
        title: 'Success: program was deleted'
      })
    },
    CLEAR_DIR_ITEMS_TIMELINE ({ state, commit, dispatch, getters }) {
      let undoData = utils.cloneDeep(state.storageData.stats.dirItemsTimeline)
      dispatch('SET', {
        key: 'storageData.stats.dirItemsTimeline',
        value: []
      })
      eventHub.$emit('notification', {
        action: 'add',
        type: 'undo:clearPinned',
        icon: 'mdi-undo-variant',
        title: localize.get('text_clear_list_message'),
        actionButtons: [
          {
            title: localize.get('text_undo'),
            action: '',
            onClick: () => {
              dispatch('SET', {
                key: 'storageData.stats.dirItemsTimeline',
                value: undoData
              })
            },
            closesNotification: true
          }
        ],
        onNotificationRemove: () => {
          undoData = null
        }
      })
    },
    CLEAR_PINNED ({ state, commit, dispatch, getters }) {
      let undoData = utils.cloneDeep(state.storageData.pinned.items)
      dispatch('SET', {
        key: 'storageData.pinned.items',
        value: []
      })
      eventHub.$emit('notification', {
        action: 'add',
        type: 'undo:clearPinned',
        icon: 'mdi-undo-variant',
        timeout: 10000,
        title: localize.get('text_clear_list_message'),
        actionButtons: [
          {
            title: localize.get('text_undo'),
            action: '',
            onClick: () => {
              dispatch('SET', {
                key: 'storageData.pinned.items',
                value: undoData
              })
            },
            closesNotification: true
          }
        ],
        onNotificationRemove: () => {
          undoData = null
        }
      })
    },
    CLEAR_PROTECTED ({ state, commit, dispatch, getters }) {
      let undoData = utils.cloneDeep(state.storageData.protected.items)
      dispatch('SET', {
        key: 'storageData.protected.items',
        value: []
      })
      eventHub.$emit('notification', {
        action: 'add',
        type: 'undo:clearProtected',
        icon: 'mdi-undo-variant',
        timeout: 10000,
        title: localize.get('text_clear_list_message'),
        actionButtons: [
          {
            title: localize.get('text_undo'),
            action: '',
            onClick: () => {
              dispatch('SET', {
                key: 'storageData.protected.items',
                value: undoData
              })
            },
            closesNotification: true
          }
        ],
        onNotificationRemove: () => {
          undoData = null
        }
      })
    },
    REMOVE_FROM_STORAGE_LIST (store, params) {
      if (params.items.length === 0) {return}
      const defaultParams = {
        items: [],
        storageItems: [],
        storageItemsKey: '',
        options: {
          silent: false,
          allowUndo: true,
        }
      }
      params = { ...defaultParams, ...params }

      let undoData = utils.cloneDeep(params.storageItems)
      let filteredItems = filterItems()
      let notificationCondition = false
      let notificationParams = {}

      setParams()
      setStorage()
      addNotification()

      function filterItems () {
        return utils.cloneDeep(params.storageItems)
          .filter(listItem => {
            let specifiedItem = params.items.some(item => item.path === listItem.path)
            return !specifiedItem
          })
      }

      function setParams () {
        if (params.storageItemsKey === 'storageData.pinned.items') {
          const unpinnedCount = undoData.length - filteredItems.length
          notificationCondition = !params.options.silent && unpinnedCount > 0
          notificationParams.title = `Removed ${params.items.length} items from pinned`
        }
        else if (params.storageItemsKey === 'storageData.protected.items') {
          notificationCondition = !params.options.silent
          notificationParams.title = `Removed ${params.items.length} items from protected`
        }
        else if (params.storageItemsKey === 'storageData.stats.dirItemsTimeline') {
          notificationCondition = !params.options.silent
          notificationParams.title = `Removed ${params.items.length} items from timeline`
        }
      }

      function setStorage () {
        store.dispatch('SET', {
          key: params.storageItemsKey,
          value: filteredItems
        })
      }

      function addNotification () {
        if (notificationCondition) {
          let actionButtons = []
          if (params.options.allowUndo) {
            actionButtons.push({
              title: localize.get('text_undo'),
              action: '',
              onClick: () => {
                store.dispatch('SET', {
                  key: params.storageItemsKey,
                  value: undoData
                })
              },
              closesNotification: true
            })
          }
          eventHub.$emit('notification', {
            action: 'add',
            type: `undo:${params.storageItemsKey}`,
            icon: 'mdi-undo-variant',
            timeout: params.options.allowUndo ? 8000 : 4000,
            title: notificationParams.title,
            actionButtons,
            onNotificationRemove: () => {undoData = null}
          })
        }
      }
    },
    REMOVE_FROM_PINNED (store, params) {
      let items = getDirItemsFromSavedList({
        items: params.items,
        list: store.state.storageData.pinned.items
      })
      params.items = items
      store.dispatch('REMOVE_FROM_STORAGE_LIST', {
        storageItems: store.state.storageData.pinned.items,
        storageItemsKey: 'storageData.pinned.items',
        ...params
      })
    },
    REMOVE_FROM_PROTECTED (store, params) {
      let items = getDirItemsFromSavedList({
        items: params.items,
        list: store.state.storageData.protected.items
      })
      params.items = items
      store.dispatch('REMOVE_FROM_STORAGE_LIST', {
        storageItems: store.state.storageData.protected.items,
        storageItemsKey: 'storageData.protected.items',
        ...params
      })
    },
    REMOVE_FROM_DIR_ITEMS_TIMELINE (store, params) {
      let items = getDirItemsFromSavedList({
        items: params.items,
        list: store.state.storageData.stats.dirItemsTimeline
      })
      params.items = items
      store.dispatch('REMOVE_FROM_STORAGE_LIST', {
        storageItems: store.state.storageData.stats.dirItemsTimeline,
        storageItemsKey: 'storageData.stats.dirItemsTimeline',
        ...params
      })
    },
    ENSURE_DIR_ITEMS_SAFE_TO_DELETE ({ state, commit, dispatch, getters }, payload) {
      const { operation, items } = payload
      // TODO:
      // Instead of checking currentDir, check PATH.parse(item).dir instead,
      // in case it's possible to delete an item while not being located in currentDir.
      return new Promise((resolve, reject) => {
        // Clone edit targets so they don't change during the operation
        const editTargets = utils.cloneDeep(items)
        const currentDirPath = state.navigatorView.currentDir.path
        const includesCurrentDir = editTargets.some(item => item.path === currentDirPath)
        const protectedItems = getDirItemsFromSavedList({
          items: editTargets,
          list: state.storageData.protected.items
        })
        const currentDirIsRoot = PATH.parse(currentDirPath).base === ''
        const includesItemLocatedInRoot = editTargets.some(item => {
          const itemDir = PATH.parse(item.path).dir
          const dirOfItemDirIsRoot = PATH.parse(itemDir).base === ''
          return dirOfItemDirIsRoot
        })

        confirmAll()
          .then((result) => { resolve(result) })
          .catch((result) => { resolve(result) })

        // Make sure all conformations were approved
        async function confirmAll () {
          try {
            // Resolve the last result, the editTargets are all the same
            let resultConfirmDeleteFromDrive = await confirmDeleteFromDrive(editTargets)
            let resultCheckIfDirItemsIncludeRootDir = await checkIfDirItemsIncludeRootDir(resultConfirmDeleteFromDrive.editTargets)
            let resultCheckIfDirItemsLocatedInRoot = await checkIfDirItemsLocatedInRoot(resultCheckIfDirItemsIncludeRootDir.editTargets)
            let resultCheckIfDirItemsProtected = await checkIfDirItemsProtected(resultCheckIfDirItemsLocatedInRoot.editTargets)
            return resultCheckIfDirItemsProtected.editTargets
          }
          catch (error) {
            reject([])
          }
        }

        function confirmDeleteFromDrive (editTargets) {
          return new Promise((resolve, reject) => {
            const editTargetsList = editTargets.map(item => item.path).join('<br>')
            // If operation === 'delete', confirm
            if (operation === 'delete') {
              // Configure conformationDialog data
              const data = {
                height: '250px',
                title: 'Attention: deleting items from drive',
                message: `
                  This operation will permanently delete ${editTargets.length} items from your computer:
                  <br>
                  ${editTargetsList}
                `,
                closeButton: {
                  onClick: () => {
                    resolve({ status: 'cancel' })
                    state.dialogs.conformationDialog.value = false
                  }
                },
                buttons: [
                  {
                    text: 'cancel',
                    onClick: () => {
                      reject()
                      state.dialogs.conformationDialog.value = false
                    }
                  },
                  {
                    text: 'confirm delete',
                    onClick: () => {
                      resolve({ status: 'delete-all', editTargets })
                      state.dialogs.conformationDialog.value = false
                    }
                  }
                ]
              }
              state.dialogs.conformationDialog.data = data
              state.dialogs.conformationDialog.value = true
            }
            else {
              resolve({ status: 'delete-all', editTargets })
            }
          })
        }

        function checkIfDirItemsIncludeRootDir (editTargets) {
          return new Promise((resolve, reject) => {
            // If some selected dir items is root directory
            if (currentDirIsRoot && includesCurrentDir) {
              eventHub.$emit('notification', {
                action: 'update-by-type',
                type: 'dirItemCannotBeDeleted',
                icon: 'mdi-trash-can-outline',
                timeout: 3000,
                title: 'You cannot delete drive\'s root directory'
              })
              reject()
            }
            else {
              resolve({ status: 'delete-all', editTargets })
            }
          })
        }

        function checkIfDirItemsProtected (editTargets) {
          return new Promise((resolve, reject) => {
            // If some selected dir items are protected
            if (protectedItems.length > 0) {
              // Configure conformationDialog data
              const data = {
                title: 'Attention: deleting protected items',
                message: `
                  Selected items contain ${protectedItems.length} protected items
                `,
                closeButton: {
                  onClick: () => {
                    reject()
                  }
                },
                buttons: [
                  {
                    text: 'cancel',
                    onClick: () => {
                      reject()
                    }
                  },
                  {
                    text: 'delete unprotected',
                    onClick: () => {
                      const unprotectedItems = [...editTargets].filter(item => {
                        return !state.storageData.protected.items.some(protectedItem => {
                          return protectedItem.path === item.path
                        })
                      })
                      resolve({ status: 'delete-unprotected', editTargets: unprotectedItems })
                    }
                  },
                  {
                    text: 'delete all',
                    onClick: () => {
                      resolve({ status: 'delete-all', editTargets })
                    }
                  }
                ]
              }
              state.dialogs.conformationDialog.data = data
              state.dialogs.conformationDialog.value = true
            }
            else {
              resolve({ status: 'delete-all', editTargets })
            }
          })
        }

        function checkIfDirItemsLocatedInRoot (editTargets) {
          return new Promise((resolve, reject) => {
            // If some selected dir items are located in root
            if (includesItemLocatedInRoot) {
              // Configure conformationDialog data
              const data = {
                height: '250px',
                title: 'Attention: deleting items in drive root',
                message: `
                  You are about to delete a file / directory located
                  in the root of a drive. Make sure these are your personal files and you are not deleting
                  any system files, otherwise your computer might become unusable.
                `,
                closeButton: {
                  onClick: () => {
                    reject({ status: 'failure:cancel', editTargets })
                    state.dialogs.conformationDialog.value = false
                  }
                },
                buttons: [
                  {
                    text: 'cancel',
                    onClick: () => {
                      reject({ status: 'failure:cancel', editTargets })
                      state.dialogs.conformationDialog.value = false
                    }
                  },
                  {
                    text: 'confirm delete',
                    onClick: () => {
                      resolve({ status: 'success:confirm-delete', editTargets })
                      state.dialogs.conformationDialog.value = false
                    }
                  }
                ]
              }
              state.dialogs.conformationDialog.data = data
              state.dialogs.conformationDialog.value = true
            }
            else {
              resolve({ status: 'delete-all', editTargets })
            }
          })
        }
      })
    },
    async TRASH_SELECTED ({ state, commit, dispatch, getters }, payload) {
      let itemsToTrash = getters.selectedDirItems
      dispatch('ENSURE_DIR_ITEMS_SAFE_TO_DELETE',  { operation: 'trash', items: itemsToTrash })
        .then((editTargets) => {
          if (editTargets.length === 0) {
            return false
          }
          else {
            console.log('editTargets', editTargets)
            electron.ipcRenderer.send('compute-request:trashDirItems', { items: editTargets })
            electron.ipcRenderer.once('compute-request-reply:trashDirItems', (event, data) => {
              dispatch('REMOVE_FROM_PROTECTED', {
                items: editTargets,
                options: {
                  silent: false,
                  allowUndo: false
                }
              })
              dispatch('REMOVE_FROM_PINNED', {
                items: editTargets,
                options: {
                  silent: false,
                  allowUndo: false
                }
              })
              dispatch('CLEAR_FS_CLIPBOARD')
              dispatch('DESELECT_ALL_DIR_ITEMS')
              let areAllItemsTrashed = editTargets.every(item => data.trashedItems.includes(item.path))
              // If route is still 'navigator', ask if user wants to reload the current directory
              let actionButtons = []
              if (router.currentRoute.name === 'navigator') {
                actionButtons = [
                  {
                    title: 'reload current directory',
                    onClick: () => {
                      dispatch('RELOAD_DIR')
                    },
                    closesNotification: true
                  }
                ]
              }
              if (areAllItemsTrashed) {
                eventHub.$emit('notification', {
                  action: 'update-by-type',
                  type: 'successItemsTrashed',
                  icon: 'mdi-tab',
                  timeout: 5000,
                  title: `Success | sent
                          ${data.trashedItems.length}
                          ${localizeUtils.pluralize(data.trashedItems.length, 'item')}
                          to trash`,
                  actionButtons
                })
              }
              else {
                eventHub.$emit('notification', {
                  action: 'update-by-type',
                  type: 'failureItemsTrashed',
                  icon: 'mdi-tab',
                  timeout: 5000,
                  title: `Failure | couldn't send
                          ${data.notTrashedItems.length}
                          ${localizeUtils.pluralize(data.notTrashedItems.length, 'item')}
                          to trash:`,
                  message: data.notTrashedItems.join('<br>'),
                  actionButtons
                })
              }
            })

            // await trash(getters.selectedDirItemsPaths)
            // Check if it was trashed
            // let itemsAmount = getters.selectedDirItemsPaths.length
            // let trashedItems = []
            // let notTrashedItems = []
            // let promises = []
            // getters.selectedDirItemsPaths.forEach(path => {
            //   let promiseToCheck = fs.promises.access(path, fs.constants.F_OK)
            //     .then(() => {
            //       notTrashedItems.push(path)
            //     })
            //     .catch((error) => {
            //       trashedItems.push(path)
            //     })
            //   promises.push(promiseToCheck)
            // })
            // Promise.all(promises)
            //   .then(() => {
            //     // eventHub.$emit('notification', {
            //     //   action: 'update-by-type',
            //     //   type: 'successItemsTrashed',
            //     //   icon: 'mdi-tab',
            //     //   timeout: 3000,
            //     //   title: `Trashed ${itemsAmount} ${localizeUtils.pluralize(itemsAmount, 'item')}`
            //     // })
            //   })
          }
        })
        .catch((error) => {})
    },
    /**
    * payload: {
    *   items {Array}
    *   options: {
    *     skipSafeCheck {Boolean}
    *   }
    * }
    */
    INIT_DELETE_SELECTED ({ state, commit, dispatch, getters }, payload) {
      dispatch('DELETE_DIR_ITEMS', { items: getters.selectedDirItems })
    },
    /**
    * @param {object} payload
    * @param {array<object>} payload.items
    */
    DELETE_DIR_ITEMS ({ state, commit, dispatch, getters }, payload) {
      payload.options = payload.options ?? {}
      let defaultOptions = {
        skipSafeCheck: false,
        silent: false,
        allowUndo: false
      }
      let options = { ...defaultOptions, ...payload.options }
      const items = payload.items
      if (options.skipSafeCheck) {
        initDeleteDirItems({items, options})
      }
      else {
        dispatch('ENSURE_DIR_ITEMS_SAFE_TO_DELETE', { operation: 'delete', items })
          .then(() => {
            initDeleteDirItems({items, options})
          })
      }

      function initDeleteDirItems (params) {
        deleteDirItems(params)
          .then(() => {
            dispatch('REMOVE_FROM_PROTECTED', params)
            dispatch('REMOVE_FROM_PINNED', params)
            dispatch('CLEAR_FS_CLIPBOARD')
            dispatch('DESELECT_ALL_DIR_ITEMS')
          })
      }

      async function deleteDirItems(params) {
        return new Promise((resolve, reject) => {
          // Delete dir items
          const promises = []
          params.items.forEach(item => {
            const path = PATH.normalize(item.path)
            promises.push(fsExtra.remove(path))
          })
          Promise.all(promises)
            .then(() => {
              resolve()
              if (!params.options.silent) {
                eventHub.$emit('notification', {
                  action: 'update-by-type',
                  type: 'successItemsDeleted',
                  icon: 'mdi-tab',
                  timeout: 3000,
                  title: `Success | deleted ${params.items.length} ${localizeUtils.pluralize(params.items.length, 'item')}`
                })
              }
            })
            .catch((error) => {
              reject()
              if (!params.options.silent) {
                eventHub.$emit('notification', {
                  action: 'update-by-type',
                  type: 'successItemsDeleted',
                  icon: 'mdi-tab',
                  timeout: 3000,
                  title: `Failure | some items were not deleted`,
                  message: error
                })
              }
            })
        })
      }
    },
    async INIT_NEW_DIR_ITEM ({ state, commit, dispatch, getters }, payload) {
      state.dialogs.newDirItemDialog.data.type = payload.type
      const allConditionsAreFulfilled = await dispatch('CHECK_CONDITIONS', {
        routes: ['all']
      })
      if (allConditionsAreFulfilled) {
        dispatch('OPEN_DIALOG', { dialogName: 'newDirItemDialog' })
      }
    },
    SET_DIRECTORY_SIZE ({ state, commit, dispatch, getters }, payload) {
      payload.item.stat.size = payload.size
    },
    DELETE_ALL_NOTES_IN_TRASH ({ state, commit, dispatch, getters }) {
      commit('DELETE_ALL_NOTES_IN_TRASH')
      dispatch('SET', {
        key: 'storageData.notes.items',
        value: state.storageData.notes.items
      })
    },
    DELETE_NOTE ({ state, commit, dispatch, getters }, note) {
      commit('DELETE_NOTE', note)
      dispatch('SET', {
        key: 'storageData.notes.items',
        value: state.storageData.notes.items
      })
    },
    MOVE_NOTE_TO_TRASH ({ state, commit, dispatch, getters }, note) {
      commit('MOVE_NOTE_TO_TRASH', note)
      dispatch('SET', {
        key: 'storageData.notes.items',
        value: state.storageData.notes.items
      })
      eventHub.$emit('notification', {
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
        title: 'Note has been trashed',
        message: 'Switch to "trashed notes" list to see all trashed notes'
      })
    },
    RESTORE_NOTE_FROM_TRASH ({ state, commit, dispatch, getters }, note) {
      commit('RESTORE_NOTE_FROM_TRASH', note)
      dispatch('SET', {
        key: 'storageData.notes.items',
        value: state.storageData.notes.items
      })
    },
    UPDATE_NOTE ({ state, commit, dispatch, getters }, specifiedNote) {
      let noteItemsClone = utils.cloneDeep(state.storageData.notes.items)
      let noteToUpdateIndex = noteItemsClone.findIndex(note => note.hashID === specifiedNote.hashID)
      const currentDate = new Date().getTime()
      if (noteToUpdateIndex !== -1) {
        noteItemsClone[noteToUpdateIndex] = { ...noteItemsClone[noteToUpdateIndex], ...specifiedNote }
        noteItemsClone[noteToUpdateIndex].dateModified = currentDate
        dispatch('SET', {
          key: 'storageData.notes.items',
          value: noteItemsClone
        })
      }
    },
    UPDATE_NOTE_PROPERTY ({ state, commit, dispatch, getters }, payload) {
      let noteItemsClone = utils.cloneDeep(state.storageData.notes.items)
      let note = noteItemsClone.find(note => note.hashID === payload.note.hashID)
      const currentDate = new Date().getTime()
      note.dateModified = currentDate
      if (note) {
        note[payload.key] = payload.value
      }
      dispatch('SET', {
        key: 'storageData.notes.items',
        value: noteItemsClone
      })
    },
    ADD_PROTECTED ({ state, commit, dispatch, getters }, item) {
      // Add item to the protected items list
      const items = [...[item], ...storageData.protected.items]
      dispatch('SET', {
        key: 'storageData.protected.items',
        value: items
      })
    },
    ADD_NOTE ({ state, commit, dispatch, getters }, note) {
      // Add note to the list of existing notes
      const items = [...[note], ...state.storageData.notes.items]
      // Update store
      dispatch('SET', {
        key: 'storageData.notes.items',
        value: items
      })
      dispatch('SET', {
        key: 'noteEditor.openedNote',
        value: note
      })
    },
    OPEN_NOTE_EDITOR ({ state, commit, dispatch, getters }, payload) {
      router.push('notes').catch((error) => {})
      state.currentNotesList = 'existing'
      setTimeout(() => {
        if (payload.type === 'new') {
          // Set default note properties
          let openedNote = utils.cloneDeep(state.noteEditor.defaultNote)
          // Update some properties
          const currentDate = new Date().getTime()
          openedNote.hashID = utils.getHash()
          openedNote.dateCreated = currentDate
          openedNote.dateModified = currentDate
          // Add note
          dispatch('ADD_NOTE', openedNote)
        }
        else if (payload.type === 'edit') {
          dispatch('SET', {
            key: 'noteEditor.openedNote',
            value: payload.note
          })
        }
        state.dialogs.noteEditorDialog.value = true
      }, 500)
    },
    ADD_HOME_BANNER_BACKGROUND (store, mediaItem) {
      const mediaItems = store.state.storageData.settings.homeBanner.items
      mediaItems.push(mediaItem)
      // Refresh default background list
      setTimeout(() => {
        eventHub.$emit('media-iterator:method', {
          method: 'observeDirItems',
          params: {}
        })
      }, 200)
    },
    DELETE_HOME_PAGE_BACKGROUND (store, item) {
      const mediaItems = store.state.storageData.settings.homeBanner.items
      // Delete from store
      const backgroundItemIndex = mediaItems.findIndex(listItem => listItem.path === item.path)
      if (backgroundItemIndex !== -1) {
        mediaItems.splice(backgroundItemIndex, 1)
      }
      // Refresh custom background list
      store.state.dialogs.homeBannerPickerDialog.value = false
      setTimeout(() => {
        store.state.dialogs.homeBannerPickerDialog.value = true
      }, 200)
      // Delete from storage
      store.dispatch('DELETE_DIR_ITEMS', {
        items: [item],
        options: {
          skipSafeCheck: true,
          silent: true
        }
      })
      store.dispatch('RESET_HOME_BANNER_BACKGROUND')
    },
    RESET_HOME_BANNER_BACKGROUND ({ state, commit, dispatch }) {
      const mediaItems = state.storageData.settings.homeBanner.items
      const defaultMediaItem = mediaItems.find(item => item.isDefault)
      dispatch('SET_HOME_BANNER_BACKGROUND', defaultMediaItem)
    },
    SET_NEXT_HOME_BANNER_BACKGROUND ({ state, commit, dispatch }) {
      const mediaItems = state.storageData.settings.homeBanner.items
      const selectedItem = state.storageData.settings.homeBanner.selectedItem
      const selectedItemIndex = mediaItems.findIndex(item => item.path === selectedItem.path)
      if (selectedItemIndex === mediaItems.length - 1) {
        dispatch('SET_HOME_BANNER_BACKGROUND', mediaItems[0])
      }
      else {
        dispatch('SET_HOME_BANNER_BACKGROUND', mediaItems[selectedItemIndex + 1])
      }
    },
    SET_HOME_BANNER_BACKGROUND ({ state, commit, dispatch, getters }, mediaItem) {
      const data = {
        key: 'storageData.settings.homeBanner.selectedItem',
        value: mediaItem
      }
      dispatch('SET', data)
    },
    SET_HOME_BANNER_POSITION ({ commit, dispatch, getters }, payload) {
      let key
      if (payload.axis === 'x') {
        key = 'storageData.settings.homeBanner.selectedItem.positionX'
      }
      if (payload.axis === 'y') {
        key = 'storageData.settings.homeBanner.selectedItem.positionY'
      }
      dispatch('SET', {
        key: key,
        value: payload.value
      })
    },
    SELECT_HOME_BANNER_OVERLAY ({ state, commit, dispatch, getters }, color) {
      dispatch('SET', {
        key: 'storageData.settings.homeBanner.overlay.selected',
        value: color
      })
    },
    SORT_DIR_ITEMS ({ state, commit, dispatch, getters }) {
      commit('SORT_DIR_ITEMS')
    },
    SET_SORTING_TYPE ({ state, commit, dispatch, getters }, sortingType) {
      commit('SET_SORTING_TYPE', sortingType)
      dispatch('SORT_DIR_ITEMS')
    },
    TOGGLE_SORTING_ORDER ({ state, commit, dispatch, getters }) {
      commit('TOGGLE_SORTING_ORDER')
      dispatch('SORT_DIR_ITEMS')
    },
    UPDATE_DIR_ITEM_SELECTION_HISTORY (store) {
      store.state.navigatorView.previouslySelectedDirItems = store.state.navigatorView.selectedDirItems
    },
    HANDLE_HIGHLIGHT_DIR_ITEM_RANGE (store, params) {
      const isSomeDirItemSelected = store.getters.selectedDirItemsPaths.length !== 0
      const isCurrentDirSelected = store.getters.isCurrentDirItemSelected
      const isDraggingDirItem = store.state.overlays.dirItemDrag
      const shouldHighlightDirItems = store.state.inputState.shift && 
        isSomeDirItemSelected &&
        !isDraggingDirItem &&
        !isCurrentDirSelected
      if (shouldHighlightDirItems) {
        store.dispatch('HIGHLIGHT_DIR_ITEM_RANGE', {
          hoveredItem: params.hoveredItem
        })
      }
    },
    HIGHLIGHT_DIR_ITEM_RANGE ({ state, commit, dispatch, getters }, payload) {
      commit('DEHIGHLIGHT_ALL_DIR_ITEMS')
      commit('HIGHLIGHT_DIR_ITEM_RANGE', payload)
    },
    DEHIGHLIGHT_ALL_DIR_ITEMS ({ state, commit, dispatch, getters }) {
      commit('DEHIGHLIGHT_ALL_DIR_ITEMS')
    },
    ADD_HIGHLIGHTED_DIR_ITEMS_TO_SELECTED (store) {
      // Add highlighted to selected and remove duplicates
      // that were added during range selection
      const listToSelect = [
        ...store.state.navigatorView.selectedDirItems,
        ...store.getters.highlightedDirItems
      ]
      store.state.navigatorView.selectedDirItems = utils.getUnique(listToSelect, 'path')
    },
    SELECT_DIR_ITEM_RANGE ({ state, commit, dispatch, getters }, specifiedItem) {
      dispatch('ADD_TO_SELECTED_DIR_ITEMS', specifiedItem)
      dispatch('ADD_HIGHLIGHTED_DIR_ITEMS_TO_SELECTED')
    },
    /**
    * @param {object} params.item
    * @returns {string}
    */
    ADD_TO_SELECTED_DIR_ITEMS (store, specifiedItem) {
      const alreadySelected = store.state.navigatorView.selectedDirItems
        .find(item => item.path === specifiedItem.path)
      if (!alreadySelected) {
        store.state.navigatorView.selectedDirItems.push(specifiedItem)
        store.dispatch('UPDATE_DIR_ITEM_SELECTION_HISTORY')
        store.dispatch('UPDATE_INFO_PANEL_DATA', specifiedItem)
      }
    },
    REPLACE_SELECTED_DIR_ITEMS ({ state, commit, dispatch, getters }, items) {
      state.navigatorView.selectedDirItems = items
      dispatch('UPDATE_INFO_PANEL_DATA', items.getLast())
    },
    SELECT_DIR_ITEM (store, params) {
      if (params.index !== undefined) {
        let item = store.state.navigatorView.dirItems.find(item => item.dirItemPositionIndex === params.index)
        if (item) {
          store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [item])
        }
      }
    },
    DESELECT_DIR_ITEM ({ state, commit, dispatch, getters }, specifiedItem) {
      commit('DESELECT_DIR_ITEM', { getters, specifiedItem })
    },
    SELECT_ALL_DIR_ITEMS ({ state, commit, dispatch, getters }) {
      state.navigatorView.selectedDirItems = state.navigatorView.dirItems
    },
    DESELECT_ALL_DIR_ITEMS ({ state, commit, dispatch, getters }) {
      state.navigatorView.selectedDirItems = []
    },
    FETCH_SELECTED_ITEMS_DATA ({ state, commit, dispatch, getters }) {
      commit('FETCH_SELECTED_ITEMS_DATA', getters.selectedDirItems)
    },
    HANDLE_NO_DIR_ITEMS_SELECTED (store) {
      const noDirItemsSelected = store.state.navigatorView.selectedDirItems.length === 0
      if (noDirItemsSelected) {
        store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [store.state.navigatorView.currentDir])
      }
    },
    DISCARD_COPIED_DIR_ITEMS ({ state, commit }) {
      commit('DISCARD_COPIED_DIR_ITEMS')
    },
    DISCARD_MOVED_DIR_ITEMS ({ state, commit }) {
      commit('DISCARD_MOVED_DIR_ITEMS')
    },
    async FETCH_INFO_PANEL_DATA (store, item) {
      const { isReadOnly, permissions } = utils.getItemPermissions(item)
      const title = item.name
      const type = item.type
      const description = await store.dispatch('GET_INFO_PANEL_ITEM_DESCRIPTION', item)
      const mimeDescription = item.mime.mimeDescription
      const isDirItemPinned = store.state.storageData.pinned.items
        .some(listItem => listItem.path === item.path)
      const isDirItemProtected = store.state.storageData.protected.items
        .some(listItem => listItem.path === item.path)
      const copyShortcut = 'Ctrl + LClick'

      let copyPathTooltip
      if (sharedUtils.platform === 'win32') {
        copyPathTooltip = `
          <div>
            <span class="inline-code--light">${copyShortcut}</span> 
              - copy path with 
              <span class="inline-code--light">\\</span> 
              slashes
          </div>
          <div>
            <span class="inline-code--light">Ctrl + Alt + LClick</span> 
              - copy path with 
              <span class="inline-code--light">\\\\</span> 
              slashes
          </div>
        `
      }
      else {
        copyPathTooltip = `${localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
      }

      // Define main properties
      const properties = [
        {
          propName: 'path',
          title: localize.get('text_path'),
          value: item.path,
          tooltip: copyPathTooltip
        },
        {
          propName: 'dateCreated',
          title: localize.get('text_created'),
          value: utils.formatDateTime(item.stat.birthtime, 'D MMM YYYY'),
          tooltip: `${localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'dateModified',
          title: localize.get('text_modified'),
          value: utils.formatDateTime(item.stat.mtime, 'D MMM YYYY'),
          tooltip: `${localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'dateChanged',
          title: localize.get('text_changed'),
          value: utils.formatDateTime(item.stat.ctime, 'D MMM YYYY'),
          tooltip: `${localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'permissions',
          title: localize.get('text_mode'),
          value: permissions,
          tooltip: `${localize.get('tooltip_text_to_copy')}: ${copyShortcut}`
        },
        {
          propName: 'protected',
          title: localize.get('text_protected'),
          value: isDirItemProtected
            ? localize.get('text_yes')
            : localize.get('text_no'),
          tooltip: `
            Protected items cannot be modified or deleted (from within this app only). 
            Protected items can be found on the dashboard page.
          `
        },
        {
          propName: 'pinned',
          title: localize.get('text_pinned'),
          value: isDirItemPinned
            ? localize.get('text_yes')
            : localize.get('text_no'),
          tooltip: 'Pinned items can be found on the dashboard page'
        }
      ]
      // Append conditional properties
      const realPath = {
        propName: 'realPath',
        title: localize.get('text_real_path'),
        value: item.realPath,
        tooltip: copyPathTooltip
      }
      if (item.path !== item.realPath) {
        properties.splice(1, 0, realPath)
      }
      return {
        title,
        type,
        mimeDescription,
        description,
        properties,
        itemProps: item
      }
    },
    GET_INFO_PANEL_ITEM_DESCRIPTION (store, item) {
      const itemCount = item.dirItemCount
      const type = item.type
      const text_item = itemCount
        ? localizeUtils.pluralize(itemCount, 'item')
        : ''
      const description = `${itemCount ?? ''} ${text_item}`
      if (type === 'directory') {
        return `${localize.get('text_directory')}: ${description}`
      }
      else if (type === 'file') {
        return localize.get('text_file')
      }
      else if (type === 'file-symlink') {
        return localize.get('text_file_symlink')
      }
      else if (type === 'directory-symlink') {
        return localize.get('text_directory_symlink')
      }
    },
    async UPDATE_INFO_PANEL_DATA (store, item) {
      // Prevent 2 consecutive calls to this function:
      // - Lclick => dir item deselect (1st call)
      // - => currentDir select (2nd call)
      const shouldBreakOut = item?.path === store.state.navigatorView?.infoPanelData?.itemProps?.path
      if (shouldBreakOut) {return false}
      if (typeof item === 'string') {
        item = await store.dispatch('FETCH_DIR_ITEM_INFO', item)
      }
      store.state.navigatorView.infoPanelData = await store.dispatch('FETCH_INFO_PANEL_DATA', item)
      store.dispatch('TERMINATE_ALL_FETCH_DIR_SIZE')
      store.dispatch('AUTO_CALCULATE_DIR_SIZE', item)
    },
    AUTO_CALCULATE_DIR_SIZE (store, item) {
      const isRootDir = PATH.parse(item.path).base === ''
      if (store.state.storageData.settings.autoCalculateDirSize && !isRootDir) {
        store.dispatch('FETCH_DIR_SIZE', {item, options: {timeout: 1000}})
      }
    },
    SET_GLOBAL_SEARCH_DISALOWED_PATHS ({ state, commit, dispatch, getters }, value) {
      const normalisedList = value.map(path => {
        return PATH.posix.normalize(path).replace(/\\/g, '/')
      })
      dispatch('SET', {
        key: 'storageData.settings.globalSearch.disallowedPaths',
        value: normalisedList
      })
    },
    // Context menu actions
    /**
    * @param {array<object>} payload
    */
    SET_CONTEXT_MENU (store, payload) {
      // Note: clone selected items to avoid modifying items that were selected after
      // the context menu was opened (e.g. accidentally pressed shortcuts, unexpected app bugs, etc.)
      store.state.contextMenus.dirItem.targetItems = utils.cloneDeep(store.getters.selectedDirItems)
      if ((payload.value === 'toggle' || payload.value === false) && !payload.x && !payload.y) {
        store.state.contextMenus.dirItem.value = false
      }
      else if (payload.value === 'toggle') {
        store.state.contextMenus.dirItem.x = payload.x
        store.state.contextMenus.dirItem.y = payload.y
        store.state.contextMenus.dirItem.value = !store.state.contextMenus.dirItem.value
      }
      else if (payload.value === false) {
        store.state.contextMenus.dirItem.value = false
      }
      // When context menu location chnages while the menu is opened,
      // close the menu and reopen it after a short delay,
      // so it doesn't look like it instantly teleports to the new location
      else {
        const contextMenuWasOpened = store.state.contextMenus.dirItem.value
        store.state.contextMenus.dirItem.value = false
        setTimeout(() => {
          store.state.contextMenus.dirItem.x = payload.x
          store.state.contextMenus.dirItem.y = payload.y
          setTimeout(() => {
            store.state.contextMenus.dirItem.value = true
          }, 0)
        }, contextMenuWasOpened ? 100 : 0)
      }
    },
    INIT_FETCH_CONTEXT_MENU_TARGET_ITEMS (store, params) {
      store.dispatch('FETCH_CONTEXT_MENU_TARGET_ITEMS', params)
      store.dispatch('FETCH_CONTEXT_MENU_TARGET_ITEMS_STATS', params)
    },
    FETCH_CONTEXT_MENU_TARGET_ITEMS (store, params) {
      store.state.contextMenus[params.type].targetItems = utils.cloneDeep(store.getters.selectedDirItems)
    },
    FETCH_CONTEXT_MENU_TARGET_ITEMS_STATS (store, params) {
      const dirItems = utils.cloneDeep(store.getters.selectedDirItems)
      const dirItemsPaths = utils.cloneDeep(store.getters.selectedDirItemsPaths)
      const totalCount = utils.cloneDeep(store.getters.selectedDirItems.length)
      const directoryCount = utils.cloneDeep(store.getters.selectedDirectories.length)
      const fileCount = utils.cloneDeep(store.getters.selectedFiles.length)
      const symlinkCount = utils.cloneDeep(store.getters.selectedSymlinks.length)
      const directorySymlinkCount = utils.cloneDeep(store.getters.selectedDirectorySymlinks.length)
      const fileSymlinkCount = utils.cloneDeep(store.getters.selectedFileSymlinks.length)
      const fileExtensions = utils.cloneDeep(store.getters.selectedDirItemsExtensions)
      const fileTypes = utils.cloneDeep(store.getters.selectedDirItemsFileTypes.mime)
      const fileTypesReadable = utils.cloneDeep(store.getters.selectedDirItemsFileTypes.readable)
      const selectionType = totalCount === 1
        ? 'single'
        : totalCount > 1
        ? 'multiple'
        : 'none'

      const data = {
        dirItems,
        dirItemsPaths,
        totalCount,
        directoryCount,
        fileCount,
        symlinkCount,
        fileExtensions,
        fileTypes,
        fileTypesReadable,
        types: ['directory', 'file', 'file-symlink', 'directory-symlink'].filter(type => {
          const conditions = [
            type === 'directory' && directoryCount !== 0,
            type === 'file' && fileCount !== 0,
            type === 'file-symlink' && fileSymlinkCount !== 0,
            type === 'directory-symlink' && directorySymlinkCount !== 0
          ]
          return conditions.some(condition => condition === true)
        }),
        selectionType: selectionType
      }
      store.state.contextMenus[params.type].targetItemsStats = data
    },
    SET_PINNED (store, payload) {
      let items = payload ? payload : store.getters.selectedDirItems
      let pinnedItems = utils.cloneDeep(store.state.storageData.pinned.items)
      const allSelectedArePinned = checkAllSelectedArePinned()
      let itemCounter = 0
      let notificationParams = {}
      let itemToAdd = {}
      let itemPropertiesToStore = ['path']

      processItems()
      setStorage()
      setNotification()

      function checkAllSelectedArePinned () {
        return items.every(item => {
          return store.state.storageData.pinned.items
            .some(pinnedItem => pinnedItem.path === item.path)
        })
      }

      function processItems () {
        if (allSelectedArePinned) {
          removeItems()
          notificationParams.type = 'success:removedFromPinned'
          notificationParams.title = `Removed ${itemCounter} items from pinned`
        }
        else {
          setItems()
          notificationParams.type = 'success:addedToPinned'
          notificationParams.title = `Added ${itemCounter} items to pinned`
        }
      }

      function removeItems () {
        items.forEach(item => {
          let index = pinnedItems.findIndex(pinnedItem => pinnedItem.path === item.path)
          if (index !== -1) {
            itemCounter++
            pinnedItems.splice(index, 1)
          }
        })
      }

      function setItems () {
        items.forEach(item => {
          const dirItemIspinned = store.state.storageData.pinned.items
            .some(pinnedItem => pinnedItem.path === item.path)
          if (!dirItemIspinned) {
            itemCounter++
            addItemProperties(item)
            pinnedItems.unshift(itemToAdd)
          }
        })
      }

      function addItemProperties (item) {
        itemPropertiesToStore.forEach(propertyKey => {
          itemToAdd[propertyKey] = item[propertyKey]
        })
      }

      function setNotification () {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: notificationParams.type,
          timeout: 2000,
          closeButton: true,
          title: notificationParams.title,
        })
      }

      function setStorage () {
        store.dispatch('SET', {
          key: 'storageData.pinned.items',
          value: pinnedItems
        })
      }
    },
    /**
    * @param {array<object>} payload
    */
    SET_PROTECTED (store, payload) {
      let itemCounter = 0
      let notificationParams = {}
      let itemToAdd = {}
      let itemPropertiesToStore = ['path']

      let items = payload || store.getters.selectedDirItems
      let protectedItems = utils.cloneDeep(store.state.storageData.protected.items)
      const everySelectedIsProtected = items.every(item => {
        return store.state.storageData.protected.items.some(protectedItem => protectedItem.path === item.path)
      })

      processItems()
      setStorage()
      setNotification()

      function processItems () {
        if (everySelectedIsProtected) {
          removeItems()
          notificationParams.type = 'success:removedFromPinned'
          notificationParams.title = `Removed ${itemCounter} items from protected`
          // Set permissions
          // const permissions = {
          //   owner: 7,
          //   group: 7,
          //   others: 7
          // }
          // store.dispatch('SET_DIR_ITEM_PERMISSIONS', { path: item.path, permissions })
        }
        else {
          setItems()
          notificationParams.type = 'success:addedToProtected'
          notificationParams.title = `Added ${itemCounter} items to protected`
          // Set permissions
          // const permissions = {
          //   owner: 4,
          //   group: 4,
          //   others: 4
          // }
          // store.dispatch('SET_DIR_ITEM_PERMISSIONS', { path: item.path, permissions })
        }
      }

      function removeItems () {
        items.forEach(item => {
          let index = protectedItems.findIndex(protectedItem => protectedItem.path === item.path)
          if (index !== -1) {
            itemCounter++
            protectedItems.splice(index, 1)
          }
        })
      }

      function setItems () {
        items.forEach(item => {
          const dirItemIsProtected = store.state.storageData.protected.items
            .some(protectedItem => protectedItem.path === item.path)
          if (!dirItemIsProtected) {
            itemCounter++
            addItemProperties(item)
            protectedItems.unshift(itemToAdd)
          }
        })
      }

      function addItemProperties (item) {
        itemPropertiesToStore.forEach(propertyKey => {
          itemToAdd[propertyKey] = item[propertyKey]
        })
      }

      function setNotification () {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: notificationParams.type,
          timeout: 2000,
          closeButton: true,
          title: notificationParams.title,
        })
      }

      function setStorage () {
        store.dispatch('SET', {
          key: 'storageData.protected.items',
          value: protectedItems
        })
      }
    },
    async SET_DIR_ITEM_PERMISSIONS (store, params) {
      try {
        await fsManager.changeMode(params)
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'success:setDirItemPermissions',
          timeout: 3000,
          closeButton: true,
          title: `Permissions were changed`,
        })
      }
      catch (error) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'error:setDirItemPermissions',
          timeout: 3000,
          closeButton: true,
          title: `Failed to change permissions`,
          message: `${error}`
        })
      }
    },
    async GET_DIR_ITEM_PERMISSION_DATA (store, params) {
      const isImmutable = await fsManager.isDirItemImmutable({
        dirItem: params.dirItem
      })
      const owner = await fsManager.getDirItemOwner({
        dirItem: params.dirItem
      })
      return {
        isImmutable,
        owner
      }
    },
    async GET_DIR_ITEM_USER_DATA (store, params) {
      return await fsManager.getDirItemUsers({
        dirItem: params.dirItem
      })
    },
    async SET_DIR_ITEM_IMMUTABLE_STATE (store, params) {
      return await fsManager.setDirItemImmutableState(params)
    },
    async RESET_DIR_ITEM_PERMISSIONS (store) {
      try {
        await fsManager.resetPermissions({
          path: store.state.contextMenus.dirItem.targetItems[0].path
        })
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'success:resetDirItemPermissions',
          timeout: 3000,
          closeButton: true,
          title: `Permissions were reset`,
        })
      }
      catch (error) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'error:resetDirItemPermissions',
          timeout: 3000,
          closeButton: true,
          title: `Failed to reset permissions`,
          message: `${error}`
        })
      }
    },
    OPEN_APP_GUIDE (store, title) {
      let index = store.state.dialogs.guideDialog.data.guideTabs.findIndex(item => item.text === title)
      store.state.dialogs.guideDialog.data.guideTabsSelected = index
      store.state.dialogs.guideDialog.value = true
    },
    MAKE_DIR_ITEM_LINK (store, params = {}) {
      let defaultParams = {
        srcPath: store.state.contextMenus.dirItem.targetItems.getLast().path
      }
      params = {...defaultParams, ...params}
      params.uniqueDestPath = utils.getUniquePath(params.destPath)
      params.isDirectory = store.getters.selectedDirItems.getLast().type === 'directory'
      
      if (process.platform === 'win32') {
        if (params.linkType === 'windows-link') {
          childProcess.spawn('powershell', 
            [fsManager.getCommand({command: 'create-windows-link', ...params})]
          )
        }
        else {
          childProcess.spawn('powershell', 
            fsManager.getCommand({command: 'create-link', ...params})
          )
        }
      }
      else if (process.platform === 'linux') {        
        childProcess.spawn('sh', 
          fsManager.getCommand({command: 'create-link', ...params})
        )
      }
    },
    SET_TO_FS_CLIPBOARD (store, params) {
      const defaultParams = {
        items: store.getters.selectedDirItems
      }
      params = {...defaultParams, ...params}
      params.items = utils.cloneDeep(params.items)
      // Set clipboard data
      store.state.navigatorView.clipboard.fs.type = params.type
      store.state.navigatorView.clipboard.fs.items = params.items
    },
    ADD_TO_FS_CLIPBOARD (store, params) {
      const defaultParams = {
        items: store.getters.selectedDirItems
      }
      params = {...defaultParams, ...params}
      params.items = utils.cloneDeep(params.items)
      // Set clipboard data
      store.state.navigatorView.clipboard.fs.type = params.type
      params.items.forEach(item => {
        const itemAlreadyAdded = store.state.navigatorView.clipboard.fs.items
          .some(clipboardItem => clipboardItem.path === item.path)
        if (!itemAlreadyAdded) {
          store.state.navigatorView.clipboard.fs.items.push(item)
        }
      })
    },
    CLEAR_FS_CLIPBOARD (store) {
      store.state.navigatorView.clipboard.fs.type = ''
      store.state.navigatorView.clipboard.fs.items = []
    },
    async PASTE_FS_CLIPBOARD_DIR_ITEMS (store, params) {
      const defaultParams = {
        directory: store.state.navigatorView.currentDir.path
      }
      params = { ...defaultParams, ...params }
      const dirItemsToPaste = store.state.navigatorView.clipboard.fs.items
      const type = store.state.navigatorView.clipboard.fs.type
      if (type === 'move') {
        await store.dispatch('MOVE_DIR_ITEMS', {
          items: dirItemsToPaste,
          directory: params.directory,
          operation: type,
          options: {
            skipSafeCheck: true,
            silent: true
          }
        })
      }
      else {
        await store.dispatch('COPY_DIR_ITEMS', {
          items: dirItemsToPaste,
          directory: params.directory,
          operation: type
        })
      }
      store.dispatch('CLEAR_FS_CLIPBOARD')
    },
    CONFORMATION_DIALOG (store, params) {
      return new Promise((resolve, reject) => {
        store.state.dialogs.conformationDialog.data = params.data
        store.state.dialogs.conformationDialog.value = true
      })
    },
    SUDO_PASSWORD_PROMPT (store) {
      // TODO: review needed:
      // The entered sudo password can potentially stay in memory
      // Or leak out in some other way.
      return new Promise((resolve, reject) => {
        store.dispatch('CONFORMATION_DIALOG', {
          data: {
            title: 'Authentication required',
            message: `This operation requires admin rights`,
            inputs: [
              {
                model: '',
                type: 'password'
              }
            ],
            closeButton: {
              onClick: () => {
                resolve('cancel')
                store.state.dialogs.conformationDialog.data = {}
                store.state.dialogs.conformationDialog.value = false
              }
            },
            buttons: [
              {
                text: 'cancel',
                onClick: () => {
                  resolve('cancel')
                  store.state.dialogs.conformationDialog.data = {}
                  store.state.dialogs.conformationDialog.value = false
                }
              },
              {
                text: 'enter',
                onClick: () => {
                  resolve({action: 'enter', data: store.state.dialogs.conformationDialog.data})
                  store.state.dialogs.conformationDialog.data = {}
                  store.state.dialogs.conformationDialog.value = false
                }
              },
            ]
          }
        })
      })
    },
    SHOW_CONFIRMATION_DIALOG_MAKE_LINK (store, params) {
      return new Promise((resolve, reject) => {
        store.dispatch('CONFORMATION_DIALOG', {
          data: {
            title: params.title,
            message: `Specify link destination path`,
            inputs: [
              {
                model: params.destPath,
                type: ''
              }
            ],
            closeButton: {
              onClick: () => {
                resolve('cancel')
                store.state.dialogs.conformationDialog.data = {}
                store.state.dialogs.conformationDialog.value = false
              }
            },
            buttons: [
              {
                text: 'cancel',
                onClick: () => {
                  resolve('cancel')
                  store.state.dialogs.conformationDialog.data = {}
                  store.state.dialogs.conformationDialog.value = false
                }
              },
              {
                text: 'create',
                onClick: () => {
                  resolve({action: 'create', data: store.state.dialogs.conformationDialog.data})
                  store.state.dialogs.conformationDialog.data = {}
                  store.state.dialogs.conformationDialog.value = false
                }
              },
            ]
          }
        })
      })
    },
    SHOW_CONFIRMATION_DIALOG_PASTE_DIR_ITEMS (store, params) {
      return new Promise((resolve, reject) => {
        const data = {
          title: 'Files with that name already exist',
          message: `
            <ul>
              ${params.conflictedPaths.map(path => `<li>${path}</li>`).join('')}
            </ul>
          `,
          closeButton: {
            onClick: () => {
              store.state.dialogs.conformationDialog.value = false
              resolve('cancel')
            }
          },
          buttons: [
            {
              text: 'cancel',
              onClick: () => {
                store.state.dialogs.conformationDialog.value = false
                resolve('cancel')
              }
            },
            {
              text: 'replace all',
              onClick: () => {
                resolve('replace-all')
                store.state.dialogs.conformationDialog.value = false
                // const unprotectedItems = [...editTargets].filter(item => {
                //   return !state.storageData.protected.items.some(protectedItem => {
                //     return protectedItem.path === item.path
                //   })
                // })
                // resolve({ status: 'success:delete-unprotected', editTargets: unprotectedItems })
              }
            },
            {
              text: 'Auto rename',
              onClick: () => {
                resolve('auto-rename')
                store.state.dialogs.conformationDialog.value = false
                // resolve({ status: 'success:delete-all', editTargets })
                // dispatch('REMOVE_FROM_PROTECTED', {
                //   items: editTargets,
                //   options: {
                //     silent: true,
                //     allowUndo: false
                //   }
                // })
                // dispatch('REMOVE_FROM_PINNED', {
                //   items: editTargets,
                //   options: {
                //     silent: true,
                //     allowUndo: false
                //   }
                // })
              }
            }
          ]
        }
        store.state.dialogs.conformationDialog.data = data
        store.state.dialogs.conformationDialog.value = true
      })
    },
    async CHECK_DIR_ITEMS_NAME_CONFLICTS (store, params) {
      const dirItems = await store.dispatch('FETCH_DIR_ITEMS', params.directory)
      const conflictedPaths = []
      dirItems.forEach(dirItem => {
        if (params.items.includes(dirItem.path)) {
          conflictedPaths.push(dirItem.path)
        }
      })
      return conflictedPaths
    },
    async COPY_DIR_ITEMS (store, params) {
      return new Promise((resolve, reject) => {
        const defaultOptions = {
          operation: 'copy',
          overwrite: false
        }
        params = { ...defaultOptions, ...params }

        let notificationConfig = {
          action: 'update-by-hash',
          hashID: utils.getHash(),
          type: 'dir-item-transfer',
          icon: 'mdi-progress-clock',
          closeButton: true,
          timeout: 0,
          title: params.operation === 'move'
            ? 'Moving items...'
            : 'Copying items...',
        }
        eventHub.$emit('notification', notificationConfig)

        store.dispatch('CHECK_DIR_ITEMS_NAME_CONFLICTS', {
          directory: params.directory,
          items: params.items
        })
          .then((conflictedPaths) => {
            if (conflictedPaths.length > 0) {
              store.dispatch('SHOW_CONFIRMATION_DIALOG_PASTE_DIR_ITEMS', {
                conflictedPaths
              })
                .then((conformationResult) => {
                  if (conformationResult === 'replace-all' || conformationResult === 'auto-rename') {
                    store.dispatch('INIT_COPY_DIR_ITEMS_PROCESS', {
                      items: params.items,
                      directory: params.directory,
                      overwrite: conformationResult === 'replace-all',
                      operation: params.operation
                    })
                      .then(() => {resolveTransfer()})
                  }
                })
            }
            else {
              store.dispatch('INIT_COPY_DIR_ITEMS_PROCESS', {
                items: params.items,
                directory: params.directory,
                overwrite: false,
                operation: params.operation
              })
                .then(() => {resolveTransfer()})
            }
          })

        function resolveTransfer () {
          notificationConfig.title = params.operation === 'move'
            ? 'Items were moved'
            : 'Items were copied'
          notificationConfig.timeout = 3000
          eventHub.$emit('notification', notificationConfig)
          store.dispatch('RELOAD_DIR', {
            scrollTop: false
          })
          store.dispatch('CLEAR_FS_CLIPBOARD')
        }
      })
    },
    INIT_COPY_DIR_ITEMS_PROCESS (store, payload) {
      return new Promise((resolve, reject) => {
        let promises = []
        payload.items.forEach(item => {
          const parsedItemPath = PATH.parse(item.path)
          const destPath = PATH.normalize(PATH.join(payload.directory, parsedItemPath.base))
          const uniqueDestPath = utils.getUniquePath(destPath)
          const sourcePath = PATH.normalize(item.path)
          promises.push(startWriteProcess({sourcePath, uniqueDestPath, payload}))
        })
        Promise.allSettled(promises)
          .then(() => {
            resolve()
          })

        function startWriteProcess (params) {
          return new Promise((resolve, reject) => {
            if (params.payload.operation === 'move') {
              store.dispatch('MOVE_ITEM', {
                sourcePath: params.sourcePath,
                destPath: params.uniqueDestPath
              })
                .then(() => {resolve()})
            }
            else if (params.payload.operation === 'copy') {
              store.dispatch('COPY_ITEM', {
                sourcePath: params.sourcePath,
                destPath: params.uniqueDestPath
              })
                .then(() => {resolve()})
            }
          })
        }
      })
    },
    async MOVE_ITEM (store, payload) {
      try {
        fsExtra.move(payload.sourcePath, payload.destPath, {recursive: true}, error => {
          if (error) {throw Error(error)}
          return
        })
      }
      catch (error) {
        throw Error(error)
      }
    },
    async COPY_ITEM (store, payload) {
      try {
        fsExtra.copy(payload.sourcePath, payload.destPath, {recursive: true}, error => {
          if (error) {throw Error(error)}
          return
        })
      }
      catch (error) {
        throw Error(error)
      }
    },
    async MOVE_DIR_ITEMS ({ state, commit, dispatch, getters }, payload) {
      payload.operation = 'move'
      await dispatch('COPY_DIR_ITEMS', payload)
    },
    async RENAME_DIR_ITEM (store, payload) {
      const { oldPath, newPath, newName, oldName } = payload
      fs.access(newPath, fs.constants.F_OK, (error) => {
        // If path doesn't exist, rename the item
        if (error) {
          fs.promises.rename(oldPath, newPath)
            .then(() => {
              setTimeout(() => {
                eventHub.$emit('notification', {
                  action: 'add',
                  timeout: 8000,
                  closeButton: true,
                  title: 'Renamed 1 item',
                  message: `<b>Was</b>: ${oldName}
                            <br><b>Now</b>: ${newName}`,
                  actionButtons: [
                    {
                      title: localize.get('text_undo'),
                      action: '',
                      onClick: () => {
                        fs.promises.rename(newPath, oldPath)
                          .then(() => {
                            eventHub.$emit('notification', {
                              action: 'add',
                              timeout: 5000,
                              closeButton: true,
                              title: 'Success: undo rename',
                              message: oldPath
                            })
                          })
                          .catch((error) => {
                            throw Error(error)
                          })
                      },
                      closesNotification: true
                    }
                  ]
                })
              }, 1000)
              store.state.dialogs.renameDirItemDialog.value = false
            })
            .catch((error) => {
              if (error.code === 'ENOENT') {
                eventHub.$emit('notification', {
                  action: 'add',
                  timeout: 5000,
                  closeButton: true,
                  title: 'Failure: cannot rename item',
                  message: 'File / directory that you are renaming no longer exists'
                })
              }
              else {
                eventHub.$emit('notification', {
                  action: 'add',
                  timeout: 5000,
                  closeButton: true,
                  title: 'Failure: cannot rename item',
                  message: `Error: ${error}`
                })
              }
            })
        }
        // If path already exists, do not rename
        else {
          eventHub.$emit('notification', {
            action: 'add',
            timeout: 3000,
            closeButton: true,
            title: 'Failure: cannot rename item',
            message: `
              Item with that name already exists
              <br>${newName}
            `
          })
        }
      })
    },
    async ENSURE_DRIVE_HAS_SPACE ({ state, commit, dispatch, getters }, size) {
      // TODO: Check if destination drive has enough space
      return new Promise((resolve, reject) => {
        resolve()
      })
    },
    /** Prepares specified file for writing to drive.
    * @param {object} options
    * @param {string} options.size
    * @param {string} options.path
    * @param {string} options.directory
    * @param {string} options.operation
    */
    async INIT_WRITE_FILE ({ state, commit, dispatch, getters }, payload) {
      const defaultOptions = {
        operation: 'copy',
        overwrite: false
      }
      payload = { ...defaultOptions, ...payload }
      try {
        const item = await dispatch('FETCH_DIR_ITEM_INFO', payload.path)
        const uniqueDestPath = await dispatch('GET_UNIQUE_PATH', {
          path: payload.path,
          directory: payload.directory
        })
        const destPath = payload.overwrite ? payload.path : uniqueDestPath
        // await dispatch('ENSURE_DRIVE_HAS_SPACE', item.stat.size)
        await dispatch('WRITE_FILE', {
          item,
          destPath,
          operation: payload.operation,
        })
      }
      catch (error) {}
    },
    /** Gets unique path for specified path
    * @param {object} directory
    * @param {string} path
    */
    async GET_UNIQUE_PATH ({ state, commit, dispatch, getters }, payload) {
      return new Promise((resolve, reject) => {
        const parsedItemPath = PATH.parse(payload.path)
        const destPath = PATH.join(payload.directory, parsedItemPath.base)
        resolve(utils.getUniquePath(destPath))
      })
    },
    /** Writes specified file to drive
    * @param {object} item
    * @param {string} destPath
    * @param {string} operation
    */
    WRITE_FILE ({ state, commit, dispatch, getters }, payload) {
      return new Promise((resolve, reject) => {
        const { item, destPath, operation } = payload
        let counter = 1
        let finishedWriting = false

        // It seems that 16 Mb chunks (highWaterMark) is the best value.
        // RAM usage is low, CPU usage is low, drive usage is high (hence transfer speed is high)
        const chunkSize = 16 * 1024 * 1024 // 16 mb
        const hashID = utils.getHash()
        const readStream = fs.createReadStream(item.path, { highWaterMark: chunkSize })
        const writeStream = fs.createWriteStream(destPath, { highWaterMark: chunkSize })

        // Add new task
        const task = {
          name: 'copyDirItem',
          hashID,
          readStream,
          writeStream,
        }

        const progress = {
          started: false,
          isDone: false,
          isCanceled: false,
          timePassed: 0,
          timeStarted: new Date().getTime(),
          percentDone: 0,
          eta: 0
        }

        let notificationConfig = {
          action: 'update-by-hash',
          hashID,
          type: 'progress:download-file',
          icon: 'mdi-progress-clock',
          closeButton: true,
          timeout: 0,
          title: operation === 'move'
            ? 'Moving item...'
            : 'Copying item...',
          message: 'Getting info...',
          progress
        }

        // Add notification | write progress
        eventHub.$emit('notification', notificationConfig)

        // Configure stream listeners
        task.readStream.on('data', (chunk) => {
          progress.timePassed = new Date().getTime() - progress.timeStarted
          const percentageCopied = ((chunk.length * counter) / item.stat.size) * 100
          // Stop updating percentage after it reaches 100%
          // Otherwise the last chunk mess up the reading
          if (!finishedWriting) {
            if (percentageCopied > 100) {
              progress.percentDone = 100
              finishedWriting = true
            }
            else {
              progress.percentDone = Math.round(percentageCopied)
            }
          }
          counter += 1
          // Update notification buttons
          progress.started = true
          notificationConfig.message = ''
          // Show cancel button
          if (progress.timePassed > 1000) {
            notificationConfig.actionButtons = [
              {
                title: localize.get('text_cancel'),
                action: '',
                onClick: () => {
                  task.readStream.close()
                  progress.isCanceled = true
                },
                closesNotification: true
              }
            ]
          }
          // Update notification | write progress
          eventHub.$emit('notification', notificationConfig)
        })

        task.readStream.pipe(task.writeStream)
          .on('error', (error) => {
            notificationConfig.title = `Failed to ${payload.operation} the file`
            notificationConfig.message = `<b>Destination path:</b><br>${destPath}<br><b>Error:</b><br>${error}`
            notificationConfig.percentDone = undefined
            notificationConfig.timeout = 0
            notificationConfig.icon = 'mdi-alert-circle-outline'
            eventHub.$emit('notification', notificationConfig)
            reject()
          })
          .on('finish', () => {
            // Add delay so that animations don't play at the same time
            setTimeout(() => {
              // Update notification
              if (progress.isCanceled) {
                notificationConfig.actionButtons = []
                notificationConfig.title = 'Item transfer was canceled'
                notificationConfig.message = `<b>Destination path:</b><br>${destPath}`
                notificationConfig.timeout = 5000
                progress.isDone = true
              }
              else {
                notificationConfig.actionButtons = []
                // notificationConfig.actionButtons = [
                //   {
                //     title: localize.get('text_undo'),
                //     action: '',
                //     onClick: () => {
                //       console.log(item, destPath)
                //     },
                //     closesNotification: true
                //   }
                // ]
                // Update notification | write progress
                notificationConfig.title = operation === 'move'
                  ? 'Item was moved'
                  : 'Item was copied'
                notificationConfig.message = `<b>Destination path:</b><br>${destPath}`
                notificationConfig.timeout = 5000
                progress.isDone = true
              }
              eventHub.$emit('notification', notificationConfig)
              dispatch('REMOVE_TASK', { hashID })
              resolve()
            }, 1000)
          })
      })
    },
    STOP_APP_UPDATER ({ state, commit, dispatch, getters }) {
      appUpdater.stopInterval()
    },
    INIT_APP_UPDATER ({ state, commit, dispatch, getters }, params) {
      params = {
        notifyUnavailable: false,
        ...params
      }
      appUpdater.init({
        repo: state.appPaths.githubRepo,
        currentVersion: state.appVersion,
        onUpdateAvailable: (payload) => {
          dispatch('HANDLE_APP_UPDATE_AVAILABLE', payload)
        },
        onUpdateUnavailable: (payload) => {
          dispatch('HANDLE_APP_UPDATE_UNAVAILABLE', {...payload, ...params})
        }
      })
      .catch((error) => {
        if (error === 'asset-does-not-exist') {
          eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'update:asset-does-not-exist',
            icon: 'mdi-information-outline',
            timeout: 0,
            closeButton: true,
            title: 'Update error: asset does not exist',
            message: `
              Visit this project's "Releases" page to download the latest release manually.
            `,
            actionButtons: [
              {
                title: 'See all releases',
                action: '',
                onClick: () => {
                  utils.openLink(state.appPaths.githubLatestRelease)
                },
                closesNotification: true
              }
            ]
          })
        }
      })
    },
    HANDLE_APP_UPDATE_UNAVAILABLE ({ state, commit, dispatch, getters }, payload) {
      const { latestVersion, notifyUnavailable } = payload

      if (notifyUnavailable) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'update:unavailable',
          timeout: 5000,
          colorStatus: 'blue',
          isPinned: true,
          removeWhenHidden: false,
          title: 'No updates available',
          message: `
            <b>Current version:</b> ${state.appVersion}
            <br><b>Latest version:</b> ${latestVersion}
          `,
          closeButton: true,
          actionButtons: [
            {
              title: 'Project page',
              action: '',
              extrnalLink: state.appPaths.githubRepoLink,
              onClick: () => {
                utils.openLink(state.appPaths.githubRepoLink)
              },
              closesNotification: false
            }
          ]
        })
      }
    },
    HANDLE_APP_UPDATE_AVAILABLE ({ state, commit, dispatch, getters }, payload) {
      const { latestVersion, downloadLink, size } = payload

      const actionButtons = [
        {
          title: 'Download',
          action: '',
          onClick: () => {
            dispatch('DOWNLOAD_APP_UPDATE', {
              latestVersion,
              downloadLink,
              size,
            })
          },
          closesNotification: true
        },
        {
          title: 'See what\'s new',
          action: '',
          onClick: () => {
            utils.openLink(state.appPaths.githubChangelogLink)
          },
          closesNotification: false
        }
      ]

      eventHub.$emit('notification', {
        action: 'update-by-type',
        type: 'update:available',
        colorStatus: 'blue',
        isPinned: true,
        isUpdate: true,
        removeWhenHidden: false,
        timeout: 0,
        title: 'App update available',
        message: `
          <b>Current version:</b> ${state.appVersion}
          <br><b>Latest version:</b> ${latestVersion}
        `,
        closeButton: true,
        actionButtons
      })
    },
    HANDLE_APP_UPDATE_DOWNLOADED ({ state, commit, dispatch, getters }, payload) {
      const { latestVersion, info } = payload
      // Remove 'progress' notification
      eventHub.$emit('notification', {
        action: 'hide',
        hashID: info.hashID
      })

      const actionButtons = [
        {
          title: 'install update',
          action: '',
          onClick: () => {
            dispatch('OPEN_FILE', `${state.appPaths.updateDownloadDir}/${info.filename}`)
          },
          closesNotification: true
        },
        {
          title: 'show in directory',
          action: 'showDownloadedFile',
          closesNotification: false,
          onClick: () => {
            dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', { dir: info.dir, itemPath: info.filePath })
          }
        }
      ]

      // Push 'update was downloaded' notification
      eventHub.$emit('notification', {
        action: 'add',
        type: 'update:downloaded',
        colorStatus: 'blue',
        isPinned: true,
        isUpdate: true,
        removeWhenHidden: false,
        timeout: 0,
        title: `Update downloaded: v${latestVersion}`,
        message: 'Press install to close the app and update it',
        closeButton: true,
        actionButtons
      })

      // Remove "update-available" item from notifications list
      state.notifications = state.notifications.filter(item => item.type !== 'update-available')
    },
    DOWNLOAD_APP_UPDATE (store, params) {
      electron.ipcRenderer.send('download-file', {
        url: params.downloadLink,
        dir: store.state.appPaths.updateDownloadDir,
        hashID: utils.getHash(),
        size: params.size,
        isUpdate: true
      })
      electron.ipcRenderer.once('download-file-done', (event, info) => {
        if (params.autoInstall) {
          // Remove 'progress' notification
          eventHub.$emit('notification', {
            action: 'hide',
            hashID: info.hashID
          })
          store.dispatch('OPEN_FILE', `${store.state.appPaths.updateDownloadDir}/${info.filename}`)
        }
        else {
          store.dispatch('HANDLE_APP_UPDATE_DOWNLOADED', {latestVersion: params.latestVersion, info})
        }
      })
    },
    CHECK_IF_UPDATE_INSTALLED ({ state, commit, dispatch, getters }) {
      const lastRecordedAppVersion = state.storageData.settings.lastRecordedAppVersion
      if (lastRecordedAppVersion) {
        const recordedAppVersion = lastRecordedAppVersion.replace(/\./g, '')
        const currentAppVersion = state.appVersion.replace(/\./g, '')
        const updateWasInstalled = recordedAppVersion < currentAppVersion
        if (updateWasInstalled) {
          dispatch('NOTIFY_USER_UPDATE_INSTALLED')
        }
      }
      dispatch('SET', {
        key: 'storageData.settings.lastRecordedAppVersion',
        value: state.appVersion
      })
    },
    NOTIFY_USER_UPDATE_INSTALLED ({ state, commit, dispatch, getters }) {
      eventHub.$emit('notification', {
        action: 'add',
        type: 'update:installed',
        icon: 'mdi-check-circle-outline',
        colorStatus: 'blue',
        isPinned: true,
        isUpdate: true,
        removeWhenHidden: false,
        timeout: 0,
        title: `Update was installed: v${state.appVersion}`,
        message: 'Check out what\'s new and what\'s changed',
        closeButton: true,
        actionButtons: [
          {
            title: 'See what\'s new',
            action: '',
            onClick: () => {
              utils.openLink(state.appPaths.githubChangelogLink)
            },
            closesNotification: true
          }
        ]
      })
    },
    async HIDE_NOTIFICATION (store, notification) {
      store.dispatch('RESET_NOTIFICATION_TIMERS', notification)
      // Call onNotificationHide callback
      try {notification.onNotificationHide()}
      catch (error) {}

      if (notification.removeWhenHidden) {
        store.dispatch('REMOVE_NOTIFICATION', notification)
      }
      else {
        notification.isHidden = true
      }
    },
    REMOVE_NOTIFICATION (store, notification) {
      if (['update-by-hash', 'add', 'hide'].includes(notification.action)) {
        const notificationIndex = store.state.notifications.findIndex(item => item.hashID === notification.hashID)
        store.state.notifications.splice(notificationIndex, 1)
      }
      else if (notification.action === 'update-by-type') {
        const notificationIndex = store.state.notifications.findIndex(item => item.type === notification.type)
        store.state.notifications.splice(notificationIndex, 1)
      }
    },
    async RESET_NOTIFICATION_TIMERS (store, notification) {
      try {
        notification.timeoutData.ongoingTimeout.clear()
        clearInterval(notification.timeoutData.secondsCounterInterval)
        clearInterval(notification.timeoutData.percentsCounterInterval)
      }
      catch (error) {}
    },
    SCROLL_TOP_CONTENT_AREA (store, params) {
      const defaultParams = {
        behavior: 'smooth'
      }
      params = {...defaultParams, ...params}
      const contentAreaNode = utils.getContentAreaNode(router.currentRoute.name)
      if (contentAreaNode) {
        contentAreaNode.scroll({
          top: 0,
          left: 0,
          behavior: params.behavior
        })
      }
    },
    SET_SHORTCUT ({ state, commit, dispatch, getters }, payload) {
      const {
        shortcutName,
        shortcut
      } = payload

      function setGlobalShortcut (shortcut) {
        return new Promise((resolve, reject) => {
          // Update global shortcut and set it to tray
          electron.ipcRenderer.send('set-global-shortcut', {
            name: shortcutName,
            shortcut: shortcut,
            previousShortcut: state.storageData.settings.shortcuts[shortcutName].shortcut
          })
          electron.ipcRenderer.once('set-global-shortcut-reply', (event, data) => {
            resolve(data.success)
          })
        })
      }

      setGlobalShortcut(shortcut)
        .then(() => {
          dispatch('SET', {
            key: `storageData.settings.shortcuts.${shortcutName}.shortcut`,
            value: shortcut
          })
            .then(() => {
              eventHub.$emit('notification', {
                action: 'update-by-type',
                type: 'set-new-shortcut',
                closeButton: true,
                timeout: 3000,
                title: 'Shortcut was set',
                message: shortcut
              })
            })
        })
        .catch((error) => {
          eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'set-new-shortcut',
            closeButton: true,
            timeout: 3000,
            title: 'Failed to set new shortcut',
            message: `${shortcut}<br>Error: ${error}`
          })
        })
    },
    SET_SHORTCUT_KEYDOWN_HANDLER ({ state, commit, dispatch, getters }, payload) {
      const {
        event,
        shortcut,
        shortcutName
      } = payload
      event.preventDefault()
      let data = state.dialogs.shortcutEditorDialog.data

      // Handle "Enter" key event
      const someModifierIsPressed =
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey
      if (event.code === 'Enter' && !someModifierIsPressed) {
        document.activeElement.blur()
        return
      }

      // Define allowed keys
      const keyIsAlphaNum = (event.keyCode >= 48 && event.keyCode <= 90)
      const keyIsBetweenF1andF12 = (event.keyCode >= 112 && event.keyCode <= 123)
      const allowedChars = [
        'Backquote', 'Space', 'Enter', 'Minus', 'Plus', 'Equal', 'Backspace',
        'Escape', 'PageUp', 'PageDown', 'Home', 'End', 'Delete',
        'Tab', 'BracketLeft', 'BracketRight', 'Semicolon',
        'Quote', 'Comma', 'Period', 'Slash', 'Backslash'
      ]

      // Reset data
      data.modifiers = []

      // Set data
      if (event.altKey) { data.modifiers.push('Alt') }
      if (event.ctrlKey) { data.modifiers.push('Ctrl') }
      if (event.shiftKey) { data.modifiers.push('Shift') }
      if (event.metaKey) { data.modifiers.push('Meta') }
      if (keyIsAlphaNum || keyIsBetweenF1andF12 || allowedChars.includes(event.code)) {
        data.key = event.code
          .replace(/\s/g, '')
          .replace('Key', '')
          .replace('Digit', '')
          .replace(/Backquote/g, '~')
          .replace(/Minus/g, '-')
          .replace(/Plus/g, '+')
          .replace(/Equal/g, '=')
          .replace(/BracketLeft/g, '[')
          .replace(/BracketRight/g, ']')
          .replace(/Semicolon/g, ';')
          .replace(/Quote/g, '\'')
          .replace(/Comma/g, ',')
          .replace(/Period/g, '.')
          .replace(/Slash/g, '/')
          .replace(/Backslash/g, '\\')
      }

      const formattedModifiers = data.modifiers.length === 0 && data.key.length === 0
        ? 'Click here & press desired key combination'
        : data.modifiers.join('+')

      const formattedToReadable = data.modifiers.length === 0
        ? `${formattedModifiers}`
        : `${formattedModifiers}+${keyIsAlphaNum || keyIsBetweenF1andF12 ? data.key.toUpperCase() : data.key}`

      data.shortcut = formattedToReadable.replace(/\+/g, ' + ')
      data.rawShortcut = formattedToReadable

      if (data.modifiers.length === 0) {
        data.isValid = false
        data.error = 'Shorcut should include at least 1 modifier: [Alt, Ctrl, Shit, Meta]'
      }
      else if (data.key.length === 0) {
        data.isValid = false
        data.error = 'Shorcut should include at least 1 key'
      }
      else {
        data.isValid = true
        data.error = ''
      }
      // TODO:
      // Check if shortcut is already registered
      // data.error = '${amount} existing commands has this keybinding'
    },
    RESET_SHORTCUT ({ state, commit, dispatch, getters }, shortcutName) {
      const initialShortcut = state.defaultData.storageData.settings.shortcuts[shortcutName].shortcut
      dispatch('SET_SHORTCUT', { shortcutName, shortcut: initialShortcut })
    },
    OPEN_SELECTED_IN_TERMINAL ({ state, commit, dispatch, getters }, payload) {
      const selectedDirItems = getters.selectedDirItems
      commit('OPEN_SELECTED_IN_TERMINAL', { selectedDirItems, asAdmin: payload.asAdmin })
    },
    async SWITCH_TAB ({ state, commit, dispatch, getters }, id) {
      const tabItem = getters.selectedWorkspace.tabs[id - 1]
      if (!tabItem) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'switchTab',
          icon: 'mdi-tab',
          timeout: 2000,
          title: 'No tab',
          message: `Current workspace doesn't have tab "#${id}"`
        })
      }
      else {
        // TODO: load the item's realPath instead
        // For that it either should store both path and realPath in the tab object
        // or the LOAD_DIR action should check if the path is a symlink and
        // if so, load the realPath instead
        await dispatch('LOAD_DIR', { path: tabItem.path })
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'switchTab',
          icon: 'mdi-tab',
          timeout: 1500,
          title: `Tab | ${tabItem.name}`,
          message: `Path: ${tabItem.path}`
        })
      }
    },
    async SWITCH_WORKSPACE ({ state, commit, dispatch, getters }, specifiedWorkspace) {
      commit('SELECT_WORKSPACE', specifiedWorkspace)
      dispatch('SYNC_WORKSPACE_STORAGE_DATA')
      await dispatch('LOAD_DIR', { path: specifiedWorkspace.defaultPath })
      specifiedWorkspace.lastOpenedDir = specifiedWorkspace.defaultPath
      router.push('navigator').catch((error) => {})
      // Push workspace actions notification
      const specifiedWorkspaceParsed = PATH.parse(specifiedWorkspace.defaultPath)
      if (specifiedWorkspace.isPrimary) {
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'switchWorkspace',
          icon: 'mdi-vector-arrange-below',
          timeout: 1500,
          title: `Workspace | Primary`,
          message: `Drive: ${specifiedWorkspaceParsed.dir}`
        })
      }
      else if (!specifiedWorkspace.isPrimary) {
        let actions = ''
        specifiedWorkspace.actions.forEach(action => actions += `${action}<br>`)
        let actionButtons = []
        if (specifiedWorkspace.actions.length > 0) {
          actionButtons = [
            {
              title: 'run actions',
              onClick: () => {
                dispatch('RUN_WORKSPACE_ACTIONS')
              },
              closesNotification: true
            },
            // TODO: finish in v1.2.0
            // {
            //   title: 'modify & run actions',
            //   onClick: () => {
            //     dispatch('MODIFY_AND_RUN_WORKSPACE_ACTIONS')
            //   },
            //   closesNotification: true
            // }
          ]
        }
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'switchWorkspace',
          icon: 'mdi-vector-arrange-below',
          timeout: 8000,
          closeButton: true,
          actionButtons: actionButtons,
          title: `Workspace | ${specifiedWorkspace.name}`,
          message: `Drive: ${specifiedWorkspaceParsed.dir}`
        })
      }
    },
    RUN_WORKSPACE_ACTIONS ({ state, commit, dispatch, getters }) {
      getters.selectedWorkspace.actions.forEach(action => {
        if (action.type.name === 'open-url') {
          if (!action.command.startsWith('http')) {
            action.command = `http://${action.command}`
          }
          utils.openLink(action.command)
        }
      })
    },
    CANCEL_FETCH_CURRENT_DIR_SIZE (store, payload = {}) {
      store.dispatch('CANCEL_FETCH_DIR_SIZE', store.state.navigatorView.selectedDirItems.getLast())
    },
    FETCH_CURRENT_DIR_SIZE (store, payload = {}) {
      store.dispatch('FETCH_DIR_SIZE', {
        item: store.state.navigatorView.selectedDirItems.getLast(),
        options: payload.options || {}
      })
    },
    CANCEL_FETCH_DIR_SIZE (store, item) {
      const task = store.state.tasks.find(taskItem => taskItem.props.item.path === item.path)
      if (task) {
        store.dispatch('SET_DIRECTORY_SIZE', {
          item: task.props.item,
          size: null
        })
        store.dispatch('REMOVE_TASK', task)
        try {store.state.childProcesses.directorySize.kill()}
        catch (error) {}
      }
    },
    TERMINATE_ALL_FETCH_DIR_SIZE (store) {
      try {
        store.state.navigatorView.dirItems.forEach(item => {
          store.dispatch('CANCEL_FETCH_DIR_SIZE', item)
        })
        store.state.childProcesses.directorySize.kill()
      }
      catch (error) {}
    },
    FETCH_DIR_SIZE (store, payload) {
      const taskHashID = utils.getHash()
      store.dispatch('ADD_TASK', {
        name: 'process::dir-size',
        hashID: taskHashID,
        props: {
          item: payload.item,
          options: payload.options,
          timeoutObject: null
        }
      })
        .then((task) => {
          store.dispatch('SET_DIRECTORY_SIZE', {
            item: task.props.item,
            size: store.state.placeholders.calculatingDirSize
          })
          store.dispatch('INIT_DIR_SIZE_PROCESS', task)
            .then((data) => {
              store.dispatch('SET_DIRECTORY_SIZE', {
                item: task.props.item,
                size: data.size
              })
              store.dispatch('REMOVE_TASK', task)
            })
        })
    },
    INIT_DIR_SIZE_PROCESS (store, task) {
      return new Promise((resolve, reject) => {
        try {store.state.childProcesses.directorySize.kill()}
        catch (error) {}
        // Schedule task cancelling, if needed
        clearTimeout(task.props.timeoutObject)
        if (task.props.options.timeout) {
          task.props.timeoutObject = setTimeout(() => {
            try {store.state.childProcesses.directorySize.kill()}
            catch (error) {}
            resolve({size: null})
          }, task.props.options.timeout)
        }
        store.state.childProcesses.directorySize = childProcess.fork(
          PATH.resolve('./src/processes/directorySizeProcess.js'),
          { silent: true }
        )
        store.state.childProcesses.directorySize.on('message', data => {
          clearTimeout(task.props.timeoutObject)
          // Delay setting data to avoid the unpleasant flash when
          // placeholder is removed almost immidiatelly after being set
          setTimeout(() => {
            resolve(data)
          }, 200)
        })
        store.state.childProcesses.directorySize.send({item: task.props.item})
      })
    },
    OPEN_WITH_QUICK_VIEW ({ state, commit, dispatch, getters }, payload) {
      let defaultPayload = {
        path: state.navigatorView.selectedDirItems.getLast().path
      }
      payload = {...defaultPayload, ...payload}

      if (getters.dirItemsSelectionStats.fileCount > 0) {
        electron.ipcRenderer.send('quick-view::open-file', payload.path)
      }
    }
  }
})

function getDirItemsFromSavedList (params) {
  return [...params.items].filter(item => {
    return params.list.some(listItem => {
      return listItem.path === item.path
    })
  })
}
