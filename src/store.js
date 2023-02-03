// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

/* eslint-disable */
import Vue from 'vue'
import Vuex from 'vuex'
import { createNewSortInstance } from 'fast-sort'
import router from './router.js'
import {i18n} from './localization'
import { languages, getLanguage } from './localization/data'
import utils from './utils/utils'
import TimeUtils from './utils/timeUtils.js'
import * as fsManager from './utils/fsManager'
import { getField, updateField } from 'vuex-map-fields'
import {readFile, readFileSync, writeFile, writeFileSync} from 'atomically'
import * as notifications from './utils/notifications.js'
import MediaInfoWorker from 'worker-loader!./workers/mediaInfoWorker.js'

const electron = require('electron')
const electronRemote = require('@electron/remote')
const fsExtra = require('fs-extra')
const sharedUtils = require('./utils/sharedUtils')
const eventHub = require('./utils/eventHub').eventHub
const fsCore = require('./utils/fsCore.js')
const os = require('os')
const fs = require('fs')
const PATH = require('path')
const childProcess = require('child_process')
const node7z = require('node-7z')
const externalLinks = require('./utils/externalLinks')
const SigmaAppUpdater = require('./utils/sigmaAppUpdater.js')
const getSystemRulesForPaths = require('./utils/systemRules').paths
const systemRulesForPaths = getSystemRulesForPaths()
const ColorUtils = require('./utils/colorUtils.js')
const appDataPaths = require('./appPaths.js')
const supportedFormats = require('./utils/supportedFormats.js')
const windowTransparencyEffectData = require('./data/windowTransparencyEffectData.js')

const appPaths = {
  ...externalLinks,
  ...appDataPaths,
  public: __static,
  fileProtocol: 'sigma-file-manager',
  updateDownloadDir: appDataPaths.downloads,
  homeBannerMediaData: require('./data/homeBannerMediaData.js'),
  shortcuts: require('./shortcuts.js').default,
  globalSearchDataFiles: []
}

