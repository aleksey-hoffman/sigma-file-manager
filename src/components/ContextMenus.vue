<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <v-menu
      id="context-menu--navigator"
      v-model="contextMenus.dirItem.value"
      transition="context-menu-transition"
      :position-x="contextMenus.dirItem.x"
      :position-y="contextMenus.dirItem.y"
      :close-on-content-click="false"
      offset-y
      offset-overflow
      absolute
    >
      <div class="context-menu__container fade-in-1s">
        <transition
          :name="contextMenus.dirItem.subMenu.value
            ? 'context-sub-menu-transition'
            : 'context-sub-menu-transition-reversed'"
          mode="out-in"
        >
          <div
            v-if="!contextMenus.dirItem.subMenu.value"
            key="mainMenu"
          >
            <v-list
              v-if="toolbarItems.length > 0"
              dense
            >
              <!-- context-menu::main-view::toolbar -->
              <div class="context-menu__toolbar">
                <v-tooltip
                  v-for="(item, index) in filteredList(toolbarItems)"
                  :key="'toolbar-item-' + index"
                  open-delay="200"
                  max-width="300px"
                  bottom
                >
                  <template #activator="{ on }">
                    <v-btn
                      class="context-menu__button"
                      :active="item.isActive"
                      icon
                      small
                      v-on="on"
                      @click.stop="runOnClickEvent(item)"
                    >
                      <div class="indicator" />
                      <v-icon :size="item.iconSize">
                        {{filteredIcon(item)}}
                      </v-icon>
                    </v-btn>
                  </template>
                  <span v-if="item.tooltip && item.tooltip.shortcutList">
                    <div
                      v-for="(shortcutItem, index) in item.tooltip.shortcutList"
                      :key="`shortcut-list-item-${index}`"
                      class="tooltip__shortcut-list-item"
                    >
                      <div class="tooltip__shortcut-list-item__title tooltip__description">
                        {{shortcutItem.title}}
                      </div>
                      <span
                        class="tooltip__shortcut-list__shortcut inline-code--light"
                        v-html="shortcutItem.shortcut"
                      />
                    </div>
                  </span>

                  <span v-if="item.tooltip && item.tooltip.modifierList">
                    <div
                      v-for="(modifierItem, index) in item.tooltip.modifierList"
                      :key="`modifier-list-item-${index}`"
                      class="tooltip__modifier-list-item"
                    >
                      <div class="tooltip__modifier-list-item__title tooltip__description">
                        <span
                          v-if="modifierItem.modifier"
                          class="tooltip__modifier-list__modifier inline-code--light"
                          v-html="modifierItem.modifier"
                        />
                        {{modifierItem.title}}
                      </div>
                      <div
                        v-if="!modifierItem.modifier"
                        class="tooltip__modifier-list__title tooltip__description"
                      >
                        Modifiers:
                      </div>
                    </div>
                  </span>

                  <span v-if="item.tooltip && !item.tooltip.shortcutList && !item.tooltip.modifierList">
                    <div class="tooltip__description">{{item.tooltip.title}}</div>
                    <div
                      class="tooltip__shortcut"
                      v-html="item.tooltip.text"
                    />
                  </span>
                </v-tooltip>
              </div>
            </v-list>

            <v-divider
              v-if="toolbarItems.length > 0"
            />

            <!-- context-menu::main-view::list -->
            <v-list dense>
              <v-tooltip
                v-for="(item, index) in filteredList(menuItems)"
                :key="'menu-item-' + index"
                :disabled="!item.tooltip"
                open-delay="200"
                bottom
              >
                <template #activator="{on}">
                  <v-list-item
                    v-on="on"
                    @click.stop="runOnClickEvent(item)"
                  >
                    <v-list-item-icon>
                      <v-icon :size="item.iconSize">
                        {{item.icon}}
                      </v-icon>
                    </v-list-item-icon>
                    <v-list-item-content>
                      <v-list-item-title>
                        {{item.title}}
                      </v-list-item-title>
                    </v-list-item-content>
                    <v-list-item-icon>
                      <v-icon
                        v-if="item.subMenu"
                        size="24px"
                        is-sub-menu
                      >
                        mdi-chevron-right
                      </v-icon>
                    </v-list-item-icon>
                  </v-list-item>
                </template>
                <span v-if="item.tooltip && item.tooltip.shortcutList">
                  <div
                    v-for="(shortcutItem, index) in item.tooltip.shortcutList"
                    :key="`shortcut-list-item-${index}`"
                    class="tooltip__shortcut-list-item"
                  >
                    <div class="tooltip__shortcut-list-item__title tooltip__description">
                      {{shortcutItem.title}}
                    </div>
                    <span
                      class="tooltip__shortcut-list__shortcut inline-code--light"
                      v-html="shortcutItem.shortcut"
                    />
                  </div>
                </span>
              </v-tooltip>
            </v-list>
          </div>

          <div
            v-if="contextMenus.dirItem.subMenu.value"
            key="subMenu"
          >
            <v-list dense>
              <!-- context-menu::sub-view::toolbar -->
              <div
                class="context-menu__toolbar"
                sub-menu
              >
                <v-tooltip
                  open-delay="200"
                  max-width="300px"
                  bottom
                >
                  <template #activator="{ on }">
                    <v-btn
                      class="context-menu__button"
                      icon
                      small
                      v-on="on"
                      @click.stop="contextMenus.dirItem.subMenu.value = false"
                    >
                      <v-icon>
                        mdi-arrow-left
                      </v-icon>
                    </v-btn>
                  </template>
                  <span>
                    <div class="tooltip__description">Go back to main menu</div>
                  </span>
                </v-tooltip>
                <v-spacer />
                <div>
                  {{contextMenus.dirItem.subMenu.title}}
                </div>
                <div v-if="contextMenus.dirItem.subMenu.target === 'open-with'">
                  <v-tooltip bottom>
                    <template #activator="{ on }">
                      <v-btn
                        style="right: -6px"
                        icon
                        v-on="on"
                        @click="
                          contextMenus.dirItem.value = false,
                          $store.state.dialogs.programEditorDialog.value = true
                        "
                      >
                        <v-icon size="18px">
                          mdi-pencil-outline
                        </v-icon>
                      </v-btn>
                    </template>
                    <span>Open program editor</span>
                  </v-tooltip>
                </div>
              </div>
            </v-list>
            <v-divider />

            <!-- context-menu::sub-view::list -->
            <div v-if="contextMenus.dirItem.subMenu.target === 'open-with'">
              <v-list dense>
                <v-list-item
                  class="item--add__button"
                  @click="
                    contextMenus.dirItem.value = false,
                    dialogs.programEditorDialog.value = true
                  "
                >
                  <v-list-item-title style="font-size: 15px">
                    <v-layout align-center>
                      <v-icon
                        size="24px"
                        class="mr-4"
                      >
                        mdi-plus
                      </v-icon>
                      Add program
                    </v-layout>
                  </v-list-item-title>
                </v-list-item>
              </v-list>

              <v-list dense>
                <!-- context-menu::sub-view::list:open-with:default-programs -->
                <v-list-item
                  v-for="program in externalProgramsDefaultItemsFiltered"
                  :key="program.title"
                  class="menu-item--open-with"
                  @click="handleDefaultExternalProgramAction(program)"
                >
                  <v-list-item-icon>
                    <v-icon>{{program.icon}}</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{program.name}}</v-list-item-title>
                  </v-list-item-content>
                </v-list-item>

                <!-- context-menu::sub-view::list:open-with:custom-programs -->
                <v-list-item
                  v-for="program in externalProgramsCustomItemsFiltered"
                  :key="program.title"
                  class="menu-item--open-with"
                  @click="handleCustomExternalProgramAction(program)"
                >
                  <v-list-item-icon>
                    <v-icon>{{program.icon}}</v-icon>
                  </v-list-item-icon>
                  <v-list-item-content>
                    <v-list-item-title>{{program.name}}</v-list-item-title>
                  </v-list-item-content>
                  <div class="menu-item--open-with__button">
                    <v-btn
                      v-show="!program.readonly"
                      class="mr-0"
                      icon
                      small
                      @click.stop="
                        contextMenus.dirItem.value = false,
                        dialogs.programEditorDialog.specifiedHashID = program.hashID
                        dialogs.programEditorDialog.value = true
                      "
                    >
                      <v-icon size="20px">
                        mdi-pencil-outline
                      </v-icon>
                    </v-btn>
                  </div>
                </v-list-item>
              </v-list>
            </div>
          </div>
        </transition>
      </div>
    </v-menu>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {shell} from 'electron'
