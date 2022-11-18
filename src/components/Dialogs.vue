<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <!-- dialog::errorDialog -->
    <dialog-generator
      :dialog="dialogs.errorDialog"
      :persistent="true"
      :close-button="{
        onClick: () => closeDialog('errorDialog'),
      }"
      :action-buttons="[
        {
          text: 'create template',
          onClick: () => createNewErrorIssue()
        },
        {
          text: 'reload app',
          onClick: () => $utils.reloadMainWindow()
        },
        {
          text: 'ignore',
          onClick: () => closeDialog('errorDialog')
        }
      ]"
      title="Error occured"
      height="80vh"
    >
      <template #content>
        <p>
          You can ignore the error and keep using the app, but it might not function properly until you reload it.
        </p>
        <div class="text--sub-title-1">
          Report the error
        </div>
        <p>
          If you have a Github account, you can report this error to get it fixed:
        </p>
        <ul>
          <li>Press the button below to create the issue template automatically;</li>
          <li>Open the generated link in your browser;</li>
          <li>Review the template and make sure the error doesn't contain any personal information (e.g. your user name);</li>
          <li>Publish the issue by pressing "Submit new issue" button there</li>
        </ul>
        <div class="text--sub-title-1">
          Error
        </div>
        <div class="code-block mb-8">
          {{errorDialogErrorMessage}}
        </div>
      </template>
    </dialog-generator>

    <!-- dialog::conformationDialog -->
    <dialog-generator
      :dialog="dialogs.conformationDialog"
      :persistent="true"
      :close-button="{
        onClick: () => handleConformationDialogCloseButton()
      }"
      :inputs="dialogs.conformationDialog.data.inputs"
      :action-buttons="dialogs.conformationDialog.data.buttons"
      :title="dialogs.conformationDialog.data.title"
      :title-icon="dialogs.conformationDialog.data.titleIcon"
      :content="dialogs.conformationDialog.data.content"
      :height="dialogs.conformationDialog.data.height || 'unset'"
    >
      <template #content>
        <div
          v-if="dialogs.conformationDialog.data.message"
          v-html="dialogs.conformationDialog.data.message"
        />
      </template>
    </dialog-generator>

    <!-- dialog::guideDialog -->
    <dialog-generator
      :dialog="dialogs.guideDialog"
      :close-button="{
        onClick: () => closeDialog('guideDialog'),
      }"
      title="App guide"
      max-width="90vw"
      height="85vh"
      fade-mask-bottom="8%"
    >
      <template #content>
        <div class="tab-view">
          <v-tabs
            v-model="dialogs.guideDialog.data.guideTabsSelected"
            class="tab-view__header"
            show-arrows="mobile"
            :vertical="windowSize.x > 700"
            :height="windowSize.x > 700 ? '' : '42'"
          >
            <v-tab
              v-for="(tab, index) in dialogs.guideDialog.data.guideTabs"
              :key="index"
              :style="{
                'border': tab.text === 'COMING SOON' ? '3px dotted var(--highlight-color-3)' : 'none',
              }"
            >
              {{tab.text}}
            </v-tab>
          </v-tabs>

          <v-tabs-items
            v-model="dialogs.guideDialog.data.guideTabsSelected"
            class="tab-view__header__content mb-6"
          >
            <!-- tab:shorcuts -->
            <v-tab-item
              transition="fade-in"
              reverse-transition="fade-in"
            >
              <div class="text--title-1 mb-1">
                {{getGuideTitle(dialogs.guideDialog.data.guideTabsSelected)}}
              </div>
              <v-divider class="divider-color-2 mb-4" />

              <shortcut-list />

              <h3>About</h3>
              <p>
                Most actions within the app can be performed with shortcuts (different keyboard key combinations).
                Even the app itself can be opened / focused with a global (system wide) customizable shortcut.
              </p>
              <p>
                This feature lets you work more efficiently and makes the process more enjoyable
                (e.g. you can instantly open the app and create a new note with just 1 shortcut).
              </p>
              <p>
                Press
                <span class="inline-code--light mx-1">
                  {{shortcuts.shortcutsDialog.shortcut}}
                </span>
                button on the keyboard or the
                <v-icon
                  class="mx-1"
                  size="18px"
                >
                  mdi-pound
                </v-icon>
                button in the top toolbar to show the full list of shortcuts.
              </p>
              <div class="text--title-2 mt-2">
                Examples
              </div>
              <div class="text--sub-title-1 mt-2">
                Focus app
              </div>
              When this app is not focused, press
              <span class="inline-code--light mx-1">
                {{shortcuts.toggleApp.shortcut}}
              </span>
              to focus it (bring it to the foreground). Press the shortcut again to hide the app.
              <div class="text--sub-title-1 mt-6">
                Create new note
              </div>
              Press
              <span class="inline-code--light mx-1">
                {{shortcuts.newNote.shortcut}}
              </span>
              to focus this app, immidiately create a new note, and open the note editor for you.
              <div class="text--sub-title-1 mt-6">
                Switch tab
              </div>
              When this app is focused and you have some tabs opened in the current workspace, press
              <span class="inline-code--light mx-1">
                {{shortcuts.switchTab.shortcut}}
              </span>
              to open specified tab.
            </v-tab-item>

            <!-- tab:introduction -->
            <v-tab-item
              transition="fade-in"
              reverse-transition="fade-in"
            >
              <div class="text--title-1 mb-1">
                {{getGuideTitle(dialogs.guideDialog.data.guideTabsSelected)}} 🐒
              </div>
              <v-divider class="divider-color-2 mb-4" />
              <h3>Get involved</h3>
              <p>
                There are many ways to participate in the development of this app:
                <br />You can join the community, publish a feature request, report a problem, open a new discussion,
                improve the code yourself on the Github page of this project:
              </p>
              <div class="button-container dialogs--guide__header__buttons mb-4">
                <v-tooltip
                  v-for="(item, index) in guideHeaderButtons"
                  :key="'header-button-' + index"
                  bottom
                >
                  <template #activator="{ on }">
                    <v-btn
                      class="button-1"
                      depressed
                      small
                      v-on="on"
                      @click="$utils.openLink(item.link)"
                    >
                      <v-icon
                        v-if="item.icon"
                        class="mr-2"
                        size="16px"
                      >
                        {{item.icon}}
                      </v-icon>
                      {{item.title}}
                    </v-btn>
                  </template>
                  <span>
                    <v-layout align-center>
                      <v-icon
                        class="mr-3"
                        size="16px"
                      >
                        mdi-open-in-new
                      </v-icon>
                      {{item.link}}
                    </v-layout>
                  </span>
                </v-tooltip>
              </div>

              <p>
                You can also get rewards by supporting the project:
              </p>

              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-btn
                    class="button-1"
                    depressed
                    small
                    v-on="on"
                    @click="$utils.openLink(item.link)"
                  >
                    Join community
                  </v-btn>
                </template>
                <span>
                  <v-layout align-center>
                    <v-icon
                      class="mr-3"
                      size="16px"
                    >
                      mdi-open-in-new
                    </v-icon>
                    {{appPaths.githubReadmeSupportSectionLink}}
                  </v-layout>
                </span>
              </v-tooltip>

              <h3>Potential errors</h3>
              <p>
                The app is currently in early development (prototyping) stage, so expect to see
                the problems listed below.
              </p>
              <p>
                If the app encounters an error, it will automatically generate the report (a link),
                show it you, and offer to publish it on the project's page on Github.
              </p>
              <h3>Potential problems</h3>
              <ul>
                <li>
                  The next updates might overwrite (delete) some of the app's user settings
                  (like shortcuts, pinned items, etc). So you might need to setup those
                  multiple times during the yearly stages of development.
                </li>
                <li>
                  Expect to see some errors and performance issues in the first versions of the app.
                  I will be fixing the problems gradually as they get reported by the users.
                </li>
                <li>
                  The app hasn't been thoroughly tested yet. It shouldn't delete or damage any data
                  on your computer by itself (except the app settings), but it's recommended
                  to backup all of your important data to an external backup drive
                  (a drive that's disconnected from the computer most of the time)
                  or to cloud storage before installing and using this app.
                </li>
                <li>
                  The app has not been optimized yet, RAM usage can spike and go over 1 GB in some cases,
                  for example, when you're scrolling through a directory containing large images.
                  So, for now, avoid using the app on low-tier computers (i.e. computers with 4 GB of RAM or less).
                </li>
              </ul>
            </v-tab-item>

            <!-- tab:navigator tips -->
            <v-tab-item
              transition="fade-in"
              reverse-transition="fade-in"
            >
              <div class="text--title-1 mb-1">
                {{getGuideTitle(dialogs.guideDialog.data.guideTabsSelected)}}
              </div>
              <v-divider class="divider-color-2 mb-4" />

              <h3>Range item selection</h3>
              <div>
                To select multiple directory items,
                <span class="inline-code--light">Hold [Shift] + LClick</span>
                to select the <span class="inline-code--light">start</span>
                item, then move the cursor to the
                <span class="inline-code--light">end</span> item and
                press <span class="inline-code--light">LClick</span> on it to select the range.
              </div>
              <img
                class="mt-4"
                src="../assets/guide/navigator-list-highlight-1.png"
              />

              <h3>Single item selection</h3>
              <div>
                To select a single directory item, press
                <span class="inline-code--light">Ctrl + LClick</span>
                on the item to select it.
              </div>

              <h3>Keyboard item navigation</h3>
              <div>
                <ul>
                  <li>
                    To move selection to the next item press
                    <span class="inline-code--light">{{shortcuts.navigateDirDown.shortcut}}</span>
                    or
                    <span class="inline-code--light">{{shortcuts.navigateDirRight.shortcut}}</span>
                    (grid layout only)
                  </li>
                  <li>
                    To move selection to the previous item press
                    <span class="inline-code--light">{{shortcuts.navigateDirUp.shortcut}}</span>
                    or
                    <span class="inline-code--light">{{shortcuts.navigateDirLeft.shortcut}}</span>
                    (grid layout only)
                  </li>
                  <li>
                    To open current directory press
                    <span class="inline-code--light">{{shortcuts.openSelectedDirectory.shortcut}}</span>
                  </li>
                  <li>
                    To quit current directory press
                    <span class="inline-code--light">{{shortcuts.quitSelectedDirectory.shortcut}}</span>
                  </li>
                  <li>
                    Go to previous directory in history
                    <span class="inline-code--light">{{shortcuts.goToPreviousDirectory.shortcut}}</span>
                  </li>
                  <li>
                    Go to next directory in history
                    <span class="inline-code--light">{{shortcuts.goToNextDirectory.shortcut}}</span>
                  </li>
                  <li>
                    Go up directory
                    <span class="inline-code--light">{{shortcuts.goUpDirectory.shortcut}}</span>
                  </li>
                </ul>
              </div>
            </v-tab-item>

            <!-- tab:data-protection -->
            <v-tab-item
              transition="fade-in"
              reverse-transition="fade-in"
            >
              <div class="text--title-1 mb-1">
                {{getGuideTitle(dialogs.guideDialog.data.guideTabsSelected)}}
              </div>
              <v-divider class="divider-color-2 mb-4" />
              <p>
                The main purpose of this feature is to provide an ability to protect important files / directories from being accessed and modified (read / write / delete / rename / etc.).
              </p>
              <p>
                The protection is achieved by setting certain file attributes to 'deny' state. It does not encrypt the data. Protected files can still be read / modified when the attributes are removed.
              </p>
              <p>
                It's a good way to prevent yourself and different apps from accidentaly / purposefully modifying important files. It might even help to protect your data from unsophisticate malicious software.
              </p>

              <h3>Modes</h3>

              <div class="mt-4">
                <ul>
                  <li class="mb-2">
                    "Simple mode" protects specified items (files / directories) from modification only from within this app. The items can still be read and modified from any other program.
                  </li>
                  <li>
                    "Advanced mode" is targeted for advanced users. It allows you to manually set different attributes for specified items.
                  </li>
                  <li>
                    "Immutable mode" is a quick way to protect a file / dreictory by making it immutable. When enabled, the system will set all attributes of the specified file / directory to 'denied' state, and make it immutable (which means programs will not be able to read / write / modify / delete it without reseting the attributes).
                  </li>
                </ul>
                <div class="mt-4">
                  ⚠ <strong>Warning</strong>
                  <br />
                  Use with caution. The "Advanced mode" and "Immutable mode" are still in early development.
                  The feature hasn't been thoroughly tested yet. Theoretically it can lock
                  a file / directory in a way that will make it impossible for you to ever access its contents.
                  Make sure to test this feature on some test files / directories before
                  using it on important data. And report the problems if you find any by creating a issue on the project's Github page.
                </div>
              </div>
            </v-tab-item>

            <!-- tab:address bar -->
            <v-tab-item
              transition="fade-in"
              reverse-transition="fade-in"
            >
              <div class="text--title-1 mb-1">
                {{getGuideTitle(dialogs.guideDialog.data.guideTabsSelected)}}
              </div>
              <v-divider class="divider-color-2 mb-4" />
              <img
                class="mt-0"
                src="../assets/guide/address-bar-1.png"
              />
              Address bar allows you to navigate directories and files by typing their path.
              <h3>Features</h3>
              <ul>
                <li>
                  <strong>Quick navigation:</strong>
                  it will automatically open the directories,
                  as you type their address (manually or with autocomplete)
                </li>
                <li>
                  <strong>Quick file opening:</strong>
                  to open the specified file, press enter
                </li>
                <li>
                  <strong>Autocomplete:</strong>
                  press
                  <span class="inline-code--light">tab</span>
                  or
                  <span class="inline-code--light">Shift + tab</span>
                  to autocomplete / iterate directory item names.
                </li>
                <li>
                  <strong>Quotes not needed:</strong>
                  names that have spaces in them don't need to be wrapped with quotes
                </li>
                <li>
                  <strong>Follows standards:</strong>
                  on Windows OS, all backward slashes
                  <span class="inline-code--light">\</span>
                  are automatically converted to forward slashes
                  <span class="inline-code--light">/</span>
                  to provide a seamless standartized workflow
                </li>
              </ul>
              <h3>Where to find it</h3>
              Address bar can be opened from any page with the shortcut:
              <span class="inline-code--light">
                {{shortcuts.focusAddressBar.shortcut}}
              </span>
              or by pressing
              <span class="inline-code--light">Type in address manually</span>
              button in the address bar menu, which is located on the action bar on the "Navigator" page.
              <img src="../assets/guide/address-bar-2.png" />
            </v-tab-item>

            <!-- tab:coming soon -->
            <v-tab-item
              transition="fade-in"
              reverse-transition="fade-in"
            >
              <div class="text--title-1 mb-1">
                {{getGuideTitle(dialogs.guideDialog.data.guideTabsSelected)}}
              </div>
              <v-divider class="divider-color-2 mb-4" />
              More guides will be added in future updates
            </v-tab-item>
          </v-tabs-items>
        </div>
      </template>
    </dialog-generator>

    <!-- dialog::shortcutEditorDialog -->
    <dialog-generator
      :dialog="dialogs.shortcutEditorDialog"
      :close-button="{
        onClick: () => closeDialog('shortcutEditorDialog'),
      }"
      :action-buttons="[
        {
          text: 'Cancel',
          onClick: () => closeDialog('shortcutEditorDialog')
        },
        {
          text: 'Change shortcut',
          disabled: !dialogs.shortcutEditorDialog.data.isValid,
          onClick: () => {
            $store.dispatch('SET_SHORTCUT', {
              shortcutName: dialogs.shortcutEditorDialog.data.shortcutName,
              shortcut: dialogs.shortcutEditorDialog.data.shortcut
            })
              .then(() => {
                dialogs.shortcutEditorDialog.value = false
              })
          }
        }
      ]"
      title="Shortcut editor"
      max-width="500px"
    >
      <template #content>
        <v-tooltip
          bottom
          open-delay="200"
          max-width="300px"
        >
          <template #activator="{ on }">
            <div v-on="on">
              <v-text-field
                v-model="dialogs.shortcutEditorDialog.data.shortcut"
                :error="!dialogs.shortcutEditorDialog.data.isValid"
                :hint="dialogs.shortcutEditorDialog.data.error"
                placeholder="Shortcut"
                @keydown="$store.dispatch('SET_SHORTCUT_KEYDOWN_HANDLER', {
                  event: $event,
                  shortcut: dialogs.shortcutEditorDialog.data.shortcut,
                  shortcutName: dialogs.shortcutEditorDialog.data.shortcutName
                })"
              />
            </div>
          </template>
          <span>
            A shortcut is a combination of:
            <br />- 1-4 modifier keys: [Ctrl, Alt, Shift, Meta]
            <br />- 1 regular key
            <br /><strong>Examples:</strong>
            <br />Ctrl + Shift + Space
            <br />Ctrl + F1
            <br />Meta + Esc
          </span>
        </v-tooltip>
      </template>
    </dialog-generator>

    <!-- dialog::renameDirItemDialog -->
    <dialog-generator
      :dialog="dialogs.renameDirItemDialog"
      :close-button="{
        onClick: () => closeDialog('renameDirItemDialog'),
      }"
      :action-buttons="[
        {
          text: 'cancel',
          onClick: () => closeDialog('renameDirItemDialog')
        },
        {
          text: 'save',
          disabled: !dialogs.renameDirItemDialog.data.isValid,
          onClick: () => initDirItemRename()
        }
      ]"
      title="Rename item"
      height="unset"
    >
      <template #content>
        <div>
          <span style="font-weight: bold">Current name:</span>
          {{editTargets[0].name}}
        </div>

        <!-- input::dir-item-new-name -->
        <v-text-field
          id="renameItemDialogNameInput"
          ref="renameItemDialogNameInput"
          v-model="dialogs.renameDirItemDialog.data.name"
          label="New name"
          :value="dialogs.renameDirItemDialog.data.name"
          :error="!dialogs.renameDirItemDialog.data.isValid"
          :hint="dialogs.renameDirItemDialog.data.error"
          autofocus
          @input="validateRenameDirItemInput()"
          @keypress.enter="initDirItemRename()"
        />
      </template>
    </dialog-generator>

    <!-- dialog::newDirItemDialog -->
    <dialog-generator
      :dialog="dialogs.newDirItemDialog"
      :close-button="{
        onClick: () => closeDialog('newDirItemDialog'),
      }"
      :action-buttons="[
        {
          text: 'cancel',
          onClick: () => closeDialog('newDirItemDialog')
        },
        {
          text: 'create',
          disabled: !dialogs.newDirItemDialog.data.isValid,
          onClick: () => createDirItem()
        }
      ]"
      :title="`Create new ${dialogs.newDirItemDialog.data.type}`"
      height="unset"
    >
      <template #content>
        <div>
          <span style="font-weight: bold">Path:</span>
          {{newDirItemPath}}
        </div>

        <!-- input::dir-item-name -->
        <v-text-field
          ref="newDirItemDialogNameInput"
          v-model="dialogs.newDirItemDialog.data.name"
          :label="`New ${dialogs.newDirItemDialog.data.type} name`"
          :value="dialogs.newDirItemDialog.data.name"
          :error="!dialogs.newDirItemDialog.data.isValid"
          :hint="dialogs.newDirItemDialog.data.error"
          autofocus
          @input="validateNewDirItemInput()"
          @keypress.enter="createDirItem()"
        />
      </template>
    </dialog-generator>

    <!-- dialog::dirItemPermissionManagerDialog -->
    <dialog-generator
      :dialog="dialogs.dirItemPermissionManagerDialog"
      :close-button="{
        onClick: () => closeDialog('dirItemPermissionManagerDialog'),
      }"
      title="Permissions"
      height="unset"
      fade-mask-bottom="0%"
    >
      <template #content>
        <div class="mb-4">
          <!-- ⚠ <strong>Warning:</strong> experimental feature, use with caution. -->
          ⚠ Experimental, unfinished feature.
        </div>
        <div>
          <div>
            <span style="font-weight: bold">Path:</span>
            {{dialogs.dirItemPermissionManagerDialog.data.dirItem.path}}
          </div>
          <div>
            <span style="font-weight: bold">Owner:</span>
            {{dialogs.dirItemPermissionManagerDialog.data.permissionData.owner}}
          </div>
          <div>
            <span style="font-weight: bold">Read-only:</span>
            {{$utils.getItemPermissions(dialogs.dirItemPermissionManagerDialog.data.dirItem).isReadOnly}}
          </div>
          <div>
            <span style="font-weight: bold">Protected (app scope):</span>
            {{targetItemsIncludeProtected}}
          </div>
          <div>
            <span style="font-weight: bold">Permissions:</span>
            {{$utils.getItemPermissions(dialogs.dirItemPermissionManagerDialog.data.dirItem).permissions}}
          </div>
        </div>

        <!-- TODO: finish in v1.1.0 -->
        <!-- input-switch::immutable -->
        <div v-if="false">
          <v-tooltip
            bottom
            max-width="300px"
          >
            <template #activator="{ on }">
              <div
                class="d-inline-flex"
                v-on="on"
              >
                <v-switch
                  class="mb-4"
                  :value="dialogs.dirItemPermissionManagerDialog.data.permissionData.isImmutable"
                  label="Immutable"
                  hide-details
                  @change="setDirItemImmutableState()"
                />
              </div>
            </template>
            <span>
              If enabled, the item becomes immutable
              (cannot be read / modified / deleted by any app).
            </span>
          </v-tooltip>
        </div>

        <!-- TODO: finish in v1.1.0 -->
        <div v-if="false">
          <div v-if="systemInfo.platform === 'win32' && !dialogs.dirItemPermissionManagerDialog.data.permissionData.isImmutable">
            <!-- input-select::owner -->
            <v-select
              v-model="dialogs.dirItemPermissionManagerDialog.data.user.selected"
              :items="dialogs.dirItemPermissionManagerDialog.data.user.items"
              return-object
              item-text="text"
              label="Group or user"
            />

            <!-- input-select::everyone -->
            <v-select
              v-model="dialogs.dirItemPermissionManagerDialog.data.win32.selectedPermissions"
              :items="dialogs.dirItemPermissionManagerDialog.data.win32.permissions"
              label="Permissions"
              multiple
            />
          </div>

          <div v-if="systemInfo.platform === 'linux'">
            <!-- input-select::owner -->
            <v-select
              v-model="dialogs.dirItemPermissionManagerDialog.data.permissionGroups.owner.selected"
              :items="dialogs.dirItemPermissionManagerDialog.data.permissionGroups.owner.items"
              label="Owner"
            />

            <!-- input-select::group -->
            <v-select
              v-model="dialogs.dirItemPermissionManagerDialog.data.permissionGroups.group.selected"
              :items="dialogs.dirItemPermissionManagerDialog.data.permissionGroups.group.items"
              label="Group"
            />

            <!-- input-select::everyone -->
            <v-select
              v-model="dialogs.dirItemPermissionManagerDialog.data.permissionGroups.everyone.selected"
              :items="dialogs.dirItemPermissionManagerDialog.data.permissionGroups.everyone.items"
              label="Everyone"
            />
          </div>
        </div>

        <div class="button-container">
          <!-- button:learn-more -->
          <v-btn
            class="button-1 mt-4"
            small
            @click="$store.dispatch('OPEN_APP_GUIDE', 'data-protection')"
          >
            Learn more
          </v-btn>

          <!-- button:reset-permissions -->
          <v-btn
            class="button-1 mt-4"
            small
            @click="$store.dispatch('RESET_DIR_ITEM_PERMISSIONS')"
          >
            reset permissions
          </v-btn>
        </div>
        <!-- <v-text-field
          v-model="dialogs.dirItemPermissionManagerDialog.data.name"
          @input="validateNewDirItemInput()"
          @keypress.enter="createDirItem()"
          :label="`New ${dialogs.dirItemPermissionManagerDialog.data.type} name`"
          ref="dirItemPermissionManagerDialogNameInput"
          :value="dialogs.dirItemPermissionManagerDialog.data.name"
          :error="!dialogs.dirItemPermissionManagerDialog.data.isValid"
          :hint="dialogs.dirItemPermissionManagerDialog.data.error"
          autofocus
        ></v-text-field> -->
      </template>
    </dialog-generator>

    <!-- dialog::homeBannerPickerDialog -->
    <dialog-generator
      :dialog="dialogs.homeBannerPickerDialog"
      :close-button="{
        onClick: () => closeDialog('homeBannerPickerDialog'),
      }"
      title="Home page background manager"
      max-width="90vw"
      height="85vh"
    >
      <template #title>
        <info-tag
          v-if="homeBannerSelectedItem.type === 'video'"
          text="High resource usage"
          class="ml-4"
        >
          <template #tooltip>
            <v-icon color="red">
              mdi-circle-small
            </v-icon>
            Video backgrounds use much more memory than images.
            To offload resources from RAM to GPU memory, set the app to run on dedicated GPU.
          </template>
        </info-tag>
      </template>

      <template #content>
        <div class="text--sub-title-1 mb-4">
          Custom backgrounds
        </div>

        <!-- iterator::custom-media -->
        <media-iterator
          v-if="dialogs.homeBannerPickerDialog.value"
          :items="customHomeBannerItems"
          type="custom"
          :options="{
            loadOnce: true
          }"
        />

        <!-- iterator::default-media::title -->
        <div class="text--sub-title-1 mb-2">
          Default backgrounds
        </div>

        <div class="mb-4">
          <p>
            The artworks provided by different artists.
            Hover previews to see the links to their profiles and other details.
          </p>
        </div>

        <!-- iterator::default-media -->
        <media-iterator
          v-if="dialogs.homeBannerPickerDialog.value"
          :items="defaultHomeBannerItems"
          type="default"
          :options="{
            loadOnce: true
          }"
        />
      </template>
    </dialog-generator>

    <!-- dialog::homeBannerPositionDialog -->
    <dialog-generator
      :dialog="dialogs.homeBannerPositionDialog"
      :close-button="{
        onClick: () => closeDialog('homeBannerPositionDialog'),
      }"
      title="Background position"
      height="unset"
    >
      <template #content>
        <div>Position X-axis: {{homeBannerPositionX}}%</div>
        <v-slider
          v-model="homeBannerPositionX"
          :step="5"
          :thumb-size="24"
        />
        <div>Position Y-axis: {{homeBannerPositionY}}%</div>
        <v-slider
          v-model="homeBannerPositionY"
          :step="5"
          :thumb-size="24"
        />
      </template>
    </dialog-generator>

    <!-- dialog::homeBannerHeightDialog -->
    <dialog-generator
      :dialog="dialogs.homeBannerHeightDialog"
      :close-button="{
        onClick: () => closeDialog('homeBannerHeightDialog'),
      }"
      title="Background height"
      height="unset"
    >
      <template #content>
        <div>Height: {{homeBannerHeight}}vh</div>
        <v-slider
          v-model="homeBannerHeight"
          :step="0.1"
          :thumb-size="24"
          :min="38"
          :max="75"
        />
      </template>
    </dialog-generator>

    <!-- dialog::homeBannerOverlayDialog -->
    <dialog-generator
      :dialog="dialogs.homeBannerOverlayDialog"
      :close-button="{
        onClick: () => closeDialog('homeBannerOverlayDialog'),
      }"
      title="Background overlay"
      height="unset"
    >
      <template #content>
        <div class="text--sub-title-1 ma-0 mr-2">
          Overlay type
        </div>
        <v-select
          v-model="homeBannerOverlaySelectedItem"
          :items="$store.state.storageData.settings.homeBanner.overlay.items"
          return-object
          item-text="title"
        />
        <template v-if="homeBannerOverlaySelectedItem.name !== 'none'">
          <div class="text--sub-title-1 ma-0 mr-2">
            Overlay options
          </div>

          <!-- input::option:height -->
          <v-text-field
            v-if="homeBannerOverlaySelectedItem.name === 'overlayFade'"
            v-model="homeBannerOverlaySelectedItem.params.topFadeHeight"
            label="Top overlay height (CSS units)"
          />

          <v-text-field
            v-if="homeBannerOverlaySelectedItem.name === 'overlayFade'"
            v-model="homeBannerOverlaySelectedItem.params.bottomFadeHeight"
            label="Bottom overlay height (CSS units)"
          />

          <v-text-field
            v-if="homeBannerOverlaySelectedItem.name === 'maskFade'"
            v-model="homeBannerOverlaySelectedItem.params.bottomMaskHeight"
            label="Bottom mask height (CSS units)"
          />
        </template>
      </template>
    </dialog-generator>

    <!-- dialog::userDirectoryEditorDialog -->
    <dialog-generator
      :dialog="dialogs.userDirectoryEditorDialog"
      :close-button="{
        onClick: () => closeDialog('userDirectoryEditorDialog'),
      }"
      title="User directory editor"
      height="unset"
      fade-mask-bottom="0%"
    >
      <template #content>
        <v-text-field
          v-model="dialogs.userDirectoryEditorDialog.data.item.title"
          label="Directory title"
          autofocus
        />

        <v-text-field
          v-model="dialogs.userDirectoryEditorDialog.data.item.path"
          label="Directory path"
          :hint="userDirectoryEditorDialogPathIsValid.error"
          :error="!userDirectoryEditorDialogPathIsValid.value"
          :persistent-hint="!userDirectoryEditorDialogPathIsValid.value"
        />

        <v-layout align-center>
          <v-text-field
            v-model="dialogs.userDirectoryEditorDialog.data.item.icon"
            label="Icon name (should start with 'mdi-')"
          />

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                class="button-1 ml-2"
                depressed
                small
                v-on="on"
                @click="$utils.openLink('https://materialdesignicons.com/')"
              >
                Open icon list
              </v-btn>
            </template>
            <span>
              <v-layout align-center>
                <v-icon
                  class="mr-3"
                  size="16px"
                >
                  mdi-open-in-new
                </v-icon>
                {{'https://materialdesignicons.com/'}}
              </v-layout>
            </span>
          </v-tooltip>
        </v-layout>

        <v-layout align-center>
          <div class="mr-2">
            Icon preview:
          </div>
          <v-icon>{{dialogs.userDirectoryEditorDialog.data.item.icon}}</v-icon>
        </v-layout>
      </template>
    </dialog-generator>

    <!-- dialog::programEditorDialog -->
    <dialog-generator
      v-if="dialogs.programEditorDialog.value"
      :dialog="dialogs.programEditorDialog"
      :close-button="{
        onClick: () => closeDialog('programEditorDialog'),
      }"
      :action-buttons="[
        {
          text: 'cancel',
          onClick: () => closeDialog('programEditorDialog')
        },
        {
          text: dialogs.programEditorDialog.data.selectedProgram.isTemplate
            ? 'Add program'
            : 'Save program',
          disabled: !programEditorDialogIsValid,
          onClick: () => saveProgramChanges()
        }
      ]"
      title="External program editor"
      height="90vh"
      max-width="600px"
    >
      <template #content>
        <div class="text--sub-title-1 mb-2">
          Choose program
        </div>

        <!-- program-list -->
        <v-layout align-center>
          <v-select
            v-model="dialogs.programEditorDialog.data.selectedProgram"
            :items="programEditorDialogFilteredPrograms"
            class="mr-4"
            item-text="name"
            label="Program"
            return-object
            @input="programEditorProgramInputHandler"
          >
            <!-- program::icon:add/edit -->
            <template #selection="{ item }">
              <v-icon
                size="20px"
                class="mr-2"
              >
                {{item.isTemplate
                  ? 'mdi-plus'
                  : 'mdi-pencil-outline'}}
              </v-icon>
              <span>{{item.name}}</span>
            </template>
            <template #item="{ item }">
              <v-icon
                size="20px"
                class="mr-2"
              >
                {{item.isTemplate
                  ? 'mdi-plus'
                  : 'mdi-pencil-outline'}}
              </v-icon>
              <span>{{item.isTemplate ? `Add: ${item.name}` : `Edit: ${item.name}`}}</span>
            </template>
          </v-select>

          <!-- program::icon:trash -->
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                :disabled="dialogs.programEditorDialog.data.selectedProgram.isTemplate"
                icon
                v-on="on"
                @click="deleteProgram()"
              >
                <v-icon
                  size="16px"
                >
                  mdi-trash-can-outline
                </v-icon>
              </v-btn>
            </template>
            <span>Remove program from the list</span>
          </v-tooltip>
        </v-layout>

        <!-- program::path -->
        <v-layout align-center>
          <v-text-field
            v-model="dialogs.programEditorDialog.data.selectedProgram.path"
            label="Program path"
            :error="!programEditorDialogProgramPathIsValid.value"
            :hint="programEditorDialogProgramPathIsValid.error"
            class="mr-4"
            @input="programEditorProgramPathInputHandler"
          />

          <!-- program::icon:picker -->
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                v-on="on"
                @click="programEditorPickProgram()"
              >
                <v-icon
                  size="16px"
                >
                  mdi-eyedropper
                </v-icon>
              </v-btn>
            </template>
            <span>Pick a program</span>
          </v-tooltip>
        </v-layout>

        <!-- program::name -->
        <v-text-field
          v-model="dialogs.programEditorDialog.data.selectedProgram.name"
          label="Program name"
          :error="!programEditorDialogProgramNameIsValid.value"
          :hint="programEditorDialogProgramNameIsValid.error"
        />

        <div class="text--sub-title-1 mb-2">
          Program properties
        </div>

        <!-- program-property::can-open-directories -->
        <v-checkbox
          v-model="dialogs.programEditorDialog.data.selectedProgram.targetTypes"
          value="directory"
          label="Program can open directories"
          class="mt-0"
          hide-details
        />

        <!-- program-property::can-open-files -->
        <v-checkbox
          v-model="dialogs.programEditorDialog.data.selectedProgram.targetTypes"
          value="file"
          label="Program can open files"
          class="mt-2"
          hide-details
        />

        <v-expand-transition>
          <div v-show="dialogs.programEditorDialog.data.selectedProgram.targetTypes.includes('file')">
            <v-combobox
              v-model="dialogs.programEditorDialog.data.selectedProgram.selectedAllowedFileTypes"
              :items="dialogs.programEditorDialog.data.allowedFileTypes"
              label="Allowed file types / extensions"
              class="mt-6"
              multiple
              hide-details
            />

            <v-combobox
              v-model="dialogs.programEditorDialog.data.selectedProgram.selectedDisallowedFileTypes"
              :items="dialogs.programEditorDialog.data.disallowedFileTypes"
              label="Disallowed file types / extensions"
              class="mt-6"
              multiple
              hide-details
            />
          </div>
        </v-expand-transition>

        <div class="text--sub-title-1 mt-4 mb-4">
          Program icon
        </div>

        <!-- program::icon -->
        <div class="program-icon-set__container">
          <v-btn
            v-for="(icon, index) in externalPrograms.icons"
            :key="'icon-' + index"
            :is-selected="icon === dialogs.programEditorDialog.data.selectedProgram.icon"
            icon
            @click="dialogs.programEditorDialog.data.selectedProgram.icon = icon"
          >
            <v-icon size="22px">
              {{icon}}
            </v-icon>
          </v-btn>
        </div>
      </template>
    </dialog-generator>

    <!-- dialog::noteEditorDialog -->
    <dialog-generator
      :dialog="dialogs.noteEditorDialog"
      :retain-focus="!dialogs.imagePickerDialog.value && !dialogs.mathEditorDialog.value"
      :close-button="{
        onClick: () => closeDialog('noteEditorDialog'),
      }"
      title="Note editor"
      :show-action-bar="true"
      :unscrollable-content="true"
      height="85vh"
      max-width="85vw"
    >
      <template #unscrollable-content>
        <div style="height: 100%">
          <v-text-field
            ref="titleField"
            v-model="noteEditor.openedNote.title"
            :disabled="noteEditor.openedNote.isProtected || noteEditor.openedNote.isTrashed"
            autofocus
            hide-details
            label="Note title"
            class="mt-0 mb-2"
          />
          <NoteEditor
            v-model="noteEditor.openedNote.content"
            :read-only="noteEditor.openedNote.isProtected || noteEditor.openedNote.isTrashed"
            :spellcheck="spellcheck"
            :markdown-shortcuts="markdownShortcuts"
            @currentNodePath="noteEditor.currentNodePath = $event"
            @charCount="noteEditor.openedNote.charCount = $event"
          />
        </div>
      </template>
      <template #actions>
        <div style="display: flex; gap: 16px">
          <!-- card::action-bar::lock-button -->
          <v-tooltip top>
            <template #activator="{ on }">
              <v-btn
                icon
                v-on="on"
                @click="$store.dispatch('UPDATE_NOTE_PROPERTY', {
                  key: 'isProtected',
                  value: !noteEditor.openedNote.isProtected,
                  note: noteEditor.openedNote
                })"
              >
                <v-icon size="18px">
                  {{noteEditor.openedNote.isProtected
                    ? 'mdi-shield-check-outline'
                    : 'mdi-shield-alert-outline'}}
                </v-icon>
              </v-btn>
            </template>
            <span>
              <div v-show="noteEditor.openedNote.isProtected">
                <div>Note protection: ON</div>
                <div>Note cannot be deleted / modified</div>
              </div>
              <div v-show="!noteEditor.openedNote.isProtected">
                <div>Note protection: OFF</div>
                <div>Note can be deleted / modified</div>
              </div>
            </span>
          </v-tooltip>

          <!-- card::action-bar::option-menu -->
          <v-menu
            offset-y
            top
            :close-on-content-click="false"
          >
            <template #activator="{ on: menu, attrs }">
              <v-tooltip bottom>
                <template #activator="{ on: tooltip }">
                  <v-btn
                    v-bind="attrs"
                    tabindex="2"
                    icon
                    :class="{ 'is-active': false }"
                    v-on="{ ...tooltip, ...menu }"
                  >
                    <v-icon size="20px">
                      mdi-dots-vertical
                    </v-icon>
                  </v-btn>
                </template>
                <span>Load a template</span>
              </v-tooltip>
            </template>
            <div class="text--sub-title-1 ma-4 mb-2">
              Options
            </div>
            <v-list width="380px">
              <v-divider />
              <v-list-item two-line>
                <v-switch
                  v-model="spellcheck"
                  label="Spellcheck"
                  class="my-0"
                  hide-details
                />
                <v-spacer />
                <v-list-item-avatar>
                  <v-icon>mdi-spellcheck</v-icon>
                </v-list-item-avatar>
              </v-list-item>
              <v-list-item two-line>
                <v-switch
                  v-model="markdownShortcuts"
                  label="Convert basic markdown syntax into HTML while typing"
                  class="my-0"
                  hide-details
                />
                <v-spacer />
                <v-list-item-avatar>
                  <v-icon>mdi-language-markdown-outline</v-icon>
                </v-list-item-avatar>
              </v-list-item>
            </v-list>
          </v-menu>
        </div>
        <v-spacer />

        <div style="display: flex; gap: 24px">
          <!-- card::action-bar::node-path -->
          <div
            v-if="noteEditor.currentNodePath.length > 0"
            class="mx-1 line-clamp-1"
            style="max-width: 300px"
          >
            Structure: {{noteEditor.currentNodePath.join(' / ')}}
          </div>

          <!-- card::action-bar::char counter -->
          <div
            v-if="noteEditor.openedNote.charCount"
            class="mx-1"
          >
            Chars: {{noteEditor.openedNote.charCount}}
          </div>

          <!-- card::action-bar::dates -->
          <v-tooltip top>
            <template #activator="{ on }">
              <v-icon
                size="20px"
                v-on="on"
              >
                mdi-clock-time-four-outline
              </v-icon>
            </template>
            <span>
              <div class="mr-3">
                Created: {{$utils.formatDateTime(noteEditor.openedNote.dateCreated, 'D MMM YYYY')}}
              </div>
              <div class="mr-3">
                Modified: {{$utils.formatDateTime(noteEditor.openedNote.dateModified, 'D MMM YYYY')}}
              </div>
            </span>
          </v-tooltip>

          <!-- card::action-bar::markdown-tips -->
          <v-tooltip
            top
            max-width="300px"
          >
            <template #activator="{ on }">
              <v-icon
                v-show="markdownShortcuts"
                size="26px"
                v-on="on"
              >
                mdi-language-markdown-outline
              </v-icon>
            </template>
            <span>
              <div class="text--sub-title-1 my-2">
                Markdown shortcuts
              </div>
              <div>
                With the cursor on a new line, type specified sequence to add the corresponding element.
              </div>
              <div
                v-for="(markdownAction, index) in markdownActions"
                :key="index"
                class="my-2"
              >
                <span class="inline-code--light mr-2">
                  {{markdownAction.action}}
                </span>
                {{markdownAction.description}}
              </div>
            </span>
          </v-tooltip>

          <!-- card::action-bar::note-editor-tips -->
          <v-tooltip top>
            <template #activator="{ on }">
              <v-icon
                size="20px"
                v-on="on"
              >
                mdi-help-circle-outline
              </v-icon>
            </template>
            <span>
              <div class="text--sub-title-1 my-2">
                Tips
              </div>
              <div class="my-2">
                <span class="inline-code--light mr-2">
                  Right mouse button
                </span>
                will select the word and show options
              </div>
              <div class="my-2">
                <span class="inline-code--light mr-2">
                  Ctrl + Shift + V
                </span>
                paste copied data without formatting
              </div>
              <div class="my-2">
                <span class="inline-code--light mr-2">
                  Enter
                </span>
                escape block; add new line
              </div>
              <div class="my-2">
                <span class="inline-code--light mr-2">
                  Shift + Enter
                </span>
                escape block
              </div>
              <div class="my-2">
                <span class="inline-code--light mr-2">
                  ArrowRight
                </span>
                escape block (when end is reached)
              </div>
            </span>
          </v-tooltip>
        </div>
      </template>
    </dialog-generator>

    <!-- dialog::imagePickerDialog -->
    <dialog-generator
      :dialog="dialogs.imagePickerDialog"
      :close-button="{
        onClick: () => closeDialog('imagePickerDialog'),
      }"
      :action-buttons="[
        {
          text: 'Cancel',
          onClick: () => closeDialog('imagePickerDialog')
        },
        {
          text: 'Add image',
          onClick: () => dialogs.imagePickerDialog.data.loadImage(dialogs.imagePickerDialog.data)
        }
      ]"
      title="Image picker"
      max-width="50vw"
    >
      <template #content>
        <v-layout align-center>
          <v-text-field
            v-model="dialogs.imagePickerDialog.data.path"
            label="Image path"
            autofocus
            persistent-hint
            hint="Path / URL / base64 string"
            @input="imagePickerPathInputHandler()"
          />

          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                v-on="on"
                @click="imagePickerPickProgramPath()"
              >
                <v-icon>
                  mdi-eyedropper-variant
                </v-icon>
              </v-btn>
            </template>
            <span>Pick image</span>
          </v-tooltip>
        </v-layout>
        <v-layout
          wrap
          class="mt-2"
          style="gap: 64px"
        >
          <div>
            <div class="text--sub-title-1 mt-4 mb-2">
              Float position
            </div>
            <v-radio-group
              v-model="dialogs.imagePickerDialog.data.float"
              class="mt-2"
            >
              <v-radio
                label="Left"
                value="left"
              />
              <v-radio
                label="Right"
                value="right"
              />
              <v-radio
                label="None"
                value="none"
              />
            </v-radio-group>
          </div>
          <div>
            <div class="text--sub-title-1 mt-4 mb-2">
              Dimensions
            </div>
            <v-text-field
              v-model="dialogs.imagePickerDialog.data.width"
              label="Width"
              hide-details
              class="my-2"
            />
            <v-text-field
              v-model="dialogs.imagePickerDialog.data.height"
              label="Height"
              hide-details
              class="my-2"
            />
          </div>
        </v-layout>
      </template>
    </dialog-generator>

    <!-- dialog::mathEditorDialog -->
    <dialog-generator
      :dialog="dialogs.mathEditorDialog"
      :close-button="{
        onClick: () => closeDialog('mathEditorDialog'),
      }"
      :action-buttons="[
        {
          text: 'Cancel',
          onClick: () => closeDialog('mathEditorDialog')
        },
        {
          text: dialogs.mathEditorDialog.data.type === 'add'
            ? 'Add formula'
            : 'Edit formula',
          onClick: () => dialogs.mathEditorDialog.data.addFormula(dialogs.mathEditorDialog.data)
        }
      ]"
      :title="`Math editor | ${dialogs.mathEditorDialog.data.framework.toUpperCase()}`"
      max-width="50vw"
    >
      <template #content>
        <div>
          See docs:
          <v-btn
            text
            x-small
            class="button-1"
            @click="$utils.openLink('https://katex.org/docs/supported.html')"
          >
            Katex
          </v-btn>
        </div>
        <v-text-field
          v-model="dialogs.mathEditorDialog.data.formula"
          :label="`${dialogs.mathEditorDialog.data.framework.toUpperCase()} formula`"
          autofocus
          class="mt-4"
          @input="updateMathFormulaPreview()"
        />
        <div class="text--sub-title-1 mt-0 mb-2">
          Preview
        </div>
        <div id="math-formula-preview" />
      </template>
    </dialog-generator>

    <WorkspaceEditorDialog />
    <ArchiveAddDialog />
    <ArchiveExtractDialog />
    <download-type-selector-dialog />

    <!-- dialog::externalDownloadDialog -->
    <dialog-generator
      :dialog="dialogs.externalDownloadDialog"
      :close-button="{
        onClick: () => closeDialog('externalDownloadDialog'),
      }"
      :action-buttons="[
        {
          text: 'Cancel',
          onClick: () => closeDialog('externalDownloadDialog')
        },
        {
          text: 'download',
          onClick: () => initExternalVideoDownload()
        }
      ]"
      title="Download manager"
      max-width="50vw"
    >
      <template #content>
        <div
          class="text--sub-title-1 mt-4 mb-2"
          style="word-break: break-all;"
        >
          URL
        </div>
        <div>
          {{dialogs.externalDownloadDialog.data.url}}
        </div>
        <div class="text--sub-title-1 mt-4 mb-2">
          Options
        </div>
        <v-select
          v-model="dialogs.externalDownloadDialog.data.video.selectedType"
          :items="dialogs.externalDownloadDialog.data.video.types"
          label="Download type"
          class="mr-4"
        />
      </template>
    </dialog-generator>

    <!-- dialog::localShareManagerDialog -->
    <dialog-generator
      :dialog="dialogs.localShareManagerDialog"
      :close-button="{
        onClick: () => closeDialog('localShareManagerDialog'),
      }"
      title="Local share manager"
      max-width="50vw"
      fade-mask-bottom="0%"
    >
      <template #content>
        <v-layout>
          <v-tooltip
            bottom
            max-width="320px"
          >
            <template #activator="{ on }">
              <div
                id="qr-code"
                class="qr-code mr-6"
                v-on="on"
              />
            </template>
            <span>
              This is a QR code.
              If your device have a virtual assistant (Siri, Google assistant, Bixby, etc.) you can ask it to "scan a QR code" for you.
              <br />Or you can just type the specified address manually in a web browser.
            </span>
          </v-tooltip>
          <div>
            <p>
              To see shared files, enter the specified address into a web browser's URL bar on any of your local devices (connected to the same network).
            </p>
          </div>
        </v-layout>

        <div class="text--sub-title-1 mt-4">
          Local server address
        </div>

        <!-- input:server-address -->
        <v-layout align-center>
          <v-text-field
            :value="
              dialogs.localShareManagerDialog.data.shareType === 'file'
                ? `${localServer.fileShare.address}`
                : `${localServer.directoryShare.address}`
            "
            class="mt-0 pt-0"
            readonly
            single-line
            hide-details
          />
          <v-btn
            small
            depressed
            class="button-1 ml-3"
            @click="$utils.copyToClipboard({
              text: dialogs.localShareManagerDialog.data.shareType === 'file'
                ? `${localServer.fileShare.address}`
                : `${localServer.directoryShare.address}`,
              title: 'Address was copied to clipboard'
            })"
          >
            copy
          </v-btn>
        </v-layout>

        <!-- input-radio-group:share-type -->
        <div v-if="dialogs.localShareManagerDialog.data.shareType === 'file'">
          <div class="text--sub-title-1 mt-4">
            Share type
          </div>
          <v-radio-group
            v-model="localServer.fileShare.type"
            :mandatory="true"
            hide-details
            class="mt-0"
            @change="$eventHub.$emit('app:method', {
              method: 'initLocalFileShare'
            })"
          >
            <v-radio
              label="Stream"
              value="stream"
            />
            <v-radio
              label="Download"
              value="download"
            />
          </v-radio-group>
        </div>

        <div v-if="dialogs.localShareManagerDialog.data.shareType === 'file'">
          <div class="text--sub-title-1 mt-4 mb-2">
            Shared file
          </div>
          <div class="mb-8">
            {{localServer.fileShare.item.path}}
          </div>
        </div>

        <div v-if="dialogs.localShareManagerDialog.data.shareType === 'directory'">
          <div class="text--sub-title-1 mt-4 mb-2">
            Shared directory
          </div>
          <div class="mb-8">
            {{localServer.directoryShare.item.path}}
          </div>
        </div>

        <v-tooltip top>
          <template #activator="{ on }">
            <v-layout
              align-center
              style="cursor: default"
              v-on="on"
            >
              Doesn't work?
              <v-icon
                class="ml-2"
                size="20px"
              >
                mdi-information-outline
              </v-icon>
            </v-layout>
          </template>
          <span>
            Make sure your network is set up properly:
            <ul>
              <li>You should allow the app access to your network in your Firewall</li>
              <li>This device should be discoverable on the network (connected to private profile)</li>
              <li>Your WIFI router should have the "client isolation" feature turned off.</li>
            </ul>
          </span>
        </v-tooltip>
      </template>
    </dialog-generator>
  </div>