// Init class instances
let storageThrottle = new TimeUtils()
let loadDirThrottle = new TimeUtils()
let routeScrollEventThrottle = new TimeUtils()
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
    supportedFormats: supportedFormats.formats,
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
      oneDriveWatcherWorker: null,
      mediaInfoWorker: null,
    },
    childProcesses: {
      localDirectoryShareServer: null,
      localFileShareServer: null,
      directorySize: null,
      getItemsSize: null,
    },
    throttles: {
      windowResizeHandler: null
    },
    eventListeners: {
      scroll: {
        home: null,
        navigator: null,
        dashboard: null,
        notes: null,
        settings: null,
      }
    },
    placeholders: {
      calculatingDirSize: 'Calculating...'
    },
    tasks: [],
    scheduler: {
      storageOperations: [],
    },
    windows: {
      main: {
        state: {
          isMaximized: false
        }
      }
    },
    notifications: [],
    drives: [],
    drivesPreviousData: [],
    storageDevicesData: {
      oneDrive: []
    },
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
        includeRecent: true,
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
              title: 'filter.prefixes.itemName',
              prefix: 'name:',
              property: 'name',
            },
            {
              name: 'itemCount',
              title: 'filter.prefixes.directoryItemCount',
              prefix: 'items:',
              property: 'dirItemCount',
            },
            {
              name: 'fileSize',
              title: 'filter.prefixes.fileSize',
              prefix: 'size:',
              property: 'stat.size',
              isDeepProperty: true,
              processing: (propertyValue) => {
                return utils.prettyBytes(propertyValue, 1)
              }
            },
            {
              name: 'dateMetaModified',
              title: 'filter.prefixes.dateMetaModified',
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
              title: 'filter.prefixes.noteTitle',
              prefix: 'title:',
              property: 'title',
            },
            {
              name: 'content',
              title: 'filter.prefixes.noteContent',
              prefix: 'content:',
              property: 'content',
            },
            {
              name: 'group',
              title: 'filter.prefixes.noteGroup',
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
              title: 'filter.prefixes.itemPath',
              prefix: 'path:',
              property: 'path',
            }
          ]
        },
        settings: {
          query: '',
          options: {
            glob: false
          },
          filterProperties: [
            {
              name: 'tags',
              title: 'filter.prefixes.settingTags',
              prefix: 'tags:',
              property: 'tags',
            },
          ]
        }
      }
    },
    settingsView: {
      settingsDataMap: []
    },
    navigatorView: {
      info: {},
      scrollPosition: 0,
      visibleDirItems: [],
      dirItemsTasks: [],
      dirItemsInfoIsFetched: false,
      dirItemsInfoIsPartiallyFetched: false,
      timeSinceLoadDirItems: 0,
      currentDir: {},
      dirItems: [],
      filteredDirItems: [],
      selectedDirItems: [],
      previouslySelectedDirItems: [],
      history: {
        currentIndex: 0,
        items: [],
        itemsRaw: [],
      },
      clipboard: {
        isGettingSize: false,
        clipboardItemSize: 0,
        fs: {
          type: '',
          items: []
        }
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
        items: [
          {
            id: 0,
            isPrimary: true,
            isSelected: true,
            name: 'Primary',
            activeTabIndex: 0,
            lastOpenedDir: appPaths.userDataRoot,
            defaultPath: appPaths.userDataRoot,
            tabs: [],
            actions: [],
            panes: {
              items: [
                {
                  row: 1,
                  column: 1,
                  isSelected: true,
                  width: '1fr',
                  type: 'navigator',
                  currentDir: ''
                }
              ]  
            },
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
        text: {
          font: 'Roboto-regular',
          fonts: []
        },
        dateTime: {
          month: 'short',
          regionalFormat: {code: 'en', name: 'English'},
          autoDetectRegionalFormat: true,
          hour12: false,
          properties: {
            showSeconds: false,
            showMilliseconds: false,
          }
        },
        lastRecordedAppVersion: null,
        routeScrollPosition: {
          home: 0,
          navigator: 0,
          dashboard: 0,
          notes: 0,
          settings: 0,
        },
        useHighPerformanceGpu: false,
        firstTimeActions: {
          appLaunch: true,
          localShare: true,
        },
        appPaths,
        navigator: {
          showDirItemKindDividers: true,
          showHiddenDirItems: false,
          openDirItemWithSingleClick: false,
          openDirItemSecondClickDelay: 500,
          nameColumnMaxWidth: '50%',
          sorting: {
            elementDisplayType: 'toolbar'
          },
          workspaces: {
            showTitleInToolbar: false
          },
          tabs: {
            closeAppWindowWhenLastWorkspaceTabIsClosed: false,
            showTabPreview: true,
            showTabStorageIndicator: true,
            tabWidth: 100,
            tabBehavior: 'immutable',
            tabBehaviorList: ['immutable', 'traditional'],
            layout: 'compact-vertical-and-traditional-horizontal',
            layoutVariants: [
              'compact-vertical',
              'compact-vertical-and-traditional-horizontal',
            ]  
          },
          historyNavigationStyle: {
            selected: 'sigma-default',
            list: [
              'sigma-default',
              'traditional',
            ]
          }
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
          autoDownload: false,
          autoInstall: false,
        },
        globalSearch: {
          disallowedPaths: ['C:/Windows', '**/node_modules/**'],
          disallowedPathsItems: ['C:/Windows', '**/node_modules/**'],
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
        globalSearchIsEnabled: false,
        compressSearchData: true,
        windowCloseButtonAction: 'minimizeAppToTray',
        stats: {
          storeDirItemOpenEvent: true,
          storeDirItemOpenCount: true,
          storeDirItemOpenDate: true,
        },
        UIZoomLevel: 1,
        windowTransparencyEffect: {
          value: true,
          lessProminentOnHomePage: true,
          previewEffect: true,
          sameSettingsOnAllPages: true,
          data: windowTransparencyEffectData,
          options: {
            selectedPage: {
              title: 'Global settings',
              name: '',
              icon: 'mdi-infinity',
              blur: 36,
              opacity: 10,
              parallaxDistance: 5,
              background: windowTransparencyEffectData.background.selected,
            },
            pages: [
              {
                title: 'Global settings',
                name: '',
                icon: 'mdi-infinity',
                blur: 36,
                opacity: 10,
                parallaxDistance: 5,
                background: windowTransparencyEffectData.background.selected,
              },
              {
                title: 'Home page',
                name: 'home',
                icon: 'mdi-apps',
                blur: 36,
                opacity: 10,
                parallaxDistance: 5,
                background: windowTransparencyEffectData.background.selected,
              },
              {
                title: 'Navigator page',
                name: 'navigator',
                icon: 'mdi-folder-outline',
                blur: 36,
                opacity: 10,
                parallaxDistance: 5,
                background: windowTransparencyEffectData.background.selected,
              },
              {
                title: 'Dashboard page',
                name: 'dashboard',
                icon: 'mdi-bookmark-multiple-outline',
                blur: 36,
                opacity: 10,
                parallaxDistance: 5,
                background: windowTransparencyEffectData.background.selected,
              },
              {
                title: 'Notes page',
                name: 'notes',
                icon: 'mdi-square-edit-outline',
                blur: 36,
                opacity: 10,
                parallaxDistance: 5,
                background: windowTransparencyEffectData.background.selected,
              },
              {
                title: 'Settings page',
                name: 'settings',
                icon: 'mdi-cog-outline',
                blur: 36,
                opacity: 10,
                parallaxDistance: 5,
                background: windowTransparencyEffectData.background.selected,
              }
            ]
          }
        },
        visualEffects: {
          homeBannerMediaGlowEffect: {
            value: true
          },
        },
        overlays: {
          navPanelDriveLetterOverlay: {
            value: false
          }
        },
        animations: {
          onRouteChangeMediaBannerIn: true
        },
        input: {
          pointerButtons: {
            button3: {
              onMouseUpEvent: {
                title: 'Navigator: open previous directory in history',
                action: 'LOAD_PREVIOUS_HISTORY_PATH'
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
                title: 'Navigator: open next directory in history',
                action: 'LOAD_NEXT_HISTORY_PATH'
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
        dirItemBackground: 'minimal',
        itemCardDesign: 'neoinfusive-flat-glow',
        autoCalculateDirSize: false,
        lastOpenedSettingsTab: 0,
        groupDirItems: false,
        focusFilterOnTyping: true,
        focusFilterOnDirectoryChange: false,
        markdownShortcuts: true,
        spellcheck: true,
        focusMainWindowOnDriveConnected: true,
        showUserNameOnUserHomeDir: true,
        shortcuts: appPaths.shortcuts,
        localization: {
          selectedLanguage: getLanguage('en'),
          languages
        },
        driveCard: {
          progressType: 'linearVertical',
          showProgress: true
        },
        dashboard: {
          selectedTab: null,
          tabs: {
            pinned: {
              title: 'pinnedItemsShort',
              show: true,
              icon: 'mdi-pin-outline'
            },
            protected: {
              title: 'protectedItemsShort',
              show: true,
              icon: 'mdi-shield-check-outline'
            },
            timeline: {
              title: 'timeline',
              show: true,
              icon: 'mdi-timeline-clock-outline'
            }
          }
        },
        infoPanels: {
          navigatorView: {
            value: true,
            data: {
              properties: []
            }
          }
        },
        visualFilters: {
          applyFiltersToMediaElements: false,
          contrast: {
            value: '1',
            min: '1',
            max: '1.2',
          },
          brightness: {
            value: '1',
            min: '1',
            max: '1.2',
          },
          saturation: {
            value: '1',
            min: '0',
            max: '2',
          },
        },
        theme: {
          type: 'dark',
          transparentToolbars: false,
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
        sorting: {
          saveNavigatorSorting: false,
          order: 'ascending',
          selectedType: {
            name: 'name',
            title: 'sorting.typeTitles.name',
            shortTitle: 'sorting.typeShortTitles.name',
            width: 'minmax(64px, 2fr)',
            isChecked: true,
          },
          types: [
            {
              name: 'name',
              title: 'sorting.typeTitles.name',
              shortTitle: 'sorting.typeShortTitles.name',
              width: 'minmax(64px, 2fr)',
              isChecked: true,
            },
            {
              name: 'date-modified-contents',
              title: 'sorting.typeTitles.dateModifiedContents',
              shortTitle: 'sorting.typeShortTitles.dateModifiedContents',
              width: 'minmax(64px, 1.6fr)',
              isChecked: true,
            },
            {
              name: 'date-modified-meta',
              title: 'sorting.typeTitles.dateModifiedMeta',
              shortTitle: 'sorting.typeShortTitles.dateModifiedMeta',
              width: 'minmax(64px, 1.6fr)',
              isChecked: false,
            },
            {
              name: 'date-created',
              title: 'sorting.typeTitles.dateCreated',
              shortTitle: 'sorting.typeShortTitles.dateCreated',
              width: 'minmax(64px, 1.6fr)',
              isChecked: false,
            },
            {
              name: 'size',
              title: 'sorting.typeTitles.itemsSize',
              shortTitle: 'sorting.typeShortTitles.itemsSize',
              width: 'minmax(64px, 0.8fr)',
              isChecked: true,
            },
            // TODO: finish in v1.2.0
            // Should request to turn on the 'storeDirItemOpenCount'
            // {
            //   name: 'popularity',
            //   title: 'popularity',
            //   shortTitle: 'popularity',
            //   width: 'minmax(64px, 1fr)',
            //   isChecked: false,
            // },
            {
              name: 'status',
              title: 'sorting.typeTitles.status',
              shortTitle: 'sorting.typeShortTitles.status',
              width: '64px',
              isChecked: true,
            },
          ]
        },
      }
    },
    navigationPanel: {
      model: false,
      miniVariant: true,
      items: [
        {
          icon: 'mdi-apps',
          title: 'pages.home',
          to: '/'
        },
        {
          icon: 'mdi-folder-outline',
          title: 'pages.navigator',
          to: '/navigator'
        },
        {
          // icon: 'mdi-bookmark-outline',
          icon: 'mdi-bookmark-multiple-outline',
          // icon: 'mdi-account-circle-outline',
          title: 'pages.dashboard',
          to: '/dashboard'
        },
        {
          icon: 'mdi-square-edit-outline',
          title: 'pages.notes',
          to: '/notes'
        },
        {
          icon: 'mdi-cog-outline',
          title: 'pages.settings',
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
        targetData: {},
        targetType: 'dirItem',
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
        lastMousedownEvent: {},
        lastMousedownMoveEvent: {
          clientX: 0,
          clientY: 0,
        }
      },
      drag: {
        type: '', // String(''|local|inbound|outbound)
        targetType: '', // String(''|existing-path|url|html|text)
        dirItems: [],
        dropTargetItems: [],
        moveActivationTreshold: 16,
        moveActivationTresholdReached: false,
        isStarted: false,
        isInsideWindow: false,
        startedInsideWindow: false,
        overlappedDropTargetItem: {
          path: ''
        },
      }
    },
    overlays: {
      inboundDrag: false,
      dirItemDrag: false
    },
    localServer: {
      directoryShare: {
        ip: '',
        port: '',
        address: '',
        item: {}
      },
      fileShare: {
        ip: '',
        port: '',
        address: '',
        type: 'stream',
        item: {}
      }
    },
    dialogsDefaultData: {},
    dialogs: {
      errorDialog: {
        value: false,
        data: {}
      },
      confirmationDialog: {
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
      appGuideDialog: {
        value: false,
        data: {
          guideTabsSelected: 0,
          guideTabs: [
            {name: 'shortcuts', icon: 'mdi-pound', text: 'dialogs.appGuideDialog.nav.shortcuts'},
            {name: 'introduction', icon: 'mdi-human-greeting-variant', text: 'dialogs.appGuideDialog.nav.introduction'},
            {name: 'feature-overview', icon: 'mdi-list-box-outline', text: 'dialogs.appGuideDialog.nav.featureOverview'},
            {name: 'media-downloading', icon: 'mdi-download', text: 'dialogs.appGuideDialog.nav.mediaDownloading'},
            {name: 'navigator-tips', icon: 'mdi-folder-outline', text: 'dialogs.appGuideDialog.nav.navigatorTips'},
            {name: 'data-protection', icon: 'mdi-lock-outline', text: 'dialogs.appGuideDialog.nav.dataProtection'},
            {name: 'address-bar', icon: 'mdi-form-textbox', text: 'dialogs.appGuideDialog.nav.addressBar'},
            {name: 'coming-soon', text: 'dialogs.appGuideDialog.nav.comingSoon'},
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
      archiveAdd: {
        value: false,
        data: {
          isValid: true,
          error: '',
          selectedFormat: 'zip',
          formats: supportedFormats.formats.fileType.archivePack,
          setPassword: false,
          compression: {
            title: 'Normal',
            value: 'x=5'
          },
          compressionOptions: [
            {
              title: 'No compression',
              value: 'x=0'
            },
            {
              title: 'Fastest',
              value: 'x=1'
            },
            {
              title: 'Fast',
              value: 'x=3'
            },
            {
              title: 'Normal',
              value: 'x=5'
            },
            {
              title: 'Maximum',
              value: 'x=7'
            },
            {
              title: 'Ultra',
              value: 'x=9'
            },
          ],
          options: {
            deleteFilesAfter: false,
            password: '',
            method: []
          },
          dest: {
            name: '',
            dir: '',
            path: ''
          }
        }
      },
      archiveExtract: {
        value: false,
        data: {
          isValid: true,
          error: '',
          isGettingStats: false,
          isEncrypted: false,
          password: '',
          destPath: '',
          archiveData: {
            physicalSize: {
              title: 'Physical Size',
              value: '',
              readableValue: '',
            },
            size: {
              title: 'Size',
              value: '',
              readableValue: '',
            },
            packedSize: {
              title: 'Packed Size',
              value: '',
              readableValue: '',
            },
            encrypted: {
              title: 'Encrypted',
              value: '',
              readableValue: '',
            },
            method: {
              title: 'Method',
              value: '',
              readableValue: '',
            },
            characteristics: {
              title: 'Characteristics',
              value: '',
              readableValue: '',
            },
          },
          dest: {
            name: '',
            dir: '',
            path: ''
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
      userDirectoryEditorDialog: {
        value: false,
        dataIsValid: true,
        initialData: {},
        data: {}
      },
      workspaceEditorDialog: {
        value: false,
        workspaceItems: [],
        selectedWorkspace: {},
        selectedWorkspaceAction: {
          type: {
            name: ''
          }
        },
        workspaceTemplate: {
          id: null,
          isPrimary: false,
          isSelected: false,
          name: '',
          activeTabIndex: 0,
          lastOpenedDir: appPaths.userDataRoot,
          defaultPath: appPaths.userDataRoot,
          tabs: [],
          actions: [],
          panes: {
            layout: [
              {
                row: 1,
                column: 1,
                isSelected: true,
                width: '1fr',
                type: 'navigator'
              }
            ]  
          },
        },
        workspaceActionTemplate: {
          id: null,
          name: '',
          type: {
            name: 'open-url',
            icon: 'mdi-web',
            example: 'https://artstation.com/search?query=landscape'
          },
          command: ''
        },
        workspaceActionTypes: [
          {
            name: 'open-url',
            icon: 'mdi-web',
            example: 'https://artstation.com/search?query=landscape'
          },
          {
            name: 'open-path',
            icon: 'mdi-link-variant',
            example: 'code C:/test/README.md'
          },
          {
            name: 'terminal-command',
            icon: 'mdi-console',
            example: `powershell -command "Start-Process cmd ' /s /k pushd \\"C:/projects/app/\\" && npm run dev'"`,
            options: {
              asAdmin: false
            }
          }
        ],
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
      downloadTypeSelectorDialog: {
        value: false,
        data: {
          fadeMaskBottom: '0%',
          downloadFileButton: () => { },
          downloadImageButton: () => { },
        }
      },
      externalDownloadDialog: {
        value: false,
        data: {
          url: '',
          directory: '',
          video: {
            selectedType: {name: 'videoWithAudio', title: 'dialogs.externalDownloadDialog.videoWithAudio'},
            types: [
              {name: 'videoWithAudio', title: 'dialogs.externalDownloadDialog.videoWithAudio'},
              {name: 'videoOnly', title: 'dialogs.externalDownloadDialog.videoOnly'},
              {name: 'audioOnly', title: 'dialogs.externalDownloadDialog.audioOnly'}
            ],
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
    sortingHeaderGridColumnTemplate: state => {
      let menuIconWidth = '48px'
      let gridColumnTemplate = state.storageData.settings.sorting.types
        .filter(item => item.isChecked)
        .map(item => item.width)
      gridColumnTemplate.unshift(menuIconWidth)
      return gridColumnTemplate
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
      return state.navigatorView.selectedDirItems.at(-1)
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
        if (node.dataset.itemPath === state.navigatorView.selectedDirItems.at(-1).path) {
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
            const rowContainsItem = item.dirItemPositionIndex === state.navigatorView.selectedDirItems.at(-1).dirItemPositionIndex
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
    selectedDirItemsStats: (state, getters) => {
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
    UPDATE_NAVIGATOR_HISTORY (state, options) {
      let historyItems = state.navigatorView.history.items
      let historyItemsRaw = state.navigatorView.history.itemsRaw
      let lastHistoryElement = historyItems[historyItems.length - 1]
      let pathMatchesLastHistoryPath = lastHistoryElement === options.path
      // Add path to "raw" list
      historyItemsRaw.push(options.path)
      // Add path to "no-consecutive-dups" list
      if (!pathMatchesLastHistoryPath) {
        if (state.storageData.settings.navigator.historyNavigationStyle.selected === 'sigma-default') {
          if (options.goForwardInHistory) {return}
          else if (options.goBackwardInHistory) {
            historyItems.push(options.path)
          }
          else {
            historyItems.push(options.path)
            state.navigatorView.history.currentIndex = historyItems.length - 1
          }
        }
        if (state.storageData.settings.navigator.historyNavigationStyle.selected === 'traditional') {
          if (options.goForwardInHistory) {return}
          else if (options.goBackwardInHistory) {return}
          else {
            historyItems.splice(state.navigatorView.history.currentIndex + 1, historyItems.length - 1)
            historyItems.push(options.path)
            state.navigatorView.history.currentIndex = historyItems.length - 1
          }
        }
      }
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
    SORT_DIR_ITEMS (state) {
      const order = state.storageData.settings.sorting.order
      const sortingType = state.storageData.settings.sorting.selectedType

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
      else if (sortingType.name === 'date-modified-contents') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => Math.round(dirItem.stat.mtimeMs))
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => Math.round(dirItem.stat.mtimeMs))
      }
      else if (sortingType.name === 'date-modified-meta') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => Math.round(dirItem.stat.ctimeMs))
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => Math.round(dirItem.stat.ctimeMs))
      }
      else if (sortingType.name === 'date-created') {
        state.navigatorView.dirItems = order === 'ascending'
          ? naturalSort(state.navigatorView.dirItems).asc(dirItem => Math.round(dirItem.stat.birthtimeMs))
          : naturalSort(state.navigatorView.dirItems).desc(dirItem => Math.round(dirItem.stat.birthtimeMs))
      }
    },
    HIGHLIGHT_DIR_ITEM_RANGE (state, payload) {
      let startRangeIndex = state.navigatorView.selectedDirItems.at(-1).dirItemPositionIndex
      let endRangeIndex = payload.hoveredItem.dirItemPositionIndex
      // Swap indexes, if needed
      if (startRangeIndex > endRangeIndex) {
        [startRangeIndex, endRangeIndex] = [endRangeIndex, startRangeIndex]
      }
      // Highlight items
      state.navigatorView.filteredDirItems.forEach(item => {
        if (startRangeIndex <= item.dirItemPositionIndex && item.dirItemPositionIndex <= endRangeIndex) {
          item.isHighlighted = true
        }
      })
    },
    DEHIGHLIGHT_ALL_DIR_ITEMS (state) {
      state.navigatorView?.filteredDirItems?.forEach(item => {
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
      const path = state.navigatorView.selectedDirItems.at(-1).path
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
        const filePath = `${state.storageData.settings.appPaths.storageDirectories.appStorage}/${fileName}`
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
      const filePath = `${state.storageData.settings.appPaths.storageDirectories.appStorage}/${fileName}`
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
      const filePath = `${state.storageData.settings.appPaths.storageDirectories.appStorage}/${payload.fileName}`
      const defaultData = {}
      try {
        const formattedData = JSON.stringify(defaultData, null, 2)
        await writeFile(filePath, formattedData, { fsyncWait: false, encoding: 'utf8' })
      }
      catch (error) {
        throw Error(error)
      }
    },
    async deleteKeyFromStorageFile ({state}, params) {
      const filePath = `${state.storageData.settings.appPaths.storageDirectories.appStorage}/${params.fileName}`
      try {
        delete params.data[params.key]
        const formattedData = JSON.stringify(params.data, null, 2)
        await writeFile(filePath, formattedData, {fsyncWait: false, encoding: 'utf8'})
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
    async changeLanguage ({dispatch}, language) {
      i18n.locale = language.locale
      dispatch('SET', {
        key: 'storageData.settings.localization.selectedLanguage',
        value: language,
      })  
    },
    async resetAppSettings (store) {
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
        const appStorageDir = store.state.storageData.settings.appPaths.storageDirectories.appStorage
        const appStorageFileName = payload.fileName
        const normalizedPath = PATH.normalize(`${appStorageDir}/${appStorageFileName}`)
        await fs.promises.access(normalizedPath, fs.constants.F_OK)
        let item = await store.dispatch('GET_DIR_ITEM_INFO', normalizedPath)
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
        throw new Error('ADD_TASK: property task.name is required')
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
          if (typeof path === 'string') {
            let item = await dispatch('GET_DIR_ITEM_INFO', path)
            newItems.push(item)
          }
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
          let itemObjectData = await dispatch('GET_DIR_ITEM_INFO', item.path)
          newItems.push({...item, ...itemObjectData})
        }
      }
      return newItems
    },
    /**
    * @param {object} payload
    * @param {array<object>} payload.items
    */
    async ENSURE_ALL_ITEMS_DATA_OBJECTS (store, items) {
      if (items.some(item => typeof item === 'string')) {
        return await store.dispatch('CONVERT_PATHS_TO_DATA_OBJECTS', {items})
      }      
      else {
        return items
      }
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
    async homePageBackgroundDrop ({ state, dispatch }, event) {
      // TODO: use universal downloaing / copy method instead
      await processItems()

      async function copyFileToAppStorage (file) {
        const destination = PATH.join(state.storageData.settings.appPaths.storageDirectories.appStorageHomeBannerMedia, file.name)
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
        //   cwd: state.storageData.settings.appPaths.binFFMPEG,
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
        //           dispatch('loadDir', { path: payload.directory })
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
              notificationData.message = status.isCanceled ? undefined : error
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
    routeOnActivated ({dispatch}, routeName) {
      dispatch('restoreRouteScrollPosition', routeName)
    },
    routeOnMounted ({dispatch}, routeName) {
      dispatch('restoreRouteScrollPosition', routeName)
      dispatch('initScrollListener', routeName)
    },
    restoreRouteScrollPosition  ({state}, routeName) {
      const historyItems = state.navigatorView.history.items
      const secondFromEndHistoryPath = historyItems[historyItems.length - 2]
      const returnedBackToSameNavigatorDir = routeName === 'navigator' &&
        (
          secondFromEndHistoryPath === state.navigatorView.currentDir.path ||
          secondFromEndHistoryPath === undefined
        )
      const shouldRestoreScroll = routeName !== 'navigator' || returnedBackToSameNavigatorDir

      if (shouldRestoreScroll) {
        const scrollContainerElement = utils.getContentAreaNode(routeName)
        const savedScrollPosition = state.storageData.settings.routeScrollPosition[routeName]
        if (savedScrollPosition) {
          scrollContainerElement.scroll({
            top: savedScrollPosition,
            behavior: 'auto'
          })
        }
      }
    },
    saveRouteScrollPosition  ({state, dispatch}, params) {
      state.storageData.settings.routeScrollPosition[params.routeName] = params.scrollPosition
      dispatch('SET', {
        key: 'storageData.settings.routeScrollPosition',
        value: state.storageData.settings.routeScrollPosition
      })
    },
    initScrollListener ({state, dispatch}, routeName) {
      const scrollContainerElement = utils.getContentAreaNode(routeName)
      if (scrollContainerElement) {
        state.eventListeners.scroll[routeName] = () => {
          routeScrollEventThrottle.throttle(() => {
            const scrollContainerElementScrollPosition = scrollContainerElement?.scrollTop || 0
            dispatch('saveRouteScrollPosition', {
              routeName,
              scrollPosition: scrollContainerElementScrollPosition
            })
          }, {time: 1000})
        }
        if (state.eventListeners.scroll[routeName]) {
          scrollContainerElement.removeEventListener('scroll', state.eventListeners.scroll[routeName])
        }
        scrollContainerElement.addEventListener('scroll', state.eventListeners.scroll[routeName])
      }
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
        notifications.emit({name: 'actionNotAllowedWhenInputFieldIsActive'})
      }
      else if (alertOnConditionUnfullfilled && !condition2Fullfilled) {
        notifications.emit({name: 'actionNotAllowedWhenDialogIsOpened'})
      }
      else if (alertOnConditionUnfullfilled && !condition3Fullfilled) {
        notifications.emit({name: 'actionFailedNoDirItemsSelected'})
      }
      else if (alertOnConditionUnfullfilled && !condition4Fullfilled) {
        notifications.emit({name: 'actionNotAllowedOnThisPage'})
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
    closeDialog ({state, dispatch}, params = {}) {
      const defaultParams = {
        resetData: true,
      }
      params = {...defaultParams, ...params}

      if (params.resetData) {
        dispatch('resetDialog', params)
      }
      state.dialogs[params.name].value = false
    },
    resetDialog ({state}, params) {
      state.dialogs[params.name].data = utils.cloneDeep(state.dialogsDefaultData[params.name].data)
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
        if (!someDirLoaded || state.navigatorView.dirItems.length === 0) {
          dispatch('loadDir', { path: '' })
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
            index: store.state.navigatorView.selectedDirItems.at(-1).dirItemPositionIndex
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
      let item = store.state.navigatorView.selectedDirItems.at(-1)
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
        notifications.emit({
          name: 'increaseUIZoom', 
          props: {
            newZoomFactor: (newZoomFactor * 100).toFixed(0)
          }
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
        notifications.emit({
          name: 'decreaseUIZoom', 
          props: {
            newZoomFactor: (newZoomFactor * 100).toFixed(0)
          }
        })
      }
    },
    RESET_UI_ZOOM (store) {
      electron.webFrame.setZoomFactor(1)
      store.dispatch('SET', {
        key: 'storageData.settings.UIZoomLevel',
        value: 1.0
      })
      notifications.emit({name: 'resetUIZoom'})
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
          key: 'inputState.drag.type',
          value: ''
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
    CLOSE_APP_WINDOW (store) {
      electron.ipcRenderer.send('handle:close-app', store.state.storageData.settings.windowCloseButtonAction)
    },
    CLOSE_ALL_TABS_IN_CURRENT_WORKSPACE (store) {
      let tabs = [...store.getters.selectedWorkspace.tabs]
      if (tabs.length === 0) {
        notifications.emit({name: 'currentWorkspaceHasNoTabs'})
      }
      else {
        tabs = []
        store.dispatch('SET_TABS', tabs)
        // Close app window if needed
        if (store.state.storageData.settings.navigator.tabs.closeAppWindowWhenLastWorkspaceTabIsClosed) {
          store.dispatch('CLOSE_APP_WINDOW')
        }
        else {
          notifications.emit({name: 'closedAllTabsInCurrentWorkspace'})
        }
      }
    },
    CLOSE_CURRENT_TAB (store) {
      let tabs = [...store.getters.selectedWorkspace.tabs]
      const currentDirTab = tabs.find(item => item.path === store.state.navigatorView.currentDir.path)
      if (currentDirTab) {
        store.dispatch('CLOSE_TAB', currentDirTab)
      }
      if (store.getters.selectedWorkspace.tabs.length === 0) {
        // Close app window if needed
        if (store.state.storageData.settings.navigator.tabs.closeAppWindowWhenLastWorkspaceTabIsClosed) {
          store.dispatch('CLOSE_APP_WINDOW')
        }
        else {
          notifications.emit({name: 'currentWorkspaceHasNoTabs'})
        }
      }
    },
    CLOSE_TAB (store, tab) {
      if (!tab?.path) {return}
      let tabs = [...store.getters.selectedWorkspace.tabs]
      const tabIndex = tabs.findIndex(item => item.path === tab.path)
      const tabExists = tabIndex !== -1
      // Remove tab
      if (tabExists) {
        tabs.splice(tabIndex, 1)
        store.dispatch('SET_TABS', tabs)
        notifications.emit({
          name: 'tabRemoved', 
          props: {
            tabPath: tab.path
          }
        })
        // Switch tab
        const currentDirTabIndex = tabs.findIndex(item => item.path === store.state.navigatorView.currentDir.path)
        if (currentDirTabIndex === -1 && tabs.length > 0) {
          store.dispatch('SWITCH_TAB', tabs.length)
        }
      }
    },
    ADD_TAB (store, params) {
      let item = params?.item 
        ? params?.item
        : store.state.navigatorView.selectedDirItems.at(-1)
      let isDirectory = item.type.includes('directory')

      if (!isDirectory) {return}
      
      let tabs = [...store.getters.selectedWorkspace.tabs]
      let newTab = {
        name: item.name,
        path: item.path
      }
      const tabIndex = store.getters.selectedWorkspace.tabs.findIndex(tab => tab.path === newTab.path)

      if (tabIndex === -1) {
        tabs.push(newTab)
        store.dispatch('SET_TABS', tabs)
        notifications.emit({
          name: 'tabAdded', 
          props: {
            tabShortcut: store.state.storageData.settings.shortcuts.switchTab.shortcut
              .replace('[1 - 9]', tabs.length)
          }
        })
      }
      else {
        notifications.emit({
          name: 'tabIsAlreadyOpened', 
          props: {
            tabIndex: tabIndex + 1
          }
        })
        store.state.menus.tabs = true
      }

      // Scroll tab container
      setTimeout(() => {
        let tabIteratorContainerElement = document.querySelector('.tab-bar-container')
        if (tabIteratorContainerElement) {
          tabIteratorContainerElement.scrollLeft = tabIteratorContainerElement.scrollWidth
        }
      }, 0)
    },
    SET_TABS (store, tabs) {
      store.getters.selectedWorkspace.tabs = tabs
      store.dispatch('syncWorkspaceStorageData')
    },
    clearFilterField ({dispatch}, routeName) {
      dispatch('SET', {
        key: `filterField.view.${routeName}.query`,
        value: ''
      })
    },
    SET_STATS (store) {
      store.state.navigatorView.timeSinceLoadDirItems = Date.now()
    },
    LOAD_ROUTE (store, routeName) {
      router.push(routeName).catch((error) => {})
    },
    async saveNavigatorScrollPosition (store) {
      const contentAreaNode = utils.getContentAreaNode(router.currentRoute.name)
      store.state.navigatorView.scrollPosition = contentAreaNode?.scrollTop || 0
    },
    async loadDir (store, options) {
      await store.dispatch('saveNavigatorScrollPosition')
      loadDirThrottle.throttle(async () => {
        console.log('loadDir', options)
        store.dispatch('ADD_ACTION_TO_HISTORY', { action: 'store.js::loadDir()' })
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
        let {dirInfo} = await store.dispatch('LOAD_DIR_ITEMS', options)
        eventHub.$emit('app:method', {
          method: 'postDirWatcherWorker',
          params: options.path
        })
        store.commit('UPDATE_NAVIGATOR_HISTORY', options)
        store.dispatch('ADD_TO_DIR_ITEMS_TIMELINE', dirInfo.path)
        store.dispatch('SORT_DIR_ITEMS')
        store.dispatch('SET_STATS')
        await store.dispatch('RESTORE_NAVIGATOR_STATE')
        store.dispatch('AUTO_FOCUS_FILTER')
        console.log('loadDir 2', options)
        if (options.scrollTop) {
          store.dispatch('SCROLL_TOP_CONTENT_AREA', {behavior: 'auto'})
        }
      }, {time: 200})
    },
    async RELOAD_DIR (store, params) {
      params = {
        ...{
          scrollTop: true,
          selectCurrentDir: true,
          emitNotification: false
        }, 
        ...params 
      }
      if (router.history.current.name === 'navigator') {
        const {dirItems} = await store.dispatch('GET_DIR_ITEMS', {path: store.state.navigatorView.currentDir.path})
        const oldDirItems = store.state.navigatorView.dirItems

        dirItems.forEach(newDirItem => {
          const oldDirItem = oldDirItems.find(dirItem => dirItem.path === newDirItem.path)
          if (oldDirItem) {
            for (const key in oldDirItem) {
              oldDirItem[key] = newDirItem[key]
            }
          }
          else {
            oldDirItems.push(newDirItem)
          }
        });
        
        oldDirItems.forEach((oldDirItem, index) => {
          const newDirItem = dirItems.find(dirItem => dirItem.path === oldDirItem.path)
          if (!newDirItem) {
            store.state.navigatorView.dirItems.splice(index, 1)
          }
        });

        if (params.emitNotification) {
          notifications.emit({
            name: 'directoryWasReloaded', 
            props: {
              currentDirPath: store.state.navigatorView.currentDir.path
            }
          })
        }
      }
    },
    async LOAD_DIR_ITEMS (store, params) {
      if (params.path === '') {
        params.path = store.state.storageData.settings.appPaths.home
      }
     
      try {
        const dirInfo = await store.dispatch('GET_DIR_ITEM_INFO', params.path)
        store.dispatch('SET', {
          key: 'navigatorView.currentDir',
          value: dirInfo
        })
        if (params.selectCurrentDir) {
          store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [dirInfo])
        }
        await store.dispatch('FETCH_DIR_ITEMS', {path: params.path})
        return {dirInfo}
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
      // - Needs an option to ignore dir updates triggered by dir watcher
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
    * @param {string[]} params.sourcePath
    * @param {string} params.destPath
    */
    addToArchive ({state}, params) {
      let archiveState = {
        isCanceled: false,
        error: false
      }
      let notification = {}
      let hashID = utils.getHash()

      if (params.destPath) {
        params.destPath = utils.getUniquePath(params.destPath)
      }
      else if (!params.destPath) {
        const parsed = PATH.parse(params.sourcePath[0])
        const uniqueDestPath = utils.getUniquePath(PATH.join(parsed.dir, 'Archive.zip'))
        params.destPath = uniqueDestPath
      }

      const archiveStream = node7z.add(
        params.destPath,
        params.sourcePath,
        {
          $bin: state.storageData.settings.appPaths.bin7Zip,
          $progress: true,
          ...params.options
        }
      )

      archiveStream.on('error', (error) => {
        archiveState.error = true
        notifications.emit({
          name: 'archiveAddDataError',
          error
        })
      })

      archiveStream.on('progress', (progress) => {
        notification = notifications.emit({
          name: 'archiveCreationProgress',
          props: {
            hashID,
            progress,
            params,
            archiveStream,
            archiveState
          }
        })
      })

      archiveStream.on('end', () => {
        if (!archiveState.error) {
          if (!archiveState.isCanceled) {
            setTimeout(() => {
              notification.update({
                name: 'archiveWasCreated',
                props: {
                  progress: notification.progress,
                  params,
                  hashID
                }
              })
            }, 1000)
          }
          else {
            notification.update({
              name: 'archiveCreationCanceled',
              props: {
                hashID
              }
            })
          }
        }
      })
    },
    /**
    * @param {string} params.sourcePath
    * @param {string} params.destPath
    */
    async showArchiveExtractDialog ({state, dispatch}, params) {
      return new Promise(async (resolve) => {
        state.dialogs.archiveExtract.data.isGettingStats = true

        if (!params.destPath) {
          const parsed = PATH.parse(params.sourcePath)
          const dest = utils.getUniquePath(PATH.join(parsed.dir, parsed.name))
          params.destPath = dest
        }

        state.dialogs.archiveExtract.data.destPath = params.destPath
        state.dialogs.archiveExtract.value = true

        const archiveTestStream = node7z.list(
          params.sourcePath,
          {
            $bin: state.storageData.settings.appPaths.bin7Zip,
            $progress: true,
            techInfo: true,
          }
        )
  
        archiveTestStream.on('end', () => {
          const archiveData = {
            sourcePath: {
              title: 'Archive path',
              value: params.sourcePath,
              readableValue: params.sourcePath,
            },
            physicalSize: {
              title: 'Physical Size',
              value: archiveTestStream.info.get('Physical Size'),
              readableValue: utils.prettyBytes(archiveTestStream.info.get('Physical Size')),
            },
            size: {
              title: 'Size',
              value: archiveTestStream.info.get('Size'),
              readableValue: utils.prettyBytes(archiveTestStream.info.get('Size')),
            },
            packedSize: {
              title: 'Packed Size',
              value: archiveTestStream.info.get('Packed Size'),
              readableValue: utils.prettyBytes(archiveTestStream.info.get('Packed Size')),
            },
            encrypted: {
              title: 'Encrypted',
              value: archiveTestStream.info.get('Encrypted'),
              readableValue: archiveTestStream.info.get('Encrypted') === '+' ? 'Yes' : 'No',
            },
            method: {
              title: 'Method',
              value: archiveTestStream.info.get('Method'),
              readableValue: archiveTestStream.info.get('Method'),
            },
            characteristics: {
              title: 'Characteristics',
              value: archiveTestStream.info.get('Characteristics'),
              readableValue: archiveTestStream.info.get('Characteristics'),
            },
          }
            
          state.dialogs.archiveExtract.data.isGettingStats = false
          state.dialogs.archiveExtract.data.archiveData = archiveData
          state.dialogs.archiveExtract.data.isEncrypted = archiveData.encrypted.value === '+'
          state.dialogs.archiveExtract.data.onExtract = () => {
            params.options = {
              password: state.dialogs.archiveExtract.data.password
            }
            dispatch('extractArchive', params)
          }
        })
      })
    },
    /**
    * @param {string} params.sourcePath
    * @param {string} params.destPath
    */
     async extractArchive ({state}, params) {
      let archiveState = {
        isCanceled: false,
        error: false
      }
      let notification = {}
      let hashID = utils.getHash()

      const archiveStream = node7z.extractFull(
        params.sourcePath,
        params.destPath,
        {
          $bin: state.storageData.settings.appPaths.bin7Zip,
          $progress: true,
          techInfo: true,
          ...params.options
        }
      )

      archiveStream.on('error', (error) => {
        archiveState.error = true
        notification.hide()
        if (error.message.startsWith('Wrong password')) {
          notification = notifications.emit({
            name: 'archiveExtractionError',
            props: {error: 'Wrong password'}
          })
        }
        else {
          notification = notifications.emit({
            name: 'archiveExtractionError',
            props: {error: error.message}
          })
        }
      })

      archiveStream.on('progress', (progress) => {
        notification = notifications.emit({
          name: 'archiveExtractionProgress',
          props: {
            hashID,
            progress,
            params,
            archiveStream,
            archiveState
          }
        })
      })

      archiveStream.on('end', () => {
        if (!archiveState.error) {
          state.dialogs.archiveExtract.value = false
          if (!archiveState.isCanceled) {
            setTimeout(() => {
              notification.update({
                name: 'archiveWasExtracted',
                props: {
                  progress: notification.progress,
                  params,
                  hashID
                }
              })
            }, 1000)
          }
          else {
            notification.update({
              name: 'archiveExtractionCanceled',
              props: {
                hashID
              }
            })
          }
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

      const contentAreaNode = utils.getContentAreaNode(router.currentRoute.name)
      if (contentAreaNode) {
        contentAreaNode.scroll({
          top: store.state.navigatorView.scrollPosition,
          left: 0,
          behavior: 'auto'
        })
      }
    },
     async FOCUS_DIR_ITEM (store, params) {
      if (params.focusPath) {
        const dirInfo = await store.dispatch('GET_DIR_ITEM_INFO', params.focusPath)
        await store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [dirInfo])
      }
    },
    async GET_DIR_ITEM_INFO (store, path) {
      if (path === '' || !path) {
        path = store.state.storageData.settings.appPaths.home
      }
      return fsCore.getDirItemInfo(
        path, 
        store.state.storageData.settings.navigatorLayoutItemHeight
      )
    },
    async GET_DIR_ITEMS (store, params) {
      try {
        return fsCore.getDirItems({
          ...params,
          itemHeight: store.state.storageData.settings.navigatorLayoutItemHeight
        })
      }
      catch (error) {
        notifications.emit({
          name: 'cannotFetchDirItems',
          props: {
            error
          }
        })
      }
    },
    async FETCH_DIR_ITEMS (store, params) {
      let hashID = utils.getHash()
      let task = {hashID, allItemsFetched: false}

      store.state.navigatorView.dirItemsInfoIsPartiallyFetched = false
      store.state.navigatorView.dirItemsInfoIsFetched = false
      store.state.navigatorView.dirItemsTasks = []
      store.state.navigatorView.dirItems = []
      store.state.navigatorView.dirItemsTasks.push(task)

      async function setPartialDirItems () {
        const {dirItems: partialDirItems, allItemsFetched} = await store.dispatch('GET_DIR_ITEMS', {...params, preload: true, hashID})
        task.allItemsFetched = allItemsFetched
        if (getTaskIndex(task) !== -1) {
          store.state.navigatorView.dirItems = partialDirItems
        }
        if (task.allItemsFetched) {
          store.state.navigatorView.dirItemsTasks.splice(getTaskIndex(task), 1)
        }
        store.state.navigatorView.dirItemsInfoIsPartiallyFetched = true
      }
      
      async function setDirItems () {
        if (!task.allItemsFetched && getTaskIndex(task) !== -1) {
          const {dirItems} = await store.dispatch('GET_DIR_ITEMS', {...params, hashID})
          if (getTaskIndex(task) !== -1) {
            store.state.navigatorView.dirItems = dirItems
            store.state.navigatorView.dirItemsTasks.splice(getTaskIndex(task), 1)
          }
        }
        store.state.navigatorView.dirItemsInfoIsFetched = true
      }
      
      function getTaskIndex (task) {
        return store.state.navigatorView.dirItemsTasks.findIndex(taskListItem => taskListItem.hashID === task.hashID)
      }

      await setPartialDirItems()
      await setDirItems()
    },
    OPEN_DIR_ITEM (store, item) {
      if (item.isInaccessible) {
        notifications.emit({name: 'cannotOpenDirItem'})
        return
      }

      if (item.type === 'file' || item.type === 'file-symlink') {
        store.dispatch('OPEN_FILE', item.path)
      }
      else {
        store.dispatch('loadDir', { path: item.realPath })
      }
    },
    OPEN_DIR_ITEM_FROM_PATH (store, path) {
      store.dispatch('GET_DIR_ITEM_INFO', path)
        .then((item) => {
          store.dispatch('OPEN_DIR_ITEM', item)
        })
    },
    OPEN_DIR_PATH_FROM_OS_CLIPBOARD (store) {
      const osClipboardText = electron.clipboard.readText()
      const path = PATH.normalize(osClipboardText)
      fs.access(path, fs.constants.F_OK, (error) => {
        if (error) {
          notifications.emit({name: 'cannotOpenPathFromClipboard'})
        }
        else {
          store.dispatch('loadDir', {path: osClipboardText})
          notifications.emit({
            name: 'openedPathFromClipboard',
            props: {
              osClipboardText
            }
          })
        }
      })
    },
    SHOW_DIR_ITEM_IN_DIRECTORY (store, payload) {
      store.dispatch('loadDir', {path: payload.dir})
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
          asPath: true,
          pathSlashes: sharedUtils.platform === 'win32'
            ? 'single-backward'
            : ''
        })
      }
    },
    openAddressBarEditor (store) {
      store.state.addressBarEditor = true
    },
    toggleGlobalSearch ({state, dispatch}) {
      if (state.globalSearch.widget) {
        state.globalSearch.widget = false
        dispatch('closePaneType', 'search');
      }
      else {
        if (router.history.current.name === 'navigator') {
          state.globalSearch.widget = !state.globalSearch.widget
        }
        else {
          const someDirLoaded = Object.keys(state.navigatorView.currentDir).length !== 0
          if (!someDirLoaded) {
            dispatch('OPEN_DIR_ITEM_FROM_PATH', '')
          }
          else {
            router.push('navigator').catch((error) => { })
          }
          state.globalSearch.widget = true
        }
        dispatch('splitPaneHorizontallyLeft', { row: 1, type: 'search' });
      }
    },
    async LOAD_PREVIOUS_HISTORY_PATH ({ state, commit, dispatch, getters }) {
      const historyItems = state.navigatorView.history.items
      const currentHistoryIndex = state.navigatorView.history.currentIndex
      const previousHistoryPath = historyItems[currentHistoryIndex - 1]
      if (currentHistoryIndex > 0) {
        await dispatch('loadDir', {path: previousHistoryPath, goBackwardInHistory: true})
        state.navigatorView.history.currentIndex = currentHistoryIndex - 1
      }
    },
    async LOAD_NEXT_HISTORY_PATH ({ state, commit, dispatch, getters }) {
      const historyItems = state.navigatorView.history.items
      const currentHistoryIndex = state.navigatorView.history.currentIndex
      const nextHistoryPath = historyItems[currentHistoryIndex + 1]
      if (currentHistoryIndex < historyItems.length - 1) {
        await dispatch('loadDir', {path: nextHistoryPath, goForwardInHistory: true})
        state.navigatorView.history.currentIndex = currentHistoryIndex + 1
      }
    },
    GO_UP_DIRECTORY ({ state, commit, dispatch, getters }) {
      const dir = PATH.parse(state.navigatorView.currentDir.path).dir
      dispatch('loadDir', { path: dir })
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
      notifications.emit({name: 'programWasAdded'})
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
      notifications.emit({name: 'programWasEdited'})
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
      notifications.emit({name: 'programWasDeleted'})
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
        title: i18n.t('clearListMessage'),
        actionButtons: [
          {
            title: i18n.t('undo'),
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
        title: i18n.t('clearListMessage'),
        actionButtons: [
          {
            title: i18n.t('undo'),
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
        title: i18n.t('clearListMessage'),
        actionButtons: [
          {
            title: i18n.t('undo'),
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
              title: i18n.t('undo'),
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
    async TRASH_SELECTED_DIR_ITEMS (store) {
      await store.dispatch('TRASH_DIR_ITEMS', {items: store.getters.selectedDirItems})
    },
    async DELETE_SELECTED_DIR_ITEMS (store) {
      await store.dispatch('DELETE_DIR_ITEMS', {items: store.getters.selectedDirItems})
    },
    async TRASH_DIR_ITEMS (store, params) {
      let defaultOptions = {
        skipSafeCheck: false,
        silent: false,
        allowUndo: false,
        operation: 'trash'
      }
      params.options = {...defaultOptions, ...params.options}
      
      try {
        await store.dispatch('HANDLE_REMOVE_DIR_ITEMS', params)
      }
      catch (error) {
        await store.dispatch('HANDLE_REMOVE_DIR_ITEMS_ERROR', {...params, ...error})
      }
    },
    async DELETE_DIR_ITEMS (store, params) {
      let defaultOptions = {
        skipSafeCheck: false,
        silent: false,
        allowUndo: false,
        operation: 'delete'
      }
      params.options = {...defaultOptions, ...params.options}
      params = utils.cloneDeep(params)

      try {
        await store.dispatch('HANDLE_REMOVE_DIR_ITEMS', params)
      }
      catch (error) {
        await store.dispatch('HANDLE_REMOVE_DIR_ITEMS_ERROR', {...params, ...error})
      }
    },
    async HANDLE_REMOVE_DIR_ITEMS_ERROR (store, params) {
      if (params.error.status !== 'cancel') {
        let notificationName = params.options.operation === 'trash'
          ? 'trashItemsError'
          : 'deleteItemsError'
        
        notifications.emit({
          name: notificationName, 
          error: params.error
        })
      }
    },
    async HANDLE_REMOVE_DIR_ITEMS (store, params) {
      async function removeDirItems (params) {
        try {
          if (params.options.skipSafeCheck) {
            await initRemoveDirItems(params)
          }
          else {
            params.items = await getItems(params)
            await initRemoveDirItems(params)
          }
        }
        catch (error) {
          throw error
        }
      }
      
      async function getItems (params) {
        return await store.dispatch('ENSURE_DIR_ITEMS_SAFE_TO_DELETE',  {
          operation: params.options.operation, 
          items: params.items
        }) || [] 
      }

      async function initRemoveDirItems (params) {
        try {
          if (params.items.length > 0) {
            let result = []
            if (params.options.operation === 'trash') {
              result = await fsManager.trashFSItems(params)
            }
            else if (params.options.operation === 'delete') {
              result = await fsManager.deleteFSItems(params)
            }
            await store.dispatch('REMOVE_DIR_ITEMS_POST_ACTIONS', {result, params})
          }
        }
        catch (error) {
          throw error
        }
      }

      await removeDirItems(params)
    },
    ENSURE_DIR_ITEMS_SAFE_TO_DELETE (store, payload) {
      let {operation, items} = payload
      return new Promise((resolve, reject) => {
        items = utils.cloneDeep(items)
        const currentDirPath = store.state.navigatorView.currentDir.path
        const includesCurrentDir = items.some(item => item.path === currentDirPath)
        const currentDirIsRoot = PATH.parse(currentDirPath).base === ''
        const includesItemLocatedInRoot = checkIncludesItemLocatedInRoot(items)
        const protectedEditTargetItems = getDirItemsFromSavedList({
          items,
          list: store.state.storageData.protected.items
        })

        async function confirmAll () {
          try {
            let result = await handleTargetItemsIncludesCurrentDir(items)
            result = await confirmDeleteFromDrive(items)
            result = await checkDirItemsIncludeRootDir(result.items)
            result = await checkDirItemsLocatedInRoot(result.items)
            result = await checkDirItemsProtected(result.items)
            return result.items
          }
          catch (error) {
            reject([])
          }
        }

        function checkIncludesItemLocatedInRoot (items) {
          return items.some(item => {
            const itemDir = PATH.parse(item.path).dir
            const itemDirIsRoot = PATH.parse(itemDir).base === ''
            return itemDirIsRoot
          })
        }

        function confirmDeleteFromDrive (items) {
          return new Promise((resolve, reject) => {
            const itemsList = items.map(item => item.path).join('<br>')
            if (operation === 'delete') {
              dialogs.showDialog(store, {
                name: 'deleteDirItems',
                items,
                itemsList
              })
                .then((items) => resolve(items))
                .catch(error => reject(error))
            }
            else {
              resolve({status: '', items})
            }
          })
        }

        function checkDirItemsIncludeRootDir (items) {
          return new Promise((resolve, reject) => {
            if (currentDirIsRoot && includesCurrentDir) {
              notifications.emit({name: 'cannotDeleteDriveRootDir'})
              reject()
            }
            else {
              resolve({status: '', items})
            }
          })
        }

        function checkDirItemsProtected (items) {
          return new Promise((resolve, reject) => {
            if (protectedEditTargetItems.length > 0) {
              if (operation === 'trash') {
                dialogs.showDialog(store, {
                  name: 'trashDirItemsContainsProtected',
                  items,
                  protectedEditTargetItems
                })
                  .then((items) => resolve(items))
                  .catch(error => reject(error))
              }
              else if (operation === 'delete') {
                dialogs.showDialog(store, {
                  name: 'deleteDirItemsContainsProtected',
                  items,
                  protectedEditTargetItems
                })
                  .then((items) => resolve(items))
                  .catch(error => reject(error))
              }
            }
            else {
              resolve({status: '', items})
            }
          })
        }

        function checkDirItemsLocatedInRoot (items) {
          return new Promise((resolve, reject) => {
            if (includesItemLocatedInRoot) {
              dialogs.showDialog(store, {
                name: 'deleteDirItemsIncludesItemLocatedInRoot',
                items
              })
                .then((items) => resolve(items))
                .catch(error => reject(error))
            }
            else {
              resolve({status: '', items})
            }
          })
        }

        function containsCurrentDir (dirItems) {
          return dirItems.some(dirItem => dirItem.path === store.state.navigatorView.currentDir.path)
        }

        function handleTargetItemsIncludesCurrentDir (items) {
          return new Promise((resolve, reject) => {
            if (containsCurrentDir(items)) {
              const itemsList = items.map(item => item.path).join('<br>')
              dialogs.showDialog(store, {
                name: 'deleteDirItemsIncludesCurrentDir',
                items,
                itemsList
              })
                .then((items) => resolve(items))
                .catch(error => {console.log(error); reject(error)})
            }
            else {
              resolve({status: '', items})
            }
          })
        }

        confirmAll()
          .then((result) => resolve(result))
          .catch(error => reject(error))
      })
    },
    async REMOVE_DIR_ITEMS_POST_ACTIONS (store, payload) {
      let {result, params} = payload

      async function init () {
        let allItemsWereRemoved = params.items.every(item => result.removedItems.includes(item.path.replace(/\\/g, '/')))
        params.removedItems = result.removedItems
        params.notRemovedItems = result.notRemovedItems

        postActions(params)

        if (allItemsWereRemoved) {
          handleAllDirItemsWereDeleted(params)
        }
        else {
          handleNotAllDirItemsWereDeleted(params)
        }
      }
      
      function postActions (params) {
        let paramsClone = utils.cloneDeep(params)
        store.dispatch('REMOVE_FROM_PROTECTED', paramsClone)
        store.dispatch('REMOVE_FROM_PINNED', paramsClone)
        store.dispatch('CLEAR_FS_CLIPBOARD')
        store.dispatch('DESELECT_ALL_DIR_ITEMS')
        store.dispatch('RELOAD_DIR', {
          scrollTop: false,
          selectCurrentDir: false
        })
      }

      function handleAllDirItemsWereDeleted (params) {
        let notificationName = params.options.operation === 'trash'
          ? 'trashItemsSuccess'
          : 'deleteItemsSuccess'
          
        notifications.emit({
          name: notificationName, 
          props: {
            removedItems: params.removedItems
          }
        })
      }
      
      function handleNotAllDirItemsWereDeleted (params) {
        let notificationName = params.options.operation === 'trash'
          ? 'trashItemsFailure'
          : 'deleteItemsFailure'
      
        notifications.emit({
          name: notificationName, 
          props: {
            items: params.items,
            removedItems: params.removedItems,
            notRemovedItems: params.notRemovedItems
          }
        })
      }

      try {
        await init()
      }
      catch (error) {
        throw error
      }
    },
    async showNewDirItemDialog ({state, dispatch}, type) {
      state.dialogs.newDirItemDialog.data.type = type
      const allConditionsAreFulfilled = await dispatch('CHECK_CONDITIONS', {
        routes: ['all']
      })
      if (allConditionsAreFulfilled) {
        dispatch('OPEN_DIALOG', {dialogName: 'newDirItemDialog'})
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
      notifications.emit({
        name: 'noteWasTrashed'
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
    openNoteEditor ({state, dispatch}, params) {
      const defaultParams = {
        delay: 0
      }
      params = {...defaultParams, ...params}

      router.push('notes').catch((error) => { })
      state.currentNotesList = 'existing'
      setTimeout(() => {
        if (params.type === 'new') {
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
        else if (params.type === 'edit') {
          dispatch('SET', {
            key: 'noteEditor.openedNote',
            value: params.note
          })
        }
        state.dialogs.noteEditorDialog.value = true
      }, params.delay)
    },
    splitPaneHorizontallyLeft ({getters}, pane) {
      const panes = getters.selectedWorkspace.panes
      const lastPaneIndex = panes.items.length - 1
      panes.items[lastPaneIndex].column += 1
      panes.items.splice(lastPaneIndex, 0, {
        row: pane.row,
        column: panes.items[lastPaneIndex].column - 1,
        width: '1fr',
        type: pane.type,
      })
    },
    splitPaneHorizontallyRight ({getters}, pane) {
      const panes = getters.selectedWorkspace.panes
      const lastPaneIndex = panes.items.length
      panes.items.splice(lastPaneIndex + 1, 0, {
        row: pane.row,
        column: panes.items[lastPaneIndex].column + 1,
        width: '1fr',
        type: pane.type,
      })
    },
    splitPaneVerticallyUp ({getters}, pane) {
      const panes = getters.selectedWorkspace.panes
      const lastPaneIndex = panes.items.findIndex(p => p.column === pane.column)
      panes.items.splice(lastPaneIndex, 0, {
        row: lastPaneIndex,
        column: pane.column,
        width: '1fr',
        type: pane.type,
      })
    },
    splitPaneVerticallyDown ({getters}, pane) {
      const panes = getters.selectedWorkspace.panes
      const lastPaneIndex = panes.items.findIndex(p => p.column === pane.column)
      panes.items.splice(lastPaneIndex + 1, 0, {
        row: lastPaneIndex + 1,
        column: pane.column,
        width: '1fr',
        type: pane.type,
      })
    },
    closePane ({getters}, pane) {
      const panes = getters.selectedWorkspace.panes
      panes.items = panes.items.filter(p => p.row !== pane.row || p.column !== pane.column)
    },
    closePaneType ({getters}, paneType) {
      const panes = getters.selectedWorkspace.panes
      panes.items = panes.items.filter(p => p.type !== paneType)
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
        store.dispatch('setHomeBannerBackground', mediaItem)
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
      store.dispatch('resetHomeBannerBackground')
    },
    resetHomeBannerBackground ({state, dispatch}) {
      const mediaItems = state.storageData.settings.homeBanner.items
      const defaultMediaItem = mediaItems.find(item => item.isDefault)
      dispatch('setHomeBannerBackground', defaultMediaItem)
    },
    setPreviousHomeBannerBackground ({dispatch}) {
      dispatch("setClosestHomeBannerBackground", -1)
    },
    setNextHomeBannerBackground ({dispatch}) {
      dispatch("setClosestHomeBannerBackground", 1)
    },
    setClosestHomeBannerBackground ({state, dispatch}, direction) {
      const mediaItems = state.storageData.settings.homeBanner.items
      const selectedItem = state.storageData.settings.homeBanner.selectedItem
      const selectedItemIndex = mediaItems.findIndex(item => item.path === selectedItem.path)
      const firstItem = selectedItemIndex === 0
      const lastItem = selectedItemIndex === mediaItems.length - 1
      if (direction === -1) {
        if (firstItem) {
          dispatch('setHomeBannerBackground', mediaItems[mediaItems.length - 1])
        }
        else {
          dispatch('setHomeBannerBackground', mediaItems[selectedItemIndex - 1])
        }
      }
      else if (direction === 1) {
        if (lastItem) {
          dispatch('setHomeBannerBackground', mediaItems[0])
        }
        else {
          dispatch('setHomeBannerBackground', mediaItems[selectedItemIndex + 1])
        }
      } 
    },
    setHomeBannerBackground ({dispatch}, mediaItem) {
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
    SET_SORTING_TYPE ({state, dispatch}, sortingType) {
      if (state.storageData.settings.sorting.saveNavigatorSorting) {
        dispatch('SET', {
          key: 'storageData.settings.sorting.selectedType',
          value: sortingType
        })
      }
      else {
        state.storageData.settings.sorting.selectedType = sortingType
      }
      dispatch('SORT_DIR_ITEMS')
    },
    TOGGLE_SORTING_ORDER ({state, dispatch}) {
      const order = state.storageData.settings.sorting.order
      if (state.storageData.settings.sorting.saveNavigatorSorting) {
        dispatch('SET', {
          key: 'storageData.settings.sorting.order',
          value: order === 'ascending'
            ? 'descending'
            : 'ascending'
        })
      }
      else {
        state.storageData.settings.sorting.order = order === 'ascending'
          ? 'descending'
          : 'ascending'
      }
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
    SELECT_DIR_ITEM_RANGE ({state, getters}) {
      state.navigatorView.selectedDirItems = getters.highlightedDirItems
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
      }
    },
    REPLACE_SELECTED_DIR_ITEMS ({ state, commit, dispatch, getters }, items) {
      state.navigatorView.selectedDirItems = items
    },
    SELECT_DIR_ITEM (store, params) {
      if (params.index !== undefined) {
        let item = store.state.navigatorView.dirItems.find(item => item.dirItemPositionIndex === params.index)
        if (item) {
          store.dispatch('REPLACE_SELECTED_DIR_ITEMS', [item])
        }
      }
    },
    DESELECT_DIR_ITEM ({commit, getters}, specifiedItem) {
      commit('DESELECT_DIR_ITEM', {getters, specifiedItem})
    },
    SELECT_ALL_DIR_ITEMS ({state}) {
      state.navigatorView.selectedDirItems = state.navigatorView.filteredDirItems
    },
    DESELECT_ALL_DIR_ITEMS ({state}) {
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
    async AUTO_CALCULATE_DIR_SIZE (store, item) {
      return new Promise((resolve, reject) => {
        const isRootDir = PATH.parse(item.path).base === ''
        if (store.state.storageData.settings.autoCalculateDirSize && !isRootDir) {
          store.dispatch('FETCH_DIR_SIZE', {item, options: {timeout: 1000}}).then(() => resolve())
        }
      })
    },
    GET_MEDIA_FILE_INFO (store, params) {
      return new Promise((resolve, reject) => {
        if (!store.state.workers.mediaInfoWorker) {
          store.state.workers.mediaInfoWorker = new MediaInfoWorker()
        }
        store.state.workers.mediaInfoWorker.onmessage = (event) => {
          resolve(event)
        }
        store.state.workers.mediaInfoWorker.postMessage({
          action: 'get-info',
          path: params.path,
          appPaths: store.state.storageData.settings.appPaths
        })
      })
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
    async updateUserDir ({state, dispatch}, {userDir}) {
      const userDirs = state.storageData.settings.appPaths.userDirs
      const modifiedUserDirIndex = userDirs.findIndex(originalItem => originalItem.name === userDir.name)
      if (modifiedUserDirIndex !== -1) {
        userDirs.splice(modifiedUserDirIndex, 1, userDir) 
        dispatch('SET', {
          key: 'storageData.settings.appPaths.userDirs',
          value: userDirs,
        })
      }
    },
    async openItemContextMenu ({dispatch}, {path, item, x, y, targetType}) {
      let dirItem = await dispatch('GET_DIR_ITEM_INFO', path)
      dispatch('DESELECT_ALL_DIR_ITEMS')
      dispatch('ADD_TO_SELECTED_DIR_ITEMS', dirItem)
      dispatch('SET_CONTEXT_MENU', {
        x,
        y,
        targetType,
        targetData: {item, dirItem},
      })
    },
    // Context menu actions
    /**
    * @param {array<object>} payload
    */
    SET_CONTEXT_MENU (store, payload) {
      // Note: clone selected items to avoid modifying items that were selected after
      // the context menu was opened (e.g. accidentally pressed shortcuts, unexpected app bugs, etc.)
      if (payload.targetType === 'userDir') {
        store.state.contextMenus.dirItem.targetItems = utils.cloneDeep([payload.targetData.dirItem])
      }
      else {
        store.state.contextMenus.dirItem.targetItems = utils.cloneDeep(store.getters.selectedDirItems)
      }
      store.state.contextMenus.dirItem.targetData = payload.targetData
      store.state.contextMenus.dirItem.targetType = payload.targetType
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
    async SET_PINNED (store, payload) {
      let items = payload ? payload : store.getters.selectedDirItems
      let pinnedItems = utils.cloneDeep(store.state.storageData.pinned.items)
      const allSelectedArePinned = checkAllSelectedArePinned()
      let itemCounter = 0
      let itemToAdd = {}
      let itemPropertiesToStore = ['path']

      processItems()
      await setStorage()
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
        }
        else {
          setItems()
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
        if (allSelectedArePinned) {
          notifications.emit({
            name: 'removedFromPinnedSuccess', 
            props: {
              itemCounter
            }
          })
        }
        else {
          notifications.emit({
            name: 'addedToPinnedSuccess', 
            props: {
              itemCounter
            }
          })
        }
      }

      async function setStorage () {
        store.dispatch('SET', {
          key: 'storageData.pinned.items',
          value: pinnedItems
        })
      }
    },
    /**
    * @param {array<object>} payload
    */
    async SET_PROTECTED (store, payload) {
      let itemCounter = 0
      let itemToAdd = {}
      let itemPropertiesToStore = ['path']

      let items = payload || store.getters.selectedDirItems
      let protectedItems = utils.cloneDeep(store.state.storageData.protected.items)
      const everySelectedIsProtected = items.every(item => {
        return store.state.storageData.protected.items.some(protectedItem => protectedItem.path === item.path)
      })

      processItems()
      await setStorage()
      setNotification()

      function processItems () {
        if (everySelectedIsProtected) {
          removeItems()
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
        if (everySelectedIsProtected) {
          notifications.emit({
            name: 'removedFromProtectedSuccess', 
            props: {
              itemCounter
            }
          })
        }
        else {
          notifications.emit({
            name: 'addedToProtectedSuccess', 
            props: {
              itemCounter
            }
          })
        }
      }

      async function setStorage () {
        store.dispatch('SET', {
          key: 'storageData.protected.items',
          value: protectedItems
        })
      }
    },
    async SET_DIR_ITEM_PERMISSIONS (store, params) {
      try {
        await fsManager.changeMode(params)
        notifications.emit({
          name: 'setDirItemPermissionsSuccess'
        })
      }
      catch (error) {
        notifications.emit({
          name: 'setDirItemPermissionsFailure',
          error
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
    openAppGuide (store, title) {
      let index = store.state.dialogs.appGuideDialog.data.guideTabs.findIndex(item => item.name === title)
      store.state.dialogs.appGuideDialog.data.guideTabsSelected = index
      store.state.dialogs.appGuideDialog.value = true
    },
    toggleAppGuide (store, title) {
      if (store.state.dialogs.appGuideDialog.value) {
        store.state.dialogs.appGuideDialog.value = false
      }
      else {
        store.dispatch('openAppGuide', title)
      }
    },
    MAKE_DIR_ITEM_LINK (store, params = {}) {
      let defaultParams = {
        srcPath: store.state.contextMenus.dirItem.targetItems.at(-1).path
      }
      params = {...defaultParams, ...params}
      params.uniqueDestPath = utils.getUniquePath(params.destPath)
      params.isDirectory = store.getters.selectedDirItems.at(-1).type === 'directory'
      
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
        await store.dispatch('moveDirItems', {
          items: dirItemsToPaste,
          directory: params.directory,
          options: {
            skipSafeCheck: true,
            silent: true
          }
        })
      }
      else {
        await store.dispatch('copyDirItems', {
          items: dirItemsToPaste,
          directory: params.directory,
        })
      }
      store.dispatch('CLEAR_FS_CLIPBOARD')
    },
    confirmationDialog (store, params) {
      return new Promise((resolve, reject) => {
        store.state.dialogs.confirmationDialog.data = params.data
        store.state.dialogs.confirmationDialog.value = true
      })
    },
    SUDO_PASSWORD_PROMPT (store) {
      // TODO: review needed:
      // The entered sudo password can potentially stay in memory
      // Or leak out in some other way.
      return new Promise((resolve, reject) => {
        store.dispatch('confirmationDialog', {
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
                store.state.dialogs.confirmationDialog.data = {}
                store.state.dialogs.confirmationDialog.value = false
              }
            },
            buttons: [
              {
                text: i18n.t('cancel'),
                onClick: () => {
                  resolve('cancel')
                  store.state.dialogs.confirmationDialog.data = {}
                  store.state.dialogs.confirmationDialog.value = false
                }
              },
              {
                text: 'enter',
                onClick: () => {
                  resolve({ action: 'enter', data: store.state.dialogs.confirmationDialog.data })
                  store.state.dialogs.confirmationDialog.data = {}
                  store.state.dialogs.confirmationDialog.value = false
                }
              },
            ]
          }
        })
      })
    },
    SHOW_CONFIRMATION_DIALOG_MAKE_LINK (store, params) {
      return new Promise((resolve, reject) => {
        store.dispatch('confirmationDialog', {
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
                store.state.dialogs.confirmationDialog.data = {}
                store.state.dialogs.confirmationDialog.value = false
              }
            },
            buttons: [
              {
                text: i18n.t('cancel'),
                onClick: () => {
                  resolve('cancel')
                  store.state.dialogs.confirmationDialog.data = {}
                  store.state.dialogs.confirmationDialog.value = false
                }
              },
              {
                text: 'create',
                onClick: () => {
                  resolve({ action: 'create', data: store.state.dialogs.confirmationDialog.data })
                  store.state.dialogs.confirmationDialog.data = {}
                  store.state.dialogs.confirmationDialog.value = false
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
          title: 'Name conflict',
          message: `
            <div>Files with that name already exist in the destination directory</div>
            <ul>
              ${params.conflictingDirItems.map(item => `<li>${utils.prettyBytes(item.stat.size)} - ${item.path}</li>`).join('')}
            </ul>
          `,
          closeButton: {
            onClick: () => {
              store.state.dialogs.confirmationDialog.value = false
              resolve('cancel')
            }
          },
          buttons: [
            {
              text: i18n.t('cancel'),
              onClick: () => {
                store.state.dialogs.confirmationDialog.value = false
                resolve('cancel')
              }
            },
            {
              text: 'replace all',
              onClick: () => {
                resolve('replace-all')
                store.state.dialogs.confirmationDialog.value = false
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
                store.state.dialogs.confirmationDialog.value = false
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
        store.state.dialogs.confirmationDialog.data = data
        store.state.dialogs.confirmationDialog.value = true
      })
    },
    async getTransferConflictingDirItems (store, params) {
      const {dirItems} = await store.dispatch('GET_DIR_ITEMS', {path: params.directory})
      const conflictingDirItems = []
      if (dirItems.forEach) {
        dirItems.forEach(dirItem => {
          const nameIsConflicting = params.items.some(item => {
            const srcAndDestPathsAreSame = item.path === dirItem.path
            return item.name === dirItem.name && !srcAndDestPathsAreSame
          })
          if (nameIsConflicting) {
            conflictingDirItems.push(dirItem)
          }
        })
      }
      return conflictingDirItems
    },
    /** 
    * @param {string('copy' | 'move')} params.operation
    * @returns void
    */
    async transferDirItems (store, params) {
      let notification = {}
      showInProgressNotification()
      await copyItems(params)

      async function copyItems (params) {
        try {
          params.items = await store.dispatch('ENSURE_ALL_ITEMS_DATA_OBJECTS', params.items)
          const conflictingDirItems = await store.dispatch('getTransferConflictingDirItems', {
            directory: params.directory,
            items: params.items
          })
          
          if (conflictingDirItems.length > 0) {
            await showConfirmationDialog(conflictingDirItems)
          }
          else {
            await initCopyProcess(params)
          }
        }
        catch (error) {
          handleCopyError(error)
        }
      }

      async function showConfirmationDialog (conflictingDirItems) {
        const conformationResult = await store.dispatch('SHOW_CONFIRMATION_DIALOG_PASTE_DIR_ITEMS', {
          conflictingDirItems
        })
        if (conformationResult === 'replace-all') {
          initCopyProcess({...params, ...{overwrite: true}})
        }
        else if (conformationResult === 'auto-rename') {
          initCopyProcess(params)
        }
        else if (conformationResult === 'cancel') {
          cancelTransfer()
        }
      }

      async function cancelTransfer () {
        notification.hide()
      }
      
      async function initCopyProcess (params) {
        let promises = []
        params.items.forEach(item => {
          const parsedItemPath = PATH.parse(item.path)
          const sourcePath = PATH.normalize(item.path)
          const destPath = getDestPath({parsedItemPath, sourcePath, ...params})
          promises.push(startWriteProcess({sourcePath, destPath, ...params}))
        })
        await Promise.all(promises)
        onTransferSuccess()
      }

      function getDestPath (params) {
        let destPath = PATH.normalize(PATH.join(params.directory, params.parsedItemPath.base))
        if (!params.overwrite || (destPath === params.sourcePath)) {
          destPath = utils.getUniquePath(destPath)
        }
        return destPath
      }

      async function startWriteProcess (params) {
        let options = {
          overwrite: params.overwrite ?? false,
          recursive: true
        }
        if (params.operation === 'move') {
          await fsExtra.move(params.sourcePath, params.destPath, options)
        }
        else if (params.operation === 'copy') {
          await fsExtra.copy(params.sourcePath, params.destPath, options)
        }
      }
      
      function handleCopyError (error) {
        notification.update({
          name: 'transferDirItemsError', 
          title: params.operation === 'move' 
            ? 'Move: error'
            : 'Copy: error', 
          props: {error}}
        )
      }

      function showSuccessNotification () {
        if (params.operation === 'move') {
          notification.update({
            name: 'moveDirItemsSuccess',
            props: {
              items: params.items.length
            }
          })
        }
        else if (params.operation === 'copy') {
          notification.update({
            name: 'copyDirItemsSuccess',
            props: {
              items: params.items.length
            }
          })
        }
      }

      function showInProgressNotification () {
        if (params.operation === 'move') {
          notification = notifications.emit({name: 'moveDirItemsInProgress'})
        }
        else if (params.operation === 'copy') {
          notification = notifications.emit({name: 'copyDirItemsInProgress'})
        }
      }

      function onTransferSuccess () {
        showSuccessNotification()
        store.dispatch('RELOAD_DIR', {scrollTop: false})
        store.dispatch('CLEAR_FS_CLIPBOARD')
      }
    },
    async moveDirItems ({dispatch}, params) {
      params.operation = 'move'
      await dispatch('transferDirItems', params)
    },
    async copyDirItems ({dispatch}, params) {
      params.operation = 'copy'
      await dispatch('transferDirItems', params)
    },
    async RENAME_DIR_ITEM (store, payload) {
      const {oldPath, newPath, newName, oldName} = payload

      fs.promises.rename(oldPath, newPath)
        .then(() => {
          setTimeout(() => {
            eventHub.$emit('notification', {
              action: 'add',
              timeout: 8000,
              closeButton: true,
              title: 'Renamed 1 item',
              message: `
                <strong>Was</strong>: ${oldName}
                <br><strong>Now</strong>: ${newName}
              `,
              actionButtons: [
                {
                  title: i18n.t('undo'),
                  action: '',
                  onClick: () => {
                    fs.promises.rename(newPath, oldPath)
                      .then(() => {
                        notifications.emit({
                          name: 'renameSuccess',
                          props: {
                            message: oldPath
                          }
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
          if (error.code === 'EPERM') {
            notifications.emit({
              name: 'renameFailedAlreadyExistsOrLocked',
              props: {
                newName
              }
            })
          }
          if (error.code === 'ENOENT') {
            notifications.emit({
              name: 'renameFailedNoLongerExists',
              props: {
                oldPath
              }
            })
          }
          else {
            notifications.emit({
              name: 'renameFailedError',
              error
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
        const item = await dispatch('GET_DIR_ITEM_INFO', payload.path)
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
                title: i18n.t('cancel'),
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
            notificationConfig.message = `<strong>Destination path:</strong><br>${destPath}<br><strong>Error:</strong><br>${error}`
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
                notificationConfig.message = `<strong>Destination path:</strong><br>${destPath}`
                notificationConfig.timeout = 5000
                progress.isDone = true
              }
              else {
                notificationConfig.actionButtons = []
                // notificationConfig.actionButtons = [
                //   {
                //     title: i18n.t('undo'),
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
                notificationConfig.message = `<strong>Destination path:</strong><br>${destPath}`
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
        repo: state.storageData.settings.appPaths.githubRepo,
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
                  utils.openLink(state.storageData.settings.appPaths.githubLatestRelease)
                },
                closesNotification: true
              }
            ]
          })
        }
      })
    },
    HANDLE_APP_UPDATE_UNAVAILABLE (store, payload) {
      const {latestVersion, notifyUnavailable} = payload

      if (notifyUnavailable) {
        notifications.emit({
          name: 'updateUnavailable', 
          props: {
            state: store.state,
            utils,
            latestVersion
          }
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
            utils.openLink(state.storageData.settings.appPaths.githubChangelogLink)
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
          <strong>Current version:</strong> ${state.appVersion}
          <br><strong>Latest version:</strong> ${latestVersion}
        `,
        closeButton: true,
        actionButtons
      })
    },
    HANDLE_APP_UPDATE_DOWNLOADED (store, params) {
      const {latestVersion, info} = params
      notifications.hideByHashID(info.hashID)
      notifications.emit({
        name: 'updateWasDownloaded', 
        props: {
          store, 
          latestVersion, 
          info
        }
      })
      store.state.notifications = store.state.notifications.filter(item => item.type !== 'update-available')
    },
    DOWNLOAD_APP_UPDATE (store, params) {
      electron.ipcRenderer.send('download-file', {
        url: params.downloadLink,
        dir: store.state.storageData.settings.appPaths.updateDownloadDir,
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
          store.dispatch('OPEN_FILE', `${store.state.storageData.settings.appPaths.updateDownloadDir}/${info.filename}`)
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
              utils.openLink(state.storageData.settings.appPaths.githubChangelogLink)
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
        // or the loadDir action should check if the path is a symlink and
        // if so, load the realPath instead
        eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'switchTab',
          icon: 'mdi-tab',
          timeout: 1500,
          title: `Tab | ${tabItem.name}`,
          message: `Path: ${tabItem.path}`
        })
        await dispatch('loadDir', { path: tabItem.path })
      }
    },
    async addWorkspace ({state, dispatch}, workspace) {
      const workspaceItems = [...state.storageData.workspaces.items, ...[workspace]]
      try {
        await dispatch('SET', {key: 'storageData.workspaces.items', value: workspaceItems})
        notifications.emit({name: 'addWorkspace'})
      }
      catch (error) {
        notifications.emit({name: 'addWorkspaceError', props: {error}})
      }
    },
    async selectWorkspace ({state}, workspace) {
      state.storageData.workspaces.items.forEach(workspace => {
        workspace.isSelected = false
      })
      workspace.isSelected = true
    },
    async switchWorkspace ({dispatch, getters}, workspace) {
      dispatch('selectWorkspace', workspace)
      dispatch('syncWorkspaceStorageData')
      await dispatch('loadDir', { path: workspace.defaultPath })
      workspace.lastOpenedDir = workspace.defaultPath
      if (workspace.isPrimary) {
        notifications.emit({name: 'switchWorkspace', props: {
          defaultPath: workspace.defaultPath,
          name: workspace.name,
        }})
      }
      else if (!workspace.isPrimary) {
        let actionButtons = []
        let content = []
        if (workspace.actions.length > 0) {
          actionButtons = [
            {
              title: 'run all actions',
              onClick: () => {
                dispatch('runAllWorkspaceActions')
              },
              closesNotification: true
            },
            // TODO: finish in v1.2.0
            // {
            //   title: 'modify & run actions',
            //   onClick: () => {
            //     dispatch('MODIFY_AND_runWorkspaceActions')
            //   },
            //   closesNotification: true
            // }
          ]
          workspace.actions.forEach(action => {
            if (action.type.name === 'open-url') {
              action.onClick = () => {utils.openLink(action.command)}
            }
            else if (action.type.name === 'open-path') {
              action.onClick = () => {electron.shell.openPath(PATH.normalize(action.command))}
            }
            else if (action.type.name === 'terminal-command') {
              action.onClick = () => {dispatch('runCommandInTerminal', action)}
            }
          })
          content = [
            {
              type: 'action-list',
              value: workspace.actions,
            },
          ]
        }
        notifications.emit({name: 'switchWorkspace', props: {
          defaultPath: workspace.defaultPath,
          name: workspace.name,
          content,
          actionButtons
        }})
      }
    },
    runAllWorkspaceActions ({dispatch, getters}) {
      getters.selectedWorkspace.actions.forEach(action => {
        if (action.type.name === 'open-url') {
          utils.openLink(action.command)
        }
        else if (action.type.name === 'open-path') {
          electron.shell.openPath(PATH.normalize(action.command))
        }
        else if (action.type.name === 'terminal-command') {
          dispatch('runCommandInTerminal', action)
        }
      })
    },
    runCommandInTerminal ({}, params) {
      if (process.platform === 'win32') {
        if (params?.type?.options?.asAdmin) {
          childProcess.exec(`powershell -command "Start-Process ${params.command} -Verb RunAs"`)
        }
        else {
          childProcess.exec(`start ${params.command}`)
        }
      }
      else if (process.platform === 'linux') {
        const terminalPath = '/usr/bin/gnome-terminal'
        let terminal = childProcess.spawn(terminalPath, {cwd: item.path})
        terminal.on('error', (error) => {
          alert('Could not launch terminal: ', error)
        })
      }
    },
    setWorkspaces ({state, dispatch}, workspaces) {
      state.storageData.workspaces.items = workspaces
      dispatch('syncWorkspaceStorageData')
    },
    syncWorkspaceStorageData ({state, dispatch}) {
      dispatch('SET', {
        key: 'storageData.workspaces.items',
        value: state.storageData.workspaces.items
      })
    },
    CANCEL_FETCH_CURRENT_DIR_SIZE (store, payload = {}) {
      store.dispatch('CANCEL_FETCH_DIR_SIZE', store.state.navigatorView.selectedDirItems.at(-1))
    },
    async FETCH_CURRENT_DIR_SIZE (store, payload = {}) {
      return await store.dispatch('FETCH_DIR_SIZE', {
        item: store.state.navigatorView.selectedDirItems.at(-1),
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
    async GET_ITEMS_SIZE (store, payload) {
      return new Promise((resolve, reject) => {
        const taskHashID = utils.getHash()
        store.dispatch('ADD_TASK', {
          name: 'process::get-items-size',
          hashID: taskHashID,
          props: {
            items: payload.items,
            options: payload.options || {},
            timeoutObject: null
          }
        })
          .then((task) => {
            store.dispatch('INIT_GET_ITEMS_SIZE_PROCESS', task)
              .then((data) => {
                resolve(data)
                store.dispatch('REMOVE_TASK', task)
              })
          })
      })
    },
    INIT_GET_ITEMS_SIZE_PROCESS (store, task) {
      return new Promise((resolve, reject) => {
        try {store.state.childProcesses.getItemsSize.kill()}
        catch (error) {}
        // Schedule task cancelling, if needed
        clearTimeout(task.props.timeoutObject)
        if (task.props.options.timeout) {
          task.props.timeoutObject = setTimeout(() => {
            try {store.state.childProcesses.getItemsSize.kill()}
            catch (error) {}
            resolve({size: null})
          }, task.props.options.timeout)
        }
        store.state.childProcesses.getItemsSize = childProcess.fork(
          utils.getSrc('./src/processes/directorySizeProcess.js'),
          { silent: true }
        )
        store.state.childProcesses.getItemsSize.on('message', data => {
          clearTimeout(task.props.timeoutObject)
          // Delay setting data to avoid the unpleasant flash when
          // placeholder is removed almost immidiatelly after being set
          // setTimeout(() => {
            resolve(data)
          // }, 200)
        })
        store.state.childProcesses.getItemsSize.send({items: task.props.items})
      })
    },
    async FETCH_DIR_SIZE (store, payload) {
      return new Promise((resolve, reject) => {
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
            store.dispatch('INIT_DIR_SIZE_PROCESS', task)
              .then((data) => {
                resolve(data)
                store.dispatch('SET_DIRECTORY_SIZE', {
                  item: task.props.item,
                  size: data.size
                })
                store.dispatch('REMOVE_TASK', task)
              })
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
          utils.getSrc('./src/processes/directorySizeProcess.js'),
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
        path: state.navigatorView.selectedDirItems.at(-1).path
      }
      payload = {...defaultPayload, ...payload}

      if (getters.selectedDirItemsStats.fileCount > 0) {
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