const childProcess = require('child_process')
const PATH = require('path')

export default {
  mounted () {
    // Init listeners
    this.$eventHub.$on('openInTerminal', () => {
      this.$store.dispatch('OPEN_SELECTED_IN_TERMINAL', {asAdmin: false})
    })

    this.$eventHub.$on('openInTerminalAsAdmin', () => {
      this.$store.dispatch('OPEN_SELECTED_IN_TERMINAL', {asAdmin: true})
    })

    this.$eventHub.$on('openInNativeFileManager', () => {
      this.targetItems.forEach(item => {
        shell.showItemInFolder(PATH.normalize(item.path))
      })
    })
  },
  beforeDestroy () {
    this.$eventHub.$off('openInTerminal')
    this.$eventHub.$off('openInTerminalAsAdmin')
    this.$eventHub.$off('openInNativeFileManager')
  },
  watch: {
    'contextMenus.dirItem.value' (value) {
      if (!value) {
        this.contextMenus.dirItem.subMenu.value = false
      }
    },
  },
  computed: {
    ...mapFields({
      shortcuts: 'storageData.settings.shortcuts',
      inputState: 'inputState',
      contextMenus: 'contextMenus',
      dialogs: 'dialogs',
      pinnedItems: 'storageData.pinned.items',
      protectedItems: 'storageData.protected.items',
      externalProgramsDefaultItems: 'storageData.settings.externalPrograms.defaultItems',
      externalProgramsCustomItems: 'storageData.settings.externalPrograms.items',
    }),
    targetItems () {
      return this.$store.state.contextMenus.dirItem.targetItems
    },
    targetItemsStats () {
      return this.$store.state.contextMenus.dirItem.targetItemsStats
    },
    dirItemToolbarItems () {
      return [
        {
          title: 'protect',
          selectionType: ['single', 'multiple'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          isActive: false,
          onClick: () => {
            this.$store.dispatch('SET_PROTECTED')
          },
          icon: 'mdi-shield-alert-outline',
          iconSize: '20px',
          tooltip: {
            title: 'Protect item',
            text: `
              If enabled, the item will be added to the protected list. 
              It will be protected from being modified / deleted from within this app only.
              Other apps can still modify / delete it.
            `,
          },
        },
        {
          title: 'pin',
          selectionType: ['single', 'multiple'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          isActive: false,
          onClick: () => {
            this.$store.dispatch('SET_PINNED')
          },
          icon: 'mdi-pin-outline',
          iconSize: '20px',
          tooltip: {
            title: 'Add to pinned',
            text: 'Pinned items can be found on the dashboard page',
          },
        },
        {
          title: 'rename',
          selectionType: ['single'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          isActive: false,
          onClick: () => {
            this.dialogs.renameDirItemDialog.value = true
          },
          closesMenu: true,
          icon: 'mdi-form-textbox',
          iconSize: '20px',
          tooltip: {
            shortcutList: [
              {
                title: 'Rename selected',
                shortcut: this.shortcuts.renameSelected.shortcut,
              },
            ],
          },
        },
        {
          title: 'move',
          selectionType: ['single', 'multiple'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          isActive: false,
          onClick: () => {
            this.$store.dispatch('SET_TO_FS_CLIPBOARD', {type: 'move'})
          },
          closesMenu: true,
          icon: 'mdi-content-duplicate',
          iconSize: '18px',
          tooltip: {
            shortcutList: [
              {
                title: 'Set selected items for moving',
                shortcut: this.shortcuts.setDirItemsForMoving.shortcut,
              },
              {
                title: 'Add selected items for moving',
                shortcut: this.shortcuts.addDirItemsForMoving.shortcut,
              },
            ],
          },
        },
        {
          title: 'copy',
          selectionType: ['single', 'multiple'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          isActive: false,
          onClick: () => {
            this.$store.dispatch('SET_TO_FS_CLIPBOARD', {type: 'copy'})
          },
          closesMenu: true,
          icon: 'far fa-copy',
          iconSize: '18px',
          tooltip: {
            shortcutList: [
              {
                title: 'Set selected items for copying',
                shortcut: this.shortcuts.setDirItemsForCopying.shortcut,
              },
              {
                title: 'Add selected items for copying',
                shortcut: this.shortcuts.addDirItemsForCopying.shortcut,
              },
            ],
          },
        },
        {
          title: 'link',
          selectionType: ['single'],
          targetTypes: ['directory', 'file'],
          disallowedExtensions: ['lnk'],
          isActive: false,
          onClick: () => {
            let srcPath = this.targetItems[0].path
            let params = {
              title: '',
              destPath: srcPath,
            }
            let linkModifier = this.linkModifier
            if (linkModifier === 'windows-link') {
              params.title = 'Create Windows link (.lnk)'
              params.destPath = `${srcPath}.lnk`
            }
            else {
              params.title = 'Create symlink'
            }
            this.$store.dispatch('SHOW_CONFIRMATION_DIALOG_MAKE_LINK', params)
              .then(result => {
                let destPath = result.data.inputs[0].model
                if (linkModifier === 'windows-link') {
                  this.$store.dispatch('MAKE_DIR_ITEM_LINK', {
                    linkType: 'windows-link',
                    srcPath,
                    destPath,
                  })
                }
                else {
                  this.$store.dispatch('MAKE_DIR_ITEM_LINK', {
                    linkType: 'symlink',
                    srcPath,
                    destPath,
                  })
                }
              })
          },
          closesMenu: true,
          icon: this.linkActionIcon,
          iconSize: '22px',
          tooltip: this.linkActionTooltip,
        },
        {
          title: 'trash',
          selectionType: ['single', 'multiple'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          isActive: false,
          onClick: () => {
            if (this.inputState.shift) {
              this.$store.dispatch('DELETE_SELECTED_DIR_ITEMS')
            }
            else {
              this.$store.dispatch('TRASH_SELECTED_DIR_ITEMS')
            }
          },
          closesMenu: true,
          icon: this.inputState.shift
            ? 'mdi-delete-forever-outline'
            : 'mdi-trash-can-outline',
          iconSize: '22px',
          tooltip: {
            shortcutList: [
              {
                title: this.shortcuts.trashSelected.description,
                shortcut: this.shortcuts.trashSelected.shortcut,
              },
              {
                title: this.shortcuts.deleteSelected.description,
                shortcut: this.shortcuts.deleteSelected.shortcut,
              },
            ],
          },
        },
      ]
    },
    toolbarItems () {
      if (this.contextMenus.dirItem.targetType === 'userDir') {
        return []
      }
      else if (this.contextMenus.dirItem.targetType === 'drive') {
        return []
      }
      else {
        return this.dirItemToolbarItems
      }
    },
    dirItemMenuItems () {
      return [
        {
          name: 'open-with',
          title: 'Open with',
          subMenu: 'open-with',
          selectionType: ['single', 'multiple'],
          targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
          onClick: () => {
            this.openSubMenu('open-with')
          },
          closesMenu: false,
          icon: 'mdi-subdirectory-arrow-right',
          iconSize: '20px',
        },
        {
          name: 'quick-view',
          title: 'Quick view',
          selectionType: ['single'],
          targetTypes: ['file', 'file-symlink'],
          onClick: () => {
            this.$store.dispatch('OPEN_WITH_QUICK_VIEW')
          },
          closesMenu: true,
          icon: 'mdi-text-box-search-outline',
          iconSize: '18px',
          tooltip: {
            shortcutList: [
              {
                name: 'review file in a separate window',
                title: 'Preview file in a separate window',
                shortcut: this.shortcuts.openWithQuickView.shortcut,
              },
            ],
          },
        },
        {
          name: 'new-tab',
          title: 'Open in new tab',
          selectionType: ['single'],
          targetTypes: ['directory', 'directory-symlink'],
          onClick: () => {
            this.$store.dispatch('ADD_TAB')
          },
          closesMenu: true,
          icon: 'mdi-tab',
          iconSize: '18px',
        },
        {
          name: 'share-directory-with-local-devices',
          title: 'Share directory with local devices',
          targetTypes: ['directory', 'directory-symlink'],
          selectionType: ['single'],
          onClick: () => {
            this.$eventHub.$emit('fsLocalServerManager:method', {
              method: 'initLocalDirectoryShare',
            })
          },
          closesMenu: true,
          icon: 'mdi-folder-network-outline',
          iconSize: '18px',
        },
        {
          name: 'share-file-with-local-devices',
          title: 'Share file with local devices',
          targetTypes: ['file'],
          selectionType: ['single'],
          onClick: () => {
            this.$eventHub.$emit('fsLocalServerManager:method', {
              method: 'initLocalFileShare',
            })
          },
          closesMenu: true,
          icon: 'mdi-access-point-network',
          iconSize: '18px',
        },
        {
          name: 'compress-to-archive',
          title: 'Compress to archive',
          targetTypes: ['file', 'directory', 'file-symlink', 'directory-symlink'],
          selectionType: ['single', 'multiple'],
          onClick: () => {
            this.dialogs.archiverDialog.data.dest.name = 'Archive'
            this.dialogs.archiverDialog.value = true
          },
          closesMenu: true,
          icon: 'mdi-cube-outline',
          iconSize: '20px',
        },
        {
          name: 'extract-archive',
          title: 'Extract archive',
          targetTypes: ['file'],
          selectionType: ['single'],
          allowedFilesTypes: ['archive'],
          onClick: () => {
            this.$store.dispatch('EXTRACT_ARCHIVE', {source: 'target-items'})
          },
          closesMenu: true,
          icon: 'mdi-package-variant',
          iconSize: '20px',
        },
        {
          name: 'permissions',
          title: 'Permissions',
          targetTypes: ['file', 'directory'],
          selectionType: ['single'],
          onClick: () => {
            this.$store.dispatch('INIT_FETCH_CONTEXT_MENU_TARGET_ITEMS', {type: 'dirItem'})
            this.dialogs.dirItemPermissionManagerDialog.value = true
          },
          closesMenu: true,
          icon: 'mdi-lock-outline',
          iconSize: '18px',
        },
        // TODO: finish in v1.2.0
        // {
        //   name: 'convert-or-edit-image',
        //   title: 'Convert or edit image',
        //   targetTypes: ['file'],
        //   allowedFilesTypes: ['image'],
        //   selectionType: ['single'],
        //   onClick: {
        //     method: 'convertOrEditImage',
        //     params: {}
        //   },
        //   closesMenu: true,
        //   icon: 'mdi-swap-horizontal',
        //   iconSize: '23px'
        // },
        // {
        //   name: 'convert-or-edit-audio',
        //   title: 'Convert or edit audio',
        //   targetTypes: ['file'],
        //   allowedFilesTypes: ['audio'],
        //   selectionType: ['single'],
        //   onClick: {
        //     method: 'convertOrEditAudio',
        //     params: {}
        //   },
        //   closesMenu: true,
        //   icon: 'mdi-swap-horizontal',
        //   iconSize: '23px'
        // },
        // {
        //   name: 'convert-or-edit-video',
        //   title: 'Convert or edit video',
        //   targetTypes: ['file'],
        //   allowedFilesTypes: ['video'],
        //   selectionType: ['single'],
        //   onClick: {
        //     method: 'convertOrEditVideo',
        //     params: {}
        //   },
        //   closesMenu: true,
        //   icon: 'mdi-swap-horizontal',
        //   iconSize: '23px'
        // },
        // {
        //   name: 'calculate-hash',
        //   title: 'Calculate hash',
        //   selectionType: ['single'],
        //   targetTypes: ['file', 'file-symlink'],
        //   onClick: {
        //     method: 'calculateHash',
        //     params: {}
        //   },
        //   closesMenu: true,
        //   icon: 'mdi-memory',
        //   iconSize: '22px'
        // }
      ]
    },
    menuItems () {
      if (this.contextMenus.dirItem.targetType === 'userDir') {
        return [
          ...this.dirItemMenuItems,
          ...[
            {
              title: 'Edit card',
              selectionType: ['single'],
              targetTypes: ['directory', 'file', 'file-symlink', 'directory-symlink'],
              onClick: () => {
                this.dialogs.userDirectoryEditorDialog.data = this.contextMenus.dirItem.targetData
                this.dialogs.userDirectoryEditorDialog.value = true
              },
              closesMenu: false,
              icon: 'mdi-pencil-outline',
              iconSize: '20px',
            },
          ],
        ]
      }
      else if (this.contextMenus.dirItem.targetType === 'drive') {
        return [
          ...this.dirItemMenuItemsDriveFiltered,
        ]
      }
      else {
        return this.dirItemMenuItems
      }
    },
    dirItemMenuItemsDriveFiltered () {
      return this.dirItemMenuItems
        .filter(item => item.name !== 'permissions')
    },
    externalProgramsDefaultItemsFiltered () {
      const itemsFilteredByItemType = this.filterAllowedTargetTypes(this.externalProgramsDefaultItems)
      return itemsFilteredByItemType
    },
    externalProgramsCustomItemsFiltered () {
      const itemsFilteredByAllowed = this.externalProgramsCustomItems.filter(customProgram => {
        // 1. Filter matched by allowed item type
        const everyAllowedTypeMatchDirItemTypes = this.targetItemsStats.types.every(selectionType => {
          return customProgram.targetTypes.includes(selectionType)
        })
        // 2. Filter matched by allowed file type
        const everyAllowedTypeMatchFileTypes = this.targetItemsStats.fileExtensions.every(listExtension => {
          return customProgram.selectedAllowedFileTypes.some(type => {
            return type.replace(/type:/, '') === this.$utils.getFileType(listExtension, 'extension').mimeDescription
          })
        })
        // 3. Filter matched by allowed ext
        const everyDirItemMatchAllowedExtensions = this.targetItemsStats.fileExtensions.every(listExtension => {
          return customProgram.selectedAllowedFileTypes.includes(listExtension)
        })
        return everyAllowedTypeMatchDirItemTypes && (everyAllowedTypeMatchFileTypes || everyDirItemMatchAllowedExtensions)
      })
      // 4. Filter matched by disallowed ext
      const itemsFilteredByDisallowed = itemsFilteredByAllowed.filter(customProgram => {
        const everyDirItemMatchDisallowedExtensions = this.targetItemsStats.fileExtensions.every(listExtension => {
          return !customProgram.selectedDisallowedFileTypes.includes(listExtension)
        })
        return everyDirItemMatchDisallowedExtensions
      })
      return itemsFilteredByDisallowed
    },
    linkModifier () {
      if (this.inputState.alt) {
        return 'windows-link'
      }
      else {
        return 'symlink'
      }
    },
    linkActionIcon () {
      if (process.platform === 'win32') {
        return this.linkModifier === 'windows-link'
          ? 'mdi-link-box-variant-outline'
          : 'mdi-link-variant-plus'
      }
      else {
        return this.linkModifier === 'hard-link'
          ? 'mdi-link-plus'
          : 'mdi-link-variant-plus'
      }
    },
    linkActionTooltip () {
      let tooltip = {
        modifierList: [
          {
            title: 'Create symbolic link',
          },
        ],
      }
      if (process.platform === 'win32') {
        tooltip.modifierList.push({
          title: 'Windows link (.lnk)',
          modifier: 'Alt',
        })
      }
      return tooltip
    },
  },
  methods: {
    filteredList (list) {
      const itemsFilteredBySelectionType = this.filterItemSelectionType(list)
      const itemsFilteredByItemType = this.filterAllowedTargetTypes(itemsFilteredBySelectionType)
      const itemsFilteredByAllowedFileType = this.filterAllowedFileTypes(itemsFilteredByItemType)
      const itemsFilteredByDisallowedFileType = this.filterDisallowedFileTypes(itemsFilteredByAllowedFileType)
      return itemsFilteredByDisallowedFileType
    },
    filteredIcon (item) {
      if (item.title === 'pin') {
        const someItemIsPinned = this.targetItems.every(selectedItem => {
          return this.pinnedItems.some(pinnedItem => pinnedItem.path === selectedItem.path)
        })
        item.isActive = someItemIsPinned
        return item.icon
      }
      else if (item.title === 'protect') {
        const someItemIsProtected = this.targetItems.every(selectedItem => {
          return this.protectedItems.some(protectedItem => protectedItem.path === selectedItem.path)
        })
        item.isActive = someItemIsProtected
        return item.icon
      }
      else {
        return item.icon
      }
    },
    filterItemSelectionType (list) {
      const filtered = list.filter(menuItem => {
        return menuItem.selectionType.includes(this.targetItemsStats.selectionType)
      })
      return filtered
    },
    filterAllowedFileTypes (list) {
      const selectionStats = this.targetItemsStats
      const filteredList = list.filter(menuItem => {
        if (menuItem.allowedFilesTypes) {
          const condition1 = menuItem.allowedFilesTypes.every(type => {
            return selectionStats.fileTypesReadable.includes(type)
          })
          return condition1
        }
        else {
          return true
        }
      })
      return filteredList
    },
    filterDisallowedFileTypes (list) {
      const selectionStats = this.targetItemsStats
      let filteredList = list.filter(menuItem => {
        if (menuItem.disallowedFileTypes) {
          const includesDisallowedFileTypes = menuItem.disallowedFileTypes.some(type => {
            return selectionStats.fileTypesReadable.includes(type)
          })
          return !includesDisallowedFileTypes
        }
        else {
          return true
        }
      })
      // Filter out disallowed file extensions
      filteredList = filteredList.filter(menuItem => {
        if (menuItem.disallowedExtensions) {
          const includesDisallowedExtensions = menuItem.disallowedExtensions.some(ext => {
            return selectionStats.fileExtensions.includes(ext)
          })
          return !includesDisallowedExtensions
        }
        else {
          return true
        }
      })
      return filteredList
    },
    filterAllowedTargetTypes (list) {
      // If target type is selected but is not acceptable target, remove it
      return list.filter(menuItem => {
        const hasAllowedTypes = this.targetItemsStats.types.some(type => {
          return menuItem.targetTypes.includes(type)
        })
        return hasAllowedTypes
      })
    },
    openSubMenu (name) {
      let title = ''
      if (name === 'open-with') {title = 'Open with'}
      else if (name === 'edit-tags') {title = 'Edit tags'}
      this.contextMenus.dirItem.subMenu.target = name
      this.contextMenus.dirItem.subMenu.title = title
      this.contextMenus.dirItem.subMenu.value = true
      this.adjustMenuPositionToSubMenu()
    },
    adjustMenuPositionToSubMenu () {
      // Wait for submenu transition to finish and then reposition the menu
      const winSize = this.$store.state.windowSize
      const margin = 12
      setTimeout(() => {
        const menuNode = document.querySelector('.context-menu__container')
        const menuNodeOverflows = this.contextMenus.dirItem.y + menuNode.offsetHeight + margin > winSize.y
        if (menuNodeOverflows) {
          this.contextMenus.dirItem.y = winSize.y - menuNode.offsetHeight - margin
        }
      }, 250)
    },
    runOnClickEvent (item) {
      if (typeof item.onClick === 'function') {
        item.onClick()
      }
      else if (typeof item.onClick === 'object') {
        // Call specified onClick method
        let method = item.onClick.method
        if (item.onClick.modifierMethod?.ctrl && this.inputState.ctrl) {
          method = item.onClick.modifierMethod.ctrl
        }
        else if (item.onClick.modifierMethod?.alt && this.inputState.alt) {
          method = item.onClick.modifierMethod.alt
        }
        else if (item.onClick.modifierMethod?.shift && this.inputState.shift) {
          method = item.onClick.modifierMethod.shift
        }
        this.$eventHub.$emit('app:method', {
          method: method,
          params: item.onClick.params,
        })
      }
      if (item.closesMenu) {
        this.contextMenus.dirItem.value = false
      }
    },
    handleDefaultExternalProgramAction (program) {
      try {
        program.action()
      }
      catch (error) {
        throw Error(error)
      }
      this.contextMenus.dirItem.value = false
    },
    handleCustomExternalProgramAction (program) {
      // Get string of paths for the command
      const paths = this.targetItemsStats.dirItemsPaths.map((path) => {
        return `"${path}"`
      }).join(' ')
      const args = ''
      const command = `"${program.path}" ${paths} "${args}"`
      childProcess.exec(
        command,
        (error, stdout, stderr) => {
          if (error) {
            this.$eventHub.$emit('notification', {
              action: 'update-by-type',
              type: 'error:search-file-problem',
              timeout: 8000,
              closeButton: true,
              title: 'Error: couldn\'t open the program:',
              message: error,
            })
          }
        },
      )
      this.contextMenus.dirItem.value = false
    },
  },
}
</script>

<style>
.context-menu__container {
  min-width: 220px;
}

.context-menu__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  height: 48px;
  gap: 12px;
}

.context-menu__toolbar[sub-menu] {
  gap: 8px
}

.context-menu__container
  .menu-item--open-with__button {
    transition: all 0.25s;
    opacity: 0
  }

.context-menu__container
  .menu-item--open-with:hover
    .menu-item--open-with__button {
      opacity: 1 !important;
    }

.context-menu__container
  .item--add__button {
    background-color: rgb(255, 255, 255, 0.05)
  }

.context-menu__container
  .item--add__button
    .v-icon {
      color: rgb(255, 255, 255, 0.5) !important
    }

.context-menu__container
  .item--add__button:hover
    .item--add__button {
      opacity: 1 !important;
    }

.context-menu__button {
  margin: 0;
}

.context-menu__button
  .v-icon {
    color: var(--icon-color-2) !important
  }

.context-menu__button[active] .indicator {
  width: 12px;
  height: 2px;
  position: absolute;
  bottom: -4px;
  background-color: rgba(76, 167, 157, 0.7);
  box-shadow: 0px 0px 4px rgb(0, 150, 136, 1);
  transition: all 1s;
}
</style>