</template>

<script>
import {mapState, mapGetters} from 'vuex'
import TimeUtils from '../utils/timeUtils.js'
import InfoTag from './InfoTag/index.vue'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import DownloadTypeSelectorDialog from '@/components/dialogs/DownloadTypeSelector.vue'
import WorkspaceEditorDialog from '@/components/dialogs/WorkspaceEditor.vue'
import ArchiveAddDialog from '@/components/dialogs/ArchiveAdd.vue'
import ArchiveExtractDialog from '@/components/dialogs/ArchiveExtract.vue'
import NoteEditor from '@/components/dialogs/NoteEditor.vue'

const electronRemote = require('@electron/remote')
const currentWindow = electronRemote.getCurrentWindow()
const PATH = require('path')
const sysInfo = require('systeminformation')
const fs = require('fs')
const os = require('os')

export default {
  components: {
    InfoTag,
    DownloadTypeSelectorDialog,
    WorkspaceEditorDialog,
    ArchiveAddDialog,
    ArchiveExtractDialog,
    NoteEditor,
  },
  data () {
    return {
      dialogsResetData: {},
      editTargets: [],
      noteChangeHandlerDebounce: null,
      markdownActions: [
        {action: '#space', description: '1st level headline'},
        {action: '#(N)space', description: 'N[1-6] level headline'},
        {action: '```space', description: 'Multiline code block'},
        {action: '`space', description: 'Inline code block'},
        {action: '-space', description: 'Unordered list'},
        {action: '+space', description: 'Ordered list'},
        {action: '*space', description: 'Italic text'},
        {action: '**space', description: 'Bold text'},
        {action: '~~space', description: 'Strikethrough text'},
        {action: '__space', description: 'Underlined text'},
        {action: '>space', description: 'Quote'},
        {action: '---space', description: 'Divider'},
        {action: '[ ]space', description: 'Unchecked checkbox'},
        {action: '[x]space', description: 'Checked checkbox'},
      ],
    }
  },
  mounted () {
    this.dialogsResetData = this.$utils.cloneDeep(this.dialogs)
    this.noteChangeHandlerDebounce = new TimeUtils()
  },
  watch: {
    'dialogs.userDirectoryEditorDialog.data': {
      handler (value) {
        if (this.userDirectoryEditorDialogDataIsValid) {
          this.dialogs.userDirectoryEditorDialog.dataIsValid = true
          this.$store.dispatch('SET', {
            key: 'storageData.settings.appPaths.userDirs',
            value: this.dialogs.userDirectoryEditorDialog.data.userDirs,
          })
        }
        else {
          this.dialogs.userDirectoryEditorDialog.dataIsValid = false
        }
      },
      deep: true,
    },
    'dialogs.userDirectoryEditorDialog.value' (value) {
      this.setupDialogDataRestore({value, dialogName: 'userDirectoryEditorDialog'})
    },
    'dialogs.mathEditorDialog.value' (value) {
      if (value) {
        setTimeout(() => {
          this.updateMathFormulaPreview()
        }, 250)
      }
    },
    'dialogs.renameDirItemDialog.value' (value) {
      if (value) {
        this.editTargets = [this.$utils.cloneDeep(this.selectedDirItems.at(-1))]
        this.dialogs.renameDirItemDialog.data.name = this.editTargets[0].name
        const parsedName = PATH.parse(this.dialogs.renameDirItemDialog.data.name)
        const isDir = fs.statSync(this.editTargets[0].path).isDirectory()
        // Focus input field
        this.$nextTick(() => {
          this.$refs.renameItemDialogNameInput.focus()
          // Set selection range for the name (exclude file extension)
          this.$refs.renameItemDialogNameInput.$refs.input.setSelectionRange(
            0,
            // Select the whole directory name to avoid partial selection of dir names containing dots
            isDir ? parsedName.base.length : parsedName.name.length,
          )
        })
      }
      else {
        this.resetDialogData('renameDirItemDialog')
      }
    },
    'dialogs.newDirItemDialog.value' (value) {
      if (value) {
        // Focus input field
        this.$nextTick(() => {
          this.$refs.newDirItemDialogNameInput.focus()
        })
      }
      else {
        this.resetDialogData('newDirItemDialog')
      }
    },
    'dialogs.programEditorDialog.value' (value) {
      if (value) {
        // Add program template to the selection list
        const programTemplate = this.$utils.cloneDeep(this.externalPrograms.programTemplate)
        programTemplate.isTemplate = true
        const items = [
          ...[programTemplate],
          ...this.$utils.cloneDeep(this.externalPrograms.defaultItems),
          ...this.$utils.cloneDeep(this.externalPrograms.items),
        ]
        this.dialogs.programEditorDialog.data.programs = items
        if (this.dialogs.programEditorDialog.specifiedHashID) {
          this.dialogs.programEditorDialog.data.selectedProgram = items.find(item => {
            return item?.hashID === this.dialogs.programEditorDialog.specifiedHashID
          })
        }
        else {
          this.dialogs.programEditorDialog.data.selectedProgram = programTemplate
        }
        // Get data for selected items
        // Add ext to allowed list
        this.dialogs.programEditorDialog.data.selectedProgram.selectedAllowedFileTypes = this.selectedDirItemsExtensions
        this.dialogs.programEditorDialog.data.selectedProgram.selectedDisallowedFileTypes = []
        // Add ext to items list
        this.selectedDirItemsExtensions.forEach(ext => {
          if (!this.dialogs.programEditorDialog.data.allowedFileTypes.includes(ext)) {
            this.dialogs.programEditorDialog.data.allowedFileTypes.push(ext)
          }
        })
      }
      else {
        // Clean up data
        this.dialogs.programEditorDialog.specifiedHashID = null
      }
    },
    'dialogs.dirItemPermissionManagerDialog.value' (value) {
      if (value) {
        this.dialogs.dirItemPermissionManagerDialog.data.dirItem = this.targetItems[0]
        this.dialogs.dirItemPermissionManagerDialog.data.permissionData.isImmutable = this.dialogs.dirItemPermissionManagerDialog.data.dirItem.isImmutable

        this.$store.dispatch('GET_DIR_ITEM_PERMISSION_DATA', {
          dirItem: this.dialogs.dirItemPermissionManagerDialog.data.dirItem,
        })
          .then((dirItemPermissionData) => {
            this.dialogs.dirItemPermissionManagerDialog.data.permissionData = dirItemPermissionData
          })

        this.$store.dispatch('GET_DIR_ITEM_USER_DATA', {
          dirItem: this.dialogs.dirItemPermissionManagerDialog.data.dirItem,
        })
          .then((userItems) => {
            this.dialogs.dirItemPermissionManagerDialog.data.user.unspecifiedItems.forEach(item => {
              userItems.unshift(item)
            })
            this.dialogs.dirItemPermissionManagerDialog.data.user.items = userItems
            this.dialogs.dirItemPermissionManagerDialog.data.user.selected = this.dialogs.dirItemPermissionManagerDialog.data.user.items[0]
          })
      }
    },
    'noteEditor.openedNote': {
      handler (newValue, oldValue) {
        // Note: using debounce to reduce the amount of writes
        // to storage (e.g. when a button is held down)
        this.noteChangeHandlerDebounce.throttle(() => {
          this.$store.dispatch(
            'UPDATE_NOTE',
            newValue,
          )
        }, {time: 1000})
      },
      deep: true,
    },
  },
  computed: {
    ...mapState({
      appVersion: state => state.appVersion,
      windowSize: state => state.windowSize,
      appPaths: state => state.storageData.settings.appPaths,
      shortcuts: state => state.storageData.settings.shortcuts,
      appActionHistory: state => state.appActionHistory,
      dialogs: state => state.dialogs,
      currentDir: state => state.navigatorView.currentDir,
      storageData: state => state.storageData,
      homeBanner: state => state.storageData.settings.homeBanner,
      homeBannerSelectedItem: state => state.storageData.settings.homeBanner.selectedItem,
      homeBannerOverlayStyleVariants: state => state.storageData.settings.homeBanner.overlay.variants,
      externalPrograms: state => state.storageData.settings.externalPrograms,
      markdownShortcuts: state => state.storageData.settings.markdownShortcuts,
      noteEditor: state => state.noteEditor,
      localServer: state => state.localServer,
      protectedItems: state => state.storageData.protected.items,
    }),
    ...mapGetters([
      'systemInfo',
      'selectedDirItems',
      'homeBannerSelectedMedia',
      'selectedDirItemsPaths',
      'selectedDirItemsExtensions',
    ]),
    targetItems () {
      return this.$store.state.contextMenus.dirItem.targetItems
    },
    targetItemsStats () {
      return this.$store.state.contextMenus.dirItem.targetItemsStats
    },
    defaultHomeBannerItems () {
      return this.homeBanner.items.filter(item => !item.isCustom)
    },
    customHomeBannerItems () {
      return this.homeBanner.items.filter(item => item.isCustom)
    },
    homeBannerPositionX: {
      get () {return this.homeBannerSelectedMedia.positionX},
      set (value) {
        this.$store.dispatch('SET_HOME_BANNER_POSITION', {axis: 'x', value: value})
      },
    },
    homeBannerPositionY: {
      get () {return this.homeBannerSelectedMedia.positionY},
      set (value) {
        this.$store.dispatch('SET_HOME_BANNER_POSITION', {axis: 'y', value: value})
      },
    },
    homeBannerHeight: {
      get () {return this.$store.state.storageData.settings.homeBanner.height},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.homeBanner.height',
          value: value,
        })
      },
    },
    homeBannerOverlaySelectedItem: {
      get () {return this.$store.state.storageData.settings.homeBanner.overlay.selectedItem},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.homeBanner.overlay.selectedItem',
          value: value,
        })
      },
    },
    spellcheck: {
      get () {return this.$store.state.storageData.settings.spellcheck},
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.spellcheck',
          value,
        })
      },
    },
    errorDialogErrorMessage () {
      const stack = this?.dialogs?.errorDialog?.data?.errorEvent?.error?.stack
      const message = this?.dialogs?.errorDialog?.data?.errorEvent?.message
      return stack ?? message ?? 'No error message'
    },
    appActionHistoryLog () {
      let log = ''
      this.appActionHistory.forEach(action => {
        log += `${action.readableTime} | ${action.action}\n`
      })
      return log
    },
    programEditorDialogFilteredPrograms () {
      return this.dialogs.programEditorDialog.data.programs.filter(program => !program.readonly)
    },
    programEditorDialogProgramNameIsValid () {
      const name = this.dialogs.programEditorDialog.data.selectedProgram.name
      const nameIsEmpty = name?.length === 0
      if (nameIsEmpty) {
        return {
          value: false,
          error: 'Name cannot be empty',
        }
      }
      else {
        return {
          value: true,
          error: '',
        }
      }
    },
    programEditorDialogProgramPathIsValid () {
      const path = this.dialogs.programEditorDialog.data.selectedProgram.path
      const pathIsEmpty = path?.length === 0
      const pathExists = !pathIsEmpty && fs.existsSync(path)
      const pathIsFile = pathExists && fs.statSync(path).isFile()
      if (pathIsEmpty) {
        return {
          value: false,
          error: 'Path cannot be empty',
        }
      }
      if (!pathExists) {
        return {
          value: false,
          error: 'Path does not exist',
        }
      }
      if (!pathIsFile) {
        return {
          value: false,
          error: 'Path should be a file',
        }
      }
      else {
        return {
          value: true,
          error: '',
        }
      }
    },
    programEditorDialogIsValid () {
      return this.programEditorDialogProgramNameIsValid.value &&
        this.programEditorDialogProgramPathIsValid.value &&
        this.dialogs.programEditorDialog.data.selectedProgram.targetTypes.length > 0
    },
    userDirectoryEditorDialogDataIsValid () {
      return this.userDirectoryEditorDialogPathIsValid.value
    },
    userDirectoryEditorDialogPathIsValid () {
      const path = this.dialogs.userDirectoryEditorDialog.data.item.path
      const pathIsEmpty = path?.length === 0
      const pathExists = !pathIsEmpty && fs.existsSync(path)
      if (pathIsEmpty) {
        return {
          value: false,
          error: 'Path cannot be empty',
        }
      }
      if (!pathExists) {
        return {
          value: false,
          error: 'Path does not exist',
        }
      }
      else {
        return {
          value: true,
          error: '',
        }
      }
    },
    newDirItemPath () {
      return PATH.posix.join(this.currentDir.path, this.dialogs.newDirItemDialog.data.name)
    },
    guideHeaderButtons () {
      return [
        {
          title: 'Project page',
          link: this.appPaths.githubRepoLink,
        },
        {
          title: 'Requests & issues',
          link: this.appPaths.githubIssuesLink,
        },
        {
          title: 'Discussions',
          link: this.appPaths.githubDiscussionsLink,
        },
      ]
    },
    targetItemsIncludeProtected () {
      const someItemIsProtected = this.targetItems.every(selectedItem => {
        return this.protectedItems.some(protectedItem => protectedItem.path === selectedItem.path)
      })
      return someItemIsProtected
    },
  },
  methods: {
    setupDialogDataRestore (params) {
      if (params.value) {
        this.$nextTick(() => {
          this.dialogs[params.dialogName].initialData = this.$utils.cloneDeep(this.dialogs[params.dialogName].data)
        })
      }
      else if (!params.value) {
        if (!this.dialogs[params.dialogName].dataIsValid) {
          this.dialogs[params.dialogName].data = this.$utils.cloneDeep(this.dialogs[params.dialogName].initialData)
          this.dialogs.userDirectoryEditorDialog.dataIsValid = true
        }
      }
    },
    closeDialog (dialogName, params) {
      const defaultParams = {
        resetData: true,
      }
      params = {...defaultParams, ...params}
      if (params.resetData) {
        this.resetDialogData(dialogName)
      }
      this.dialogs[dialogName].value = false
    },
    resetDialogData (dialogName) {
      // Clone reset data and set current state
      this.dialogs[dialogName].data = this.$utils.cloneDeep(this.dialogsResetData[dialogName].data)
    },
    getSudo () {
      return new Promise((resolve, reject) => {
        const isPOSIX = ['linux', 'darwin'].includes(this.systemInfo.platform)
        if (isPOSIX && this.storageData.settings.adminPrompt === 'built-in') {
          this.$store.dispatch('SUDO_PASSWORD_PROMPT')
            .then((result) => {
              resolve(result)
            })
        }
        else {
          resolve({
            action: 'skip',
          })
        }
      })
    },
    setDirItemImmutableState () {
      this.getSudo()
        .then((result) => {
          if (result.action === 'enter' || result.action === 'skip') {
            const isImmutable = this.dialogs.dirItemPermissionManagerDialog.data.permissionData.isImmutable
            this.$store.dispatch('SET_DIR_ITEM_IMMUTABLE_STATE', {
              dirItem: this.dialogs.dirItemPermissionManagerDialog.data.dirItem,
              value: !isImmutable,
              adminPrompt: this.storageData.settings.adminPrompt,
              sudoPassword: result?.data?.inputs?.[0]?.model,
            })
            this.dialogs.dirItemPermissionManagerDialog.data.permissionData.isImmutable = !isImmutable
          }
        })
    },
    async createNewErrorIssue () {
      // Generate Github issue template
      try {
        const titleTemplate = '[Auto-generated problem report] unhandled error'
        const bodyTemplate = [
          '## System info:',
          `- **App version**: ${this.appVersion}`,
          `- **App page**: ${this.dialogs.errorDialog.data.routeName ?? 'unknown'}`,
          `- **Operating System**: ${os.arch()}, ${process.platform}, ${os.release()}`,
          `- **Free memory**: ${this.$utils.prettyBytes((await sysInfo.mem()).free, 1) ?? 'unknown'}`,
          '## Problem:',
          '### Error:',
          '```js',
          // Automatically wrap the line after every 90 chars
          `${this.errorDialogErrorMessage.replace(/(.{1,90})/g, '$1\n')
          }`,
          '```',
          '### App action history:',
          '```js',
          this.appActionHistoryLog,
          '```',
        ].join('\n')
        // Create link
        const link = [
          `https://www.github.com/${this.appPaths.githubRepo}/`,
          'issues/new?',
          'labels=unhandledError&',
          `title=${encodeURIComponent(titleTemplate)}&`,
          `body=${encodeURIComponent(bodyTemplate)}`,
        ].join('\n')
        this.$eventHub.$emit('notification', {
          action: 'add',
          timeout: 0,
          closeButton: true,
          colorStatus: 'green',
          title: 'Error template link was generated',
          message: 'Open the link in your browser to continue',
          actionButtons: [
            {
              title: 'Copy link',
              action: '',
              onClick: () => {
                this.$utils.copyToClipboard({
                  text: link,
                  title: 'Link was copied to clipboard',
                })
              },
              closesNotification: false,
            },
            {
              title: 'Open link in default browser',
              action: '',
              onClick: () => {
                this.$utils.openLink(link)
              },
              closesNotification: false,
            },
          ],
        })
      }
      catch (error) {
        this.$eventHub.$emit('notification', {
          action: 'add',
          timeout: 5000,
          closeButton: true,
          title: 'Operation failed',
          message: `Error during template generation:<br>${error}`,
        })
      }
    },
    getGuideTitle (index) {
      return this.dialogs?.guideDialog?.data?.guideTabs?.[index]?.text || ''
    },
    handleConformationDialogCloseButton () {
      try {
        let closeButton = this.dialogs.conformationDialog.data.closeButton
        if (closeButton.onClick) {
          closeButton.onClick()
        }
        this.closeDialog('conformationDialog')
      }
      catch (error) {}
    },
    initDirItemRename () {
      if (!this.dialogs.renameDirItemDialog.data.isValid) {return}
      const dir = PATH.parse(this.editTargets[0].path).dir
      const newName = this.dialogs.renameDirItemDialog.data.name
      const oldName = this.editTargets[0].name
      const oldPath = PATH.posix.join(dir, oldName)
      const newPath = PATH.posix.join(dir, newName)
      this.$store.dispatch('RENAME_DIR_ITEM', {
        oldPath,
        newPath,
        newName,
        oldName,
      })
    },
    createDirItem () {
      if (this.dialogs.newDirItemDialog.data.name === '') {return}
      const dir = this.currentDir.path
      const type = this.dialogs.newDirItemDialog.data.type
      const name = this.dialogs.newDirItemDialog.data.name
      const path = PATH.posix.join(dir, name)
      // Check if specified path already exists
      fs.promises.access(path, fs.constants.F_OK)
        .then(() => {
          // If path already exists
          this.$eventHub.$emit('notification', {
            action: 'add',
            timeout: 3000,
            closeButton: true,
            title: 'Failure: path already exists',
            message: path,
          })
        })
        .catch((error) => {
          // If path doesn't exist, create it
          let promiseToCreateDirItem
          if (type === 'directory') {
            promiseToCreateDirItem = fs.promises.mkdir(path, {recursive: true})
          }
          else if (type === 'file') {
            promiseToCreateDirItem = fs.promises.writeFile(path, '')
          }
          promiseToCreateDirItem
            .then(() => {
              setTimeout(() => {
                this.$eventHub.$emit('notification', {
                  action: 'add',
                  timeout: 3000,
                  title: `${this.$utils.capitalize(type)} was created`,
                  message: path,
                })
              }, 1000)
              this.dialogs.newDirItemDialog.value = false
            })
            .catch((error) => {
              this.$eventHub.$emit('notification', {
                action: 'add',
                timeout: 5000,
                closeButton: true,
                title: `Failed to create new ${type}`,
                message: `Error: ${error}`,
              })
            })
        })
    },
    validateRenameDirItemInput () {
      const parsedItemPath = PATH.parse(this.editTargets[0].path)
      const newName = this.dialogs.renameDirItemDialog.data.name
      const newPath = `${parsedItemPath.dir}/${newName}`
      const pathValidationData = this.$utils.isPathValid(newPath, { canBeRootDir: false })
      this.dialogs.renameDirItemDialog.data.error = pathValidationData.error
      this.dialogs.renameDirItemDialog.data.isValid = pathValidationData.isValid
    },
    validateNewDirItemInput () {
      const newName = this.dialogs.newDirItemDialog.data.name
      const newPath = PATH.posix.join(this.currentDir.path, newName)
      const pathValidationData = this.$utils.isPathValid(newPath, {canBeRootDir: false})
      this.dialogs.newDirItemDialog.data.error = pathValidationData.error
      this.dialogs.newDirItemDialog.data.isValid = pathValidationData.isValid
    },
    saveProgramChanges () {
      // If adding new program
      if (this.dialogs.programEditorDialog.data.selectedProgram.isTemplate) {
        // Clean up selected program
        delete this.dialogs.programEditorDialog.data.selectedProgram.isTemplate
        // Add program
        this.$store.dispatch(
          'ADD_EXTERNAL_PROGRAM',
          this.dialogs.programEditorDialog.data.selectedProgram,
        )
      }
      // If editing existing program
      else {
        this.$store.dispatch(
          'EDIT_EXTERNAL_PROGRAM',
          this.dialogs.programEditorDialog.data.selectedProgram,
        )
      }
      this.closeDialog('programEditorDialog')
    },
    deleteProgram () {
      this.$store.dispatch(
        'DELETE_EXTERNAL_PROGRAM',
        this.dialogs.programEditorDialog.data.selectedProgram,
      )
      const programTemplate = this.$utils.cloneDeep(this.externalPrograms.programTemplate)
      programTemplate.isTemplate = true
      const items = [
        ...[programTemplate],
        ...this.$utils.cloneDeep(this.externalPrograms.defaultItems),
        ...this.$utils.cloneDeep(this.externalPrograms.items),
      ]
      this.dialogs.programEditorDialog.data.programs = items
      this.dialogs.programEditorDialog.data.selectedProgram = programTemplate
    },
    programEditorProgramInputHandler () {
    },
    programEditorProgramPathInputHandler () {
      const path = this.dialogs.programEditorDialog.data.selectedProgram.path
      this.dialogs.programEditorDialog.data.selectedProgram.path = path.replace(/\\/g, '/')
      const parsedPath = PATH.parse(this.dialogs.programEditorDialog.data.selectedProgram.path)
      this.dialogs.programEditorDialog.data.selectedProgram.name = parsedPath.name
    },
    programEditorPickProgram () {
      electronRemote.dialog.showOpenDialog(currentWindow, {properties: ['openFile'] }).then(result => {
        // Parse name of selected file
        const filePath = result.filePaths[0].replace(/\\/g, '/')
        const parsedPath = PATH.parse(filePath)
        this.dialogs.programEditorDialog.data.selectedProgram.path = filePath
        this.dialogs.programEditorDialog.data.selectedProgram.name = parsedPath.name
      })
        .catch(error => {
          console.error(error)
          this.$eventHub.$emit('notification', {
            action: 'add',
            timeout: 3000,
            title: 'Error: unable to select the program',
          })
        })
    },
    imagePickerPathInputHandler () {
    },
    imagePickerPickProgramPath () {
      electronRemote.dialog.showOpenDialog(currentWindow, {properties: ['openFile'] })
        .then(result => {
          const filePath = result.filePaths[0]
          this.dialogs.imagePickerDialog.data.path = filePath
        })
        .catch(error => {
          console.error(error)
          this.$eventHub.$emit('notification', {
            action: 'add',
            timeout: 5000,
            title: "Error | couldn't pick an image",
            message: "Make sure you're picking an image file",
          })
        })
    },
    updateMathFormulaPreview () {
      const node = document.querySelector('#math-formula-preview')
      const katexHtml = katex.renderToString(this.dialogs.mathEditorDialog.data.formula, {
        throwOnError: false,
      })
      node.innerHTML = katexHtml
    },
    initExternalVideoDownload () {
      // TODO: refactor
      const hashID = this.$utils.getHash()
      if (this.dialogs.externalDownloadDialog.data.type === 'video') {
        let command = []
        let commandForFileName = []
        let fileName
        let path
        let destPathRaw = ''
        const directory = this.dialogs.externalDownloadDialog.data.directory
        const overwriteExisting = true
        if (this.dialogs.externalDownloadDialog.data.source === 'm3u8') {
          // fileName = 'file.mkv'
          fileName = 'file.ts'
          path = PATH.join(directory, fileName)

          command = [
            `"${this.appPaths.binFFMPEG}"`,
            `-${overwriteExisting ? 'y' : 'n'}`,
            '-i',
            `"${this.dialogs.externalDownloadDialog.data.url}"`,
            '-vcodec',
            'copy',
            '-c',
            'copy',
            '-f',
            'matroska',
            `"${path}"`,
            // 'pipe:1'
          ]
        }
        if (this.dialogs.externalDownloadDialog.data.source === 'youtube') {
          let format = 'bestvideo+bestaudio/best'
          destPathRaw = `${PATH.join(directory, '/%(title)s.%(ext)s')}`
          fileName = ''
          path = ''

          // Set download format
          if (this.dialogs.externalDownloadDialog.data.video.selectedType === 'Video only') {
            format = 'bestvideo'
          }
          else if (this.dialogs.externalDownloadDialog.data.video.selectedType === 'Audio only') {
            format = 'bestaudio'
          }

          command = [
            `"${this.appPaths.binYtdlp}"`,
            `--ffmpeg-location "${this.appPaths.binFFMPEG}"`,
            `-f ${format}`,
            `-o "${destPathRaw}"`,
            `"${this.dialogs.externalDownloadDialog.data.url}"`,
          ].join(' ').replace(/\n/g, ' ')

          commandForFileName = [
            `"${this.appPaths.binYtdlp}"`,
            '--get-filename',
            `-f ${format}`,
            `-o "${destPathRaw}"`,
            `"${this.dialogs.externalDownloadDialog.data.url}"`,
          ].join(' ').replace(/\n/g, ' ')
        }

        this.$store.dispatch('EXEC_DOWNLOAD_VIDEO', {
          command,
          commandForFileName,
          hashID,
          destPathRaw,
          fileName,
          path,
          directory,
          source: this.dialogs.externalDownloadDialog.data.source,
          type: this.dialogs.externalDownloadDialog.data.type,
        })
      }
      this.closeDialog('externalDownloadDialog')
    },
  },
}
</script>

<style>
.program-icon-set__container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding-bottom: 24px;
}

.program-icon-set__container
  .v-btn[is-selected="true"] {
    background-color: var(--highlight-color-4);
    border: 1px solid var(--icon-color-1);
    border-radius: 4px;
  }

.program-icon-set__container
  .v-btn
    .v-icon {
      color: var(--icon-color-2) !important;
    }

.program-icon-set__container
  .v-btn[is-selected="true"]
    .v-icon {
      color: var(--icon-color-1) !important;
    }
</style>
