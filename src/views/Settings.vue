<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    id="settings-view"
    :filter-is-empty="filterQuery === ''"
  >
    <div
      id="content-area--settings-view"
      class="content-area custom-scrollbar"
    >
      <div class="content-area__title">
        {{$localize.get('page_settings_title')}}
      </div>
      <v-divider class="my-3" />

      <div class="content-area__header">
        <img
          :src="$storeUtils.getSafePath(appPaths.public + '/icons/logo-1024x1024.png')"
          width="87px"
        />
        <div class="content-area__header__content">
          <div class="content-area__header__text">
            <strong>"Sigma File Manager"</strong> is a free, open source, advanced,
            modern file manager app, licensed under GNU GPLv3 or later.
            <br />Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
          </div>
          <div
            v-if="$vuetify.breakpoint.mdAndUp"
            class="content-area__header__buttons"
          >
            <v-tooltip
              v-for="(item, index) in headerButtons"
              :key="'header-button-' + index"
              bottom
            >
              <template #activator="{ on }">
                <v-btn
                  class="content-area__header__buttons__item button-1"
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
        </div>
      </div>

      <div class="content-area__content-card">
        <div class="tab-view">
          <v-tabs
            v-if="filterQuery === ''"
            v-model="settingsSelectedTab"
            class="tab-view__header"
            show-arrows="mobile"
            :vertical="windowSize.x > 700"
            :height="windowSize.x > 700 ? '' : '42'"
          >
            <v-tab
              v-for="(tab, index) in settingsTabs"
              :key="index"
            >
              {{tab.text}}
            </v-tab>
          </v-tabs>

          <v-tabs-items
            v-model="settingsSelectedTab"
            class="tab-view__header__content"
          >
            <div
              v-show="filterQuery !== ''"
              class="text--sub-title-1 ml-4 mt-4"
            >
              Filtered settings
              <v-btn
                small
                class="ml-4 button-1"
                @click="filterQuery = ''"
              >
                <v-icon
                  size="16px"
                  class="mr-2"
                >
                  mdi-backspace-outline
                </v-icon>
                Clear filter
              </v-btn>
            </div>

            <div
              v-show="settingsSelectedTab === 0 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="general"
            >
              <!-- section::Language -->
              <section-settings
                v-if="showSection('language')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-translate'
                  },
                  title: $localize.get('settings_language_title')
                }"
              >
                <template #content>
                  <v-menu offset-y>
                    <template #activator="{ on }">
                      <v-btn
                        class="button-1 mt-2"
                        small
                        depressed
                        v-on="on"
                      >
                        {{selectedLanguage.name}} - {{selectedLanguage.locale}}
                        <v-icon class="ml-2">
                          mdi-menu-down
                        </v-icon>
                      </v-btn>
                    </template>
                    <v-list dense>
                      <v-list-item
                        v-for="(language, index) in availableLanguages"
                        :key="index"
                        :is-active="language.locale === selectedLanguage.locale"
                        @click="$store.dispatch('SET', {
                          key: 'storageData.localization.selectedLanguage',
                          value: language
                        })"
                      >
                        <v-list-item-content>
                          <v-list-item-title>
                            {{language.name}} - {{language.locale}}
                          </v-list-item-title>
                        </v-list-item-content>
                        <v-list-item-icon>
                          <v-icon v-show="language.locale === selectedLanguage.locale">
                            mdi-check
                          </v-icon>
                        </v-list-item-icon>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                  <div class="mt-4">
                    More languages will be added in the future updates
                  </div>
                </template>
              </section-settings>

              <!-- section::ui-zoom -->
              <section-settings
                v-if="showSection('ui-scaling')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-fullscreen',
                    size: '28px'
                  },
                  title: $localize.get('settings_ui_zoom_title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$localize.get('settings_ui_zoom_options_title')}}
                    {{UIZoomLevelInPercents}}%
                  </div>

                  <v-layout align-center>
                    <v-tooltip
                      v-for="(item, index) in UIButtons"
                      :key="'ui-action-item-' + index"
                      open-delay="300"
                      bottom
                      offset-overflow
                    >
                      <template #activator="{ on }">
                        <v-btn
                          class="button-1 mr-3"
                          small
                          depressed
                          v-on="on"
                          @click="item.onClick()"
                        >
                          <v-icon v-if="item.icon">
                            {{item.icon}}
                          </v-icon>
                          <div v-if="item.buttonText">
                            {{item.buttonText}}
                          </div>
                        </v-btn>
                      </template>
                      <span>
                        {{item.title}}
                        <div class="tooltip__description">
                          {{item.title}}
                          {{$localize.get('tooltip_button_shortcut')}} {{item.shortcut}}
                        </div>
                      </span>
                    </v-tooltip>
                  </v-layout>
                </template>
              </section-settings>

              <!-- section::updates -->
              <section-settings
                v-if="showSection('updates') && !$utils.isWindowsStore"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-progress-upload',
                  },
                  title: $localize.get('app_updates')
                }"
              >
                <template #description>
                  <div class="text--sub-title-1 mt-2">
                    {{$localize.get('current_version')}}: {{appVersion}}
                  </div>
                </template>
                <template #content>
                  <div class="mb-4">
                    <v-btn
                      class="button-1 mr-2"
                      depressed
                      small
                      @click="$store.dispatch('INIT_APP_UPDATER', {notifyUnavailable: true})"
                    >
                      {{$localize.get('check_updates_now')}}
                    </v-btn>

                    <v-tooltip bottom>
                      <template #activator="{ on }">
                        <v-btn
                          class="button-1"
                          depressed
                          small
                          v-on="on"
                          @click="$utils.openLink(appPaths.githubAllReleases)"
                        >
                          See all releases
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
                          {{appPaths.githubAllReleases}}
                        </v-layout>
                      </span>
                    </v-tooltip>
                  </div>
                  <div class="text--sub-title-1 mt-2">
                    Options
                  </div>

                  <v-switch
                    v-model="autoCheckForAppUpdates"
                    label="Check for updates automatically"
                    hide-details
                  />

                  <v-switch
                    v-if="autoCheckForAppUpdates"
                    v-model="autoDownloadAppUpdates"
                    label="Download updates automatically"
                    hide-details
                  />

                  <v-switch
                    v-if="autoCheckForAppUpdates && autoDownloadAppUpdates"
                    v-model="autoInstallAppUpdates"
                    label="Install updates automatically"
                    hide-details
                  />
                </template>
              </section-settings>

              <!-- section::app properties -->
              <section-settings
                v-if="showSection('app-properties')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-tune',
                  },
                  title: $localize.get('app_properties')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Startup behavior
                  </div>

                  <v-switch
                    v-model="appPropertiesOpenAtLogin"
                    label="Launch app on system login"
                    hide-details
                  />

                  <v-switch
                    v-model="appPropertiesOpenAsHidden"
                    label="Launch app in hidden state"
                    hide-details
                  />
                </template>
              </section-settings>

              <!-- section::window-controls -->
              <section-settings
                v-if="showSection('window-controls')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-application-settings',
                  },
                  title: 'Window controls'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Window "close" button action
                  </div>

                  <v-radio-group
                    v-model="windowCloseButtonAction"
                    class="py-0 mt-4"
                    hide-details
                  >
                    <v-tooltip
                      bottom
                      open-delay="300"
                      max-width="450"
                      offset-overflow
                    >
                      <template #activator="{ on }">
                        <div
                          class="mb-4"
                          v-on="on"
                        >
                          <v-radio
                            label="Minimize to tray and keep in memory (recommended)"
                            value="minimizeAppToTray"
                          />
                        </div>
                      </template>
                      <span>
                        <strong>
                          When the app main window is closed, all features will remain active and
                          trigger without a delay (features like global shortcuts, auto updating, etc).
                        </strong>
                      </span>
                    </v-tooltip>

                    <v-tooltip
                      bottom
                      open-delay="300"
                      max-width="450"
                      offset-overflow
                    >
                      <template #activator="{ on }">
                        <div
                          class="mb-4"
                          v-on="on"
                        >
                          <v-radio
                            label="Minimize to tray and minimize memory usage"
                            value="closeMainWindow"
                          />
                        </div>
                      </template>
                      <span>
                        <p>
                          When the app main window is closed:
                        </p>
                        <strong>
                          <v-icon color="teal">mdi-circle-medium</v-icon>
                          The following features will remain active:
                        </strong>
                        <div class="ml-4 my-2">
                          - Auto updating
                        </div>

                        <strong>
                          <v-icon color="orange">mdi-circle-medium</v-icon>
                          The following features will work with limitations. The app will take some time to load back into memory:
                        </strong>
                        <div class="ml-4 my-2">
                          - Global shortcuts: will trigger with a delay, the app will take some time to load.
                        </div>

                        <strong>
                          <v-icon color="red">mdi-circle-medium</v-icon>
                          The following features will not work:
                        </strong>
                        <div class="ml-4 my-2">
                          - Drive scan. Drives are scanned periodically to ensure features like global search can be used without a delay.
                        </div>
                        <!-- TODO: finish when the backup feature is added -->
                        <!-- Auto backups. The app keeps your data safe by performing data backups automatically (if the feature is enabled). -->
                      </span>
                    </v-tooltip>

                    <v-tooltip
                      bottom
                      open-delay="300"
                      max-width="450"
                      offset-overflow
                    >
                      <template #activator="{ on }">
                        <div v-on="on">
                          <v-radio
                            label="Close the app completely"
                            value="closeApp"
                          />
                        </div>
                      </template>
                      <span>
                        When the app main window is closed, all features stop working
                      </span>
                    </v-tooltip>
                  </v-radio-group>
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 1 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="ui-appearance"
            >
              <section-settings
                v-if="showSection('visual-effects')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-animation-play-outline'
                  },
                  title: 'Visual effects'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Window transparency effect
                  </div>
                  <v-switch
                    v-model="windowTransparencyEffectValue"
                    class="mt-0 pt-0 d-inline-flex"
                    label="Display window transparency effect"
                    hide-details
                  />

                  <v-expand-transition>
                    <div v-if="windowTransparencyEffect.value">
                      <div class="mt-2">
                        Overlay blur: {{windowTransparencyEffectBlur}}px
                      </div>
                      <v-layout align-center>
                        <v-slider
                          v-model="windowTransparencyEffectBlur"
                          class="align-center"
                          max="100"
                          min="0"
                          step="1"
                          hide-details
                          style="max-width: 250px"
                        />
                      </v-layout>

                      <div class="mt-2">
                        Overlay opacity: {{windowTransparencyEffectOpacity}}%
                      </div>
                      <v-layout align-center>
                        <v-slider
                          v-model="windowTransparencyEffectOpacity"
                          class="align-center"
                          max="20"
                          min="0"
                          step="1"
                          hide-details
                          style="max-width: 250px"
                        />
                      </v-layout>

                      <div class="mt-2">
                        Overlay parallax distance:
                        {{windowTransparencyEffectParallaxDistance}}
                      </div>
                      <v-layout align-center>
                        <v-slider
                          v-model="windowTransparencyEffectParallaxDistance"
                          class="align-center"
                          max="10"
                          min="0"
                          step="1"
                          hide-details
                          style="max-width: 250px"
                        />
                      </v-layout>

                      <v-layout align-center>
                        <v-autocomplete
                          v-model="windowTransparencyEffectDataBackgroundSelected"
                          :items="windowTransparencyEffectDataBackgroundItems"
                          item-text="fileNameBase"
                          label="Overlay background"
                          :menu-props="{
                            contentClass: 'custom-scrollbar',
                            offsetY: true
                          }"
                          attach
                          return-object
                          style="max-width: 400px"
                        />

                        <v-tooltip bottom>
                          <template #activator="{ on }">
                            <v-btn
                              class="button-1 ml-3"
                              depressed
                              small
                              v-on="on"
                              @click="setNextWindowTransparencyEffectBackground()"
                            >
                              <v-icon
                                size="18px"
                                color=""
                              >
                                mdi-autorenew
                              </v-icon>
                            </v-btn>
                          </template>
                          <span>Select next background</span>
                        </v-tooltip>
                      </v-layout>

                      <div>
                        <v-switch
                          v-model="windowTransparencyEffectLessProminentOnHomePage"
                          class="d-inline-flex mt-0 pt-0"
                          label="Make effect less prominent on home page"
                        />
                      </div>

                      <div>
                        <v-switch
                          v-model="windowTransparencyEffectSameSettingsOnAllPages"
                          class="d-inline-flex mt-0 pt-0"
                          label="Use the same settings for all pages"
                        />
                      </div>

                      <v-expand-transition>
                        <div v-if="!windowTransparencyEffectSameSettingsOnAllPages">
                          <div>
                            <v-switch
                              v-model="windowTransparencyEffectPreviewEffect"
                              class="d-inline-flex mt-0 pt-0"
                            >
                              <template #label>
                                <v-tooltip
                                  bottom
                                  max-width="400px"
                                >
                                  <template #activator="{ on }">
                                    <v-icon
                                      v-show="
                                        windowTransparencyEffectPreviewEffect &&
                                          windowTransparencyEffectOptionsSelectedPage.name !== 'settings'
                                      "
                                      color="red"
                                      v-on="on"
                                    >
                                      mdi-circle-medium
                                    </v-icon>
                                    Preview effect for selected page
                                  </template>
                                  <span>
                                    Disable after you finish customizing selected page to
                                    see the effects for "settings" page
                                  </span>
                                </v-tooltip>
                              </template>
                            </v-switch>
                          </div>

                          <v-select
                            v-model="windowTransparencyEffectOptionsSelectedPage"
                            class="mt-2"
                            :items="windowTransparencyEffectOptionsPages"
                            item-text="title"
                            return-object
                            label="Page to customize"
                            style="max-width: 400px"
                          >
                            <template #selection="{item}">
                              <v-icon class="mr-4">
                                {{item.icon}}
                              </v-icon>
                              <div>
                                {{item.title}}
                              </div>
                            </template>

                            <template #item="{item}">
                              <v-icon class="mr-4">
                                {{item.icon}}
                              </v-icon>
                              <div>
                                {{item.title}}
                              </div>
                            </template>
                          </v-select>

                          <div>
                            - Select page from the list and adjust settings to save.
                            <br />- The preview of the effect will be displayed on this page until you visit another page.
                          </div>
                        </div>
                      </v-expand-transition>
                    </div>
                  </v-expand-transition>

                  <div class="text--sub-title-1 mt-4">
                    Home banner effects
                  </div>
                  <v-switch
                    v-model="homeBannerMediaGlowEffectValue"
                    class="mt-0 pt-0 d-inline-flex"
                    label="Background glow effect"
                    hide-details
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('theme')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-palette'
                  },
                  title: 'Theme'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Theme type
                  </div>

                  <v-radio-group
                    v-model="themeType"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      label="Dark"
                      value="dark"
                    />

                    <v-radio
                      label="Light filter"
                      value="light-filter"
                    />

                    <v-radio
                      label="Light (in development)"
                      value="light"
                      disabled
                    />
                  </v-radio-group>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('visual-filters')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-filter-black-white'
                  },
                  title: 'Visual filters'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Filters
                  </div>

                  <v-switch
                    v-model="visualFiltersApplyFiltersToMediaElements"
                    class="mt-4 pt-0"
                    label="Apply filters to media elements (images, videos)"
                  />

                  <div class="mt-4">
                    Contrast: {{Math.round(visualFiltersContrastValue * 100)}}%
                  </div>

                  <v-slider
                    v-model="visualFiltersContrastValue"
                    class="align-center"
                    :min="visualFiltersContrast.min"
                    :max="visualFiltersContrast.max"
                    step="0.01"
                    hide-details
                    style="max-width: 250px"
                  />

                  <div class="mt-4">
                    Brightness: {{Math.round(visualFiltersBrightnessValue * 100)}}%
                  </div>

                  <v-slider
                    v-model="visualFiltersBrightnessValue"
                    class="align-center"
                    :min="visualFiltersBrightness.min"
                    :max="visualFiltersBrightness.max"
                    step="0.01"
                    hide-details
                    style="max-width: 250px"
                  />

                  <div class="mt-4">
                    Saturation: {{Math.round(visualFiltersSaturationValue * 100)}}%
                  </div>

                  <v-slider
                    v-model="visualFiltersSaturationValue"
                    class="align-center"
                    :min="visualFiltersSaturation.min"
                    :max="visualFiltersSaturation.max"
                    step="0.05"
                    hide-details
                    style="max-width: 250px"
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('animations')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-animation-play-outline'
                  },
                  title: 'Animations'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Home page animations
                  </div>

                  <v-switch
                    v-model="animationsOnRouteChangeMediaBannerIn"
                    class="mt-0 pt-0"
                    label="Home banner animation"
                    hint="Setting will apply on the next page change"
                    persistent-hint
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('date-time')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-timetable'
                  },
                  title: 'Date / time'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Month format
                  </div>

                  <v-radio-group
                    v-model="dateTimeMonth"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      label="Numeric"
                      value="numeric"
                    />
                    <v-radio
                      label="Short"
                      value="short"
                    />
                  </v-radio-group>

                  <div class="mt-2">
                    Example:
                    <span class="inline-code--light">
                      {{localDateTimeExample}}
                    </span>
                  </div>
                </template>
              </section-settings>

              <template v-if="$utils.platform === 'win32'">
                <section-settings
                  v-if="showSection('overlays')"
                  class="content-area__content-card__section"
                  :header="{
                    icon: {
                      name: 'mdi-layers-outline'
                    },
                    title: 'Overlays'
                  }"
                >
                  <template #content>
                    <v-switch
                      v-model="navPanelDriveLetterOverlayValue"
                      label="Navigation panel | drive letter overlay"
                      class="mt-0 pt-0"
                      hide-details
                    />
                  </template>
                </section-settings>
              </template>

              <section-settings
                v-if="showSection('ui-elements')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-outline'
                  },
                  title: 'UI elements'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Directory item icon background color
                  </div>

                  <v-radio-group
                    v-model="dirItemBackground"
                    class="py-0 mt-0 mb-6"
                    hide-details
                  >
                    <v-radio
                      label="None"
                      value="none"
                    />
                    <v-radio
                      label="Minimal"
                      value="minimal"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    Item card design
                  </div>

                  <v-radio-group
                    v-model="itemCardDesign"
                    class="py-0 mt-0 mb-6"
                    hide-details
                  >
                    <v-radio
                      label="Neoinfusive-extruded"
                      value="neoinfusive-extruded"
                    />
                    <v-radio
                      label="Neoinfusive-flat-glow"
                      value="neoinfusive-flat-glow"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    Dashboard options
                  </div>

                  <v-switch
                    v-model="dashboardTimeline"
                    label="Show timeline"
                    class="mt-0 pt-0"
                  />

                  <div class="text--sub-title-1 mt-2">
                    Home page cards
                  </div>

                  <v-switch
                    v-model="showUserNameOnUserHomeDir"
                    label="Show user name on 'home directory' card"
                    class="mt-0 pt-0"
                  />

                  <v-switch
                    v-model="driveCardShowProgress"
                    label="Show drive space indicator"
                    class="mt-0 pt-0"
                  />

                  <div v-show="driveCardShowProgress">
                    <div class="text--sub-title-1 mt-2">
                      Drive space indicator style
                    </div>

                    <v-radio-group
                      v-model="driveCardProgressType"
                      class="py-0 mt-0"
                      hide-details
                    >
                      <v-radio
                        label="Linear | vertical"
                        value="linearVertical"
                      />
                      <v-radio
                        label="Linear | horizontal"
                        value="linearHorizontal"
                      />
                      <v-radio
                        label="Linear | horizontal | centered"
                        value="linearHorizontalCentered"
                      />
                      <v-radio
                        label="Circular"
                        value="circular"
                      />
                    </v-radio-group>
                  </div>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('home-page-media-banner')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-outline'
                  },
                  title: 'Home page media banner'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Banner options
                  </div>

                  <v-radio-group
                    v-model="homeBannerValue"
                    hide-details
                    class="py-0 mt-0"
                  >
                    <v-radio
                      label="Display media banner"
                      :value="true"
                    />
                    <v-radio
                      label="Hide media banner"
                      :value="false"
                    />
                  </v-radio-group>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('info-panel')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-information-outline'
                  },
                  title: 'Info panel'
                }"
              >
                <template #description>
                  Info panel is located on the navigator page.
                  <br />It displays information about the last selected item.
                </template>
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Info panel options
                  </div>

                  <v-switch
                    v-model="navigatorViewInfoPanel"
                    class="mt-0 pt-0"
                    label="Show info panel"
                    hide-details
                  />

                  <v-tooltip
                    bottom
                    open-delay="300"
                    max-width="400px"
                    offset-overflow
                  >
                    <template #activator="{ on }">
                      <div
                        style="display: inline-block;"
                        v-on="on"
                      >
                        <v-switch
                          v-model="autoCalculateDirSize"
                          hide-details
                        >
                          <template #label>
                            <v-icon
                              v-show="autoCalculateDirSize"
                              color="red"
                            >
                              mdi-circle-medium
                            </v-icon>
                            Calculate directory size automatically
                          </template>
                        </v-switch>
                      </div>
                    </template>
                    <span>
                      <div>
                        <strong>Warning:</strong> this is a computationally intensive feature,
                        so it's recommended to turn it on only on computers with a
                        powerful CPU and an SSD. It's also recommended to disable
                        it on laptops, since it increases battery usage.
                      </div>
                      <div class="mt-2">
                        <strong>Description:</strong> When you open or select a directory,
                        the app will automatically calculate and display its full size.
                      </div>
                      <div class="mt-2">
                        For most directories it takes less than 1 second to calculate the size.
                        If the operation takes longer than that, it will be canceled.
                      </div>
                    </span>
                  </v-tooltip>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('navigator')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-view-list'
                  },
                  title: 'Navigator'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Dividers / Titles
                  </div>

                  <v-switch
                    v-model="showDirItemKindDividers"
                    class="mt-0 pt-0"
                    label="Show dividers between files and directories"
                    hide-details
                  />

                  <div class="text--sub-title-1 mt-4">
                    Sorting element display type
                  </div>

                  <v-radio-group
                    v-model="navigatorSortingElementDisplayType"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      label="Show sorting icon"
                      value="icon"
                    />
                    <v-radio
                      label="Show sorting bar"
                      value="bar"
                    />
                  </v-radio-group>

                  <!-- TODO: finish in v1.x(see TODO in ActionToolbar.vue) -->
                  <!-- <div class="text--sub-title-1 mt-2">
                    Directory navigator options
                  </div>
                  <v-switch
                    v-model="groupDirItems"
                    label="Group directory items"
                    class="mt-0 pt-0"
                  ></v-switch> -->

                  <div class="text--sub-title-1 mt-4">
                    Navigator view layout
                  </div>

                  <v-radio-group
                    v-model="navigatorLayout"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      label="List layout"
                      value="list"
                    />
                    <v-radio
                      label="Grid layout"
                      value="grid"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-4">
                    Navigator item hover effect
                  </div>

                  <v-radio-group
                    v-model="dirItemHoverEffect"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      label="Scale"
                      value="scale"
                    />
                    <v-radio
                      label="Highlight"
                      value="highlight"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-4">
                    Navigator item list
                  </div>

                  <p>
                    <b>OCD | 'Name' column max width:</b>
                    files with disproportionately long names make the file list look messy,
                    so it's recommended to set the name column max width to a lower value,
                    like 50%, to make it look more organized
                  </p>

                  <v-text-field
                    v-model="navigatorNameColumnMaxWidth"
                    label="'Name' column max width (CSS value)"
                    style="max-width: 400px"
                  />
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 2 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="shortcuts"
            >
              <section-settings
                v-if="showSection('shortcuts')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-pound',
                  },
                  title: 'Shortcuts'
                }"
              >
                <template #content>
                  <shortcut-list />
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 3 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="performance"
            >
              <section-settings
                v-if="showSection('gpu-system-memory')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-expansion-card-variant',
                  },
                  title: 'GPU / System memory'
                }"
              >
                <template #content>
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 4 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="tabs-and-workspaces"
            >
              <section-settings
                v-if="showSection('workspaces')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-vector-arrange-below',
                  },
                  title: 'Workspaces'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Workspaces menu
                  </div>
                  <v-switch
                    v-model="showWorkspaceTitleInToolbar"
                    class="my-0"
                    label="Show workspace title in window toolbar"
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('tabs')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-tab',
                  },
                  title: 'Tabs'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Tab behavior
                  </div>
                  <v-radio-group
                    v-model="navigatorTabBehavior"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-tooltip
                      bottom
                      max-width="300px"
                    >
                      <template #activator="{ on }">
                        <v-radio
                          label="Immutable"
                          value="immutable"
                          v-on="on"
                        />
                      </template>
                      <span>If enabled, tabs behave as pinned directories rather than traditional tabs</span>
                    </v-tooltip>
                    <v-radio
                      label="Traditional (in development)"
                      value="traditional"
                      disabled
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    Tab layout
                  </div>
                  <v-radio-group
                    v-model="navigatorTabLayout"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      label="Compact vertical"
                      value="compact-vertical"
                    />
                    <v-radio
                      label="Compact vertical + traditional horizontal"
                      value="compact-vertical-and-traditional-horizontal"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    Options
                  </div>
                  <v-switch
                    v-model="closeAppWindowWhenLastWorkspaceTabIsClosed"
                    class="my-0"
                    label="Close app window when all current workspace tabs are closed"
                  />
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 5 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="navigation"
            >
              <section-settings
                v-if="showSection('navigator-history')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-tab',
                  },
                  title: 'Navigator history'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    History navigation style
                  </div>
                  <v-radio-group
                    v-model="navigatorhistoryNavigationStyleSelected"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-tooltip
                      bottom
                      max-width="400px"
                    >
                      <template #activator="{ on }">
                        <v-radio
                          label="Sigma default"
                          value="sigma-default"
                          v-on="on"
                        />
                      </template>
                      <span>
                        This custom Sigma history style allows you to get back to previously opened paths,
                        even after inserting a new path into the history while navigating the history stack.
                        <br /><strong>Example:</strong>
                        <br />- Open directory <span class="inline-code--light py-0">"/user"</span>
                        <br />- Open directory <span class="inline-code--light py-0">"/user/pictures"</span>
                        <br />- Open directory <span class="inline-code--light py-0">"/user/pictures/screenshots"</span>
                        <br />If you now go back to directory
                        <span class="inline-code--light py-0">"/user/pictures"</span>
                        and then go back again to
                        <span class="inline-code--light py-0">"/user"</span>
                        and then open
                        <span class="inline-code--light py-0">"/user/videos"</span>,
                        you will still be able to go back in history to the previous directories by pressing
                        "go back" or "go forward" button.
                      </span>
                    </v-tooltip>

                    <v-tooltip
                      bottom
                      max-width="400px"
                    >
                      <template #activator="{ on }">
                        <v-radio
                          label="Traditional"
                          value="traditional"
                          v-on="on"
                        />
                      </template>
                      <span>
                        This is a traditional history style, used in vast majority of apps.
                        It overwrites all succeding paths when you insert a new path anywhere other than the end,
                        which means once you go back in history and open some other directory, all succedding entries will be gone.
                        <br /><strong>Example:</strong>
                        <br />- Open directory <span class="inline-code--light py-0">"/user"</span>
                        <br />- Open directory <span class="inline-code--light py-0">"/user/pictures"</span>
                        <br />- Open directory <span class="inline-code--light py-0">"/user/pictures/screenshots"</span>
                        <br />If you now go back to directory
                        <span class="inline-code--light py-0">"/user/pictures"</span>
                        and then go back again to
                        <span class="inline-code--light py-0">"/user"</span>
                        and then open
                        <span class="inline-code--light py-0">"/user/videos"</span>,
                        you will NOT be able to go back in history to the previous directories by pressing
                        "go back" or "go forward" button, because
                        they were overwritten and the history now only has 2 directories:
                        <span class="inline-code--light py-0">"/user"</span>
                        and
                        <span class="inline-code--light py-0">"/user/videos"</span>.
                      </span>
                    </v-tooltip>
                  </v-radio-group>
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 6 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="input"
            >
              <section-settings
                v-if="showSection('input-navigator')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-folder-outline'
                  },
                  title: 'Navigator'
                }"
              >
                <template #content>
                  <div>
                    <div class="text--sub-title-1 mt-2">
                      Directory items
                    </div>

                    <div class="mb-5">
                      <v-switch
                        v-model="navigatorShowHiddenDirItems"
                        class="my-0"
                        label="Show Hidden Items"
                      />

                      <v-switch
                        v-model="navigatorOpenDirItemWithSingleClick"
                        class="my-0"
                        label="Open with single click"
                        hide-details
                      />

                      <div
                        v-show="navigatorOpenDirItemWithSingleClick"
                        class="mt-3"
                      >
                        Hold <span class="inline-code--light">Alt</span> button to select the item without opening it
                      </div>
                    </div>

                    <div class="mb-0">
                      <v-text-field
                        v-show="!navigatorOpenDirItemWithSingleClick"
                        v-model="validatedOpenDirItemSecondClickDelay"
                        label="Double-click delay (ms)"
                        :error="!checkedOpenDirItemSecondClickDelay.isValid"
                        :hint="checkedOpenDirItemSecondClickDelay.error"
                        style="max-width: 200px"
                      />
                    </div>
                  </div>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('input-elements')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-form-textbox'
                  },
                  title: 'Input elements'
                }"
              >
                <template #content>
                  <div>
                    <div class="text--sub-title-1 mt-2">
                      Filter options
                    </div>
                    <v-switch
                      class="my-0"
                      v-model="focusFilterOnDirectoryChange"
                      label="Focus filter field automatically when directory changes"
                      hide-details
                    ></v-switch>

                    <div class="text--sub-title-1 mt-2">
                      Helpers
                    </div>
                    <v-switch
                      v-model="spellcheck"
                      class="my-0"
                      label="Spellcheck"
                      hide-details
                    />
                  </div>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('mouse-buttons')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-mouse'
                  },
                  title: 'Mouse buttons'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Button actions
                  </div>

                  <v-select
                    v-model="pointerButton3onMouseUpEvent"
                    :items="pointerButton3onMouseUpEventItems"
                    return-object
                    item-text="title"
                    label="Mouse button 3"
                    style="max-width: 400px"
                  />

                  <v-select
                    v-model="pointerButton4onMouseUpEvent"
                    :items="pointerButton4onMouseUpEventItems"
                    return-object
                    item-text="title"
                    label="Mouse button 4"
                    style="max-width: 400px"
                  />
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 7 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="search"
            >
              <section-settings
                v-if="showSection('global-search')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-magnify',
                    size: '26px'
                  },
                  title: 'Global search'
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    Quick actions
                  </div>

                  <div class="button-container">
                    <v-btn
                      class="button-1"
                      depressed
                      small
                      @click="$eventHub.$emit('app:method', {
                        method: 'initGlobalSearchDataScan'
                      })"
                    >
                      <v-icon
                        class="mr-2"
                        small
                      >
                        mdi-refresh
                      </v-icon>
                      re-scan drives
                    </v-btn>

                    <v-btn
                      class="button-1"
                      depressed
                      small
                      @click="$store.dispatch('LOAD_DIR', {
                        path: appPaths.storageDirectories.appStorageGlobalSearchData
                      })"
                    >
                      <v-icon
                        class="mr-2"
                        small
                      >
                        mdi-folder-outline
                      </v-icon>
                      Open search data directory
                    </v-btn>
                  </div>

                  <div
                    class="mt-4"
                    v-html="$localize.get('text_allow_global_search_message')"
                  />

                  <div>
                    <div class="text--sub-title-1 mt-2">
                      Search data
                    </div>

                    <updating-component :component="'lastScanTimeElapsed'" />
                    <!-- TODO:  -->
                    <!-- <v-text-field
                      class="mt-4"
                      v-model="appPaths.storageDirectories.appStorageGlobalSearchData"
                      label="File location"
                      disabled hide-details
                      style="max-width: 600px"
                    ></v-text-field>

                    <v-btn
                      class="button-1 my-4 mr-3"
                      @click="$utils.copyToClipboard({text: appPaths.storageDirectories.appStorageGlobalSearchData})"
                      depressed small
                    >
                      <v-icon small class="mr-2">
                        far fa-copy
                      </v-icon>
                      Copy path
                    </v-btn> -->
                  </div>

                  <div class="text--sub-title-1 mt-2">
                    Search options
                  </div>

                  <v-select
                    v-model="globalSearchAutoScanIntervalTime"
                    :items="globalSearchAutoScanIntervalItems"
                    :label="`Auto scan period ${disabledInDev}`"
                    :disabled="scanInProgress"
                    :menu-props="{
                      contentClass: 'custom-scrollbar',
                      offsetY: true
                    }"
                    style="max-width: 200px"
                  >
                    <template #selection="{ item }">
                      {{$utils.formatTime(item, 'ms', 'auto')}}
                    </template>
                    <template #item="{ item }">
                      {{$utils.formatTime(item, 'ms', 'auto')}}
                    </template>
                  </v-select>

                  <v-tooltip
                    bottom
                    open-delay="300"
                    max-width="400px"
                    offset-overflow
                  >
                    <template #activator="{ on }">
                      <div
                        style="display: inline-block;"
                        v-on="on"
                      >
                        <v-select
                          v-model="globalSearchScanDepth"
                          class="mt-0"
                          :items="suggestedGlobalSearchScanDepthItems"
                          :disabled="scanInProgress"
                          label="Scan depth"
                          :menu-props="{
                            contentClass: 'custom-scrollbar',
                            offsetY: true
                          }"
                          style="max-width: 200px"
                          @blur="handleBlurGlobalSearchScanDepth"
                        >
                          <template #selection>
                            {{globalSearchScanDepth}} directories
                          </template>
                          <template #item="{item}">
                            {{item}} directories
                          </template>
                        </v-select>
                      </div>
                    </template>
                    <span>
                      Higher depth scans will increase both the scan and the search time,
                      but will allow you to find files located in more deeply nested directories.
                    </span>
                  </v-tooltip>

                  <div>
                    <v-tooltip
                      bottom
                      open-delay="300"
                      max-width="400px"
                      offset-overflow
                    >
                      <template #activator="{ on }">
                        <div
                          class="d-inline-flex"
                          v-on="on"
                        >
                          <v-switch
                            v-model="globalSearchCompressSearchData"
                            class="mt-0"
                            :disabled="scanInProgress"
                            @change="$eventHub.$emit('app:method', {
                              method: 'initGlobalSearchDataScan'
                            })"
                          >
                            <template #label>
                              <v-icon
                                v-show="!globalSearchCompressSearchData"
                                color="red"
                              >
                                mdi-circle-medium
                              </v-icon>
                              Compress search data
                            </template>
                          </v-switch>
                        </div>
                      </template>
                      <span>
                        Compression significantly reduces the amount of space needed for
                        search data (up to 20 times less) but search scans take longer (~2 times).
                      </span>
                    </v-tooltip>
                  </div>

                  <v-combobox
                    v-model="globalSearchDisallowedPaths"
                    :items="globalSearchDisallowedPathsItems"
                    label="Ignored paths"
                    :disabled="scanInProgress"
                    multiple
                    style="max-width: 400px"
                  >
                    <template #prepend-item>
                      <v-list-item>
                        <v-list-item-content>
                          <v-list-item-title>
                            Enter a path to add to the ignored list and press
                            <span class="inline-code--light">Enter</span>
                          </v-list-item-title>
                        </v-list-item-content>
                      </v-list-item>
                    </template>
                    <template #item="{item}">
                      <v-list-item @click.stop="toggleGlobalSearchDisallowedPathItem(item)">
                        <v-list-item-action>
                          <v-icon>
                            {{globalSearchDisallowedPaths.includes(item)
                              ? 'mdi-check-box-outline'
                              : 'mdi-checkbox-blank-outline'}}
                          </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                          <v-list-item-title>
                            {{item}}
                          </v-list-item-title>
                        </v-list-item-content>
                        <v-list-item-action>
                          <v-btn
                            icon
                            @click.stop="removeItemFromGlobalSearchDisallowedPathsItems(item)"
                          >
                            <v-icon>mdi-close</v-icon>
                          </v-btn>
                        </v-list-item-action>
                      </v-list-item>
                    </template>
                    <template #selection="{item, index}">
                      <v-chip
                        v-if="index < 2"
                        small
                      >
                        <span>{{item}}</span>
                      </v-chip>
                      <span
                        v-if="index === 2"
                        class="grey--text caption"
                      >
                        (+{{globalSearchDisallowedPaths.length - 2}} others)
                      </span>
                    </template>
                  </v-combobox>

                  <div class="text--sub-title-1 mt-2">
                    Time estimates
                  </div>
                  <div>
                    <v-icon :color="estimatedGlobalSearchScanTime.color">
                      mdi-circle-medium
                    </v-icon>
                    Estimated data scan time:
                    <span
                      class="ml-1"
                      style="font-size: 14px;"
                    >
                      {{estimatedGlobalSearchScanTime.time}}
                      (per 1 TB drive)
                    </span>
                  </div>
                  <div>
                    <v-icon :color="estimatedGlobalSearchTime.color">
                      mdi-circle-medium
                    </v-icon>
                    Estimated search time:
                    <span
                      class="ml-1"
                      style="font-size: 14px;"
                    >
                      1 sec — {{estimatedGlobalSearchTime.time}}
                      (per 1 TB drive per search word) | depends on file location
                    </span>
                  </div>
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 8 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="data-and-storage"
            >
              <section-settings
                v-if="showSection('data-backup-reminder')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-information-outline'
                  },
                  title: 'Reminder: data backup'
                }"
              >
                <template #content>
                  <p>
                    It's recommended to regularly backup (copy)
                    all your important files to an external drive
                    (which is not connected to your computer most of the time),
                    so if something goes wrong, you don't lose important files.
                  </p>
                  <p>
                    The auto-backup feature will be added in one of the next versions of the app
                  </p>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('drive-detection')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'fab fa-usb'
                  },
                  title: 'Drive detection'
                }"
              >
                <template #content>
                  <v-checkbox
                    v-model="focusMainWindowOnDriveConnected"
                    label="Focus the app when a drive is connected"
                    hide-details
                    class="mt-0"
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('image-thumbnails')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-outline'
                  },
                  title: 'Image thumbnails'
                }"
              >
                <template #description>
                  Every time you open a directory, the app generates a small thumbnail for every image
                  and stores it in the app drectory. This image caching technique improves app performance.
                  When the specified limit is reached, all thumbnails are deleted.
                </template>
                <template #content>
                  <div class="text--sub-title-1">
                    Thumbnail storage limit
                  </div>

                  <div>Limit: {{thumbnailStorageLimit}} MB</div>

                  <v-slider
                    v-model="thumbnailStorageLimit"
                    class="align-center"
                    max="1000"
                    min="10"
                    step="10"
                    hide-details
                    style="max-width: 250px"
                  />
                </template>
              </section-settings>
            </div>

            <!-- tab:stats -->
            <div
              v-show="settingsSelectedTab === 9 || filterQuery !== ''"
              class="fade-in-500ms"
              tab="general"
            >
              <section-settings
                v-if="showSection('directory-item-statistics')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-crop'
                  },
                  title: 'Directory item statistics'
                }"
              >
                <template #description>
                  <p>
                    If enabled, the app will store some event data of your interactions with
                    directories / files, for example, when and how many times they were opened.
                  </p>
                  <p>
                    This data is used by features like "timeline" and "search".
                  </p>
                </template>
                <template #content>
                  <div class="text--sub-title-1">
                    Statistics storing
                  </div>

                  <div
                    class="setting-container"
                    @mouseenter="handleMouseEnterSetting({name: 'storeDirItemOpenEvent'})"
                  >
                    <v-switch
                      v-model="storeDirItemOpenEvent"
                      label="Store the list of opened directory items"
                      hide-details
                    />
                  </div>

                  <div
                    class="setting-container"
                    @mouseenter="handleMouseEnterSetting({name: 'storeDirItemOpenCount'})"
                  >
                    <v-switch
                      v-if="storeDirItemOpenEvent"
                      v-model="storeDirItemOpenCount"
                      label="Store the amount of times a directory item was opened"
                      hide-details
                    />
                  </div>

                  <v-switch
                    v-if="storeDirItemOpenEvent"
                    v-model="storeDirItemOpenDate"
                    label="Store the date of opening a directory item"
                    hide-details
                  />

                  <p class="mt-6">
                    The statistics data is stored in the file called "stats.json"
                    located in the app directory.
                  </p>
                  <v-btn
                    class="button-1 mb-2"
                    depressed
                    small
                    @click="$store.dispatch('LOAD_DIR', { path: appPaths.storageDirectories.appStorage })"
                  >
                    <v-icon
                      class="mr-2"
                      small
                    >
                      mdi-folder-outline
                    </v-icon>
                    Open file location
                  </v-btn>
                </template>
              </section-settings>
            </div>
          </v-tabs-items>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import SectionSettings from '../components/SectionSettings.vue'
import itemFilter from '../utils/itemFilter'

export default {
  name: 'settings',
  components: {
    SectionSettings
    SectionSettings,
  },
  beforeRouteLeave (to, from, next) {
    this.$store.dispatch('SAVE_ROUTE_SCROLL_POSITION', {
      toRoute: to,
      fromRoute: from,
    })
    next()
  },
  data () {
    return {
      githubProjectData: {
        stars: 0,
      },
      settingsSelectedTab: 0,
      settingsTabs: [
        {text: 'General'},
        {text: 'UI appearance'},
        {text: 'Shortcuts'},
        {text: 'Performance'},
        {text: 'Tabs & workspaces'},
        {text: 'Navigation'},
        {text: 'Input'},
        {text: 'Search'},
        {text: 'Data & storage'},
        {text: 'Stats'},
      ],
      suggestedGlobalSearchScanDepthItems: [3, 4, 5, 6, 7, 8, 9, 10],
    }
  },
  watch: {
    windowTransparencyEffectOptionsSelectedPage: {
      handler () {
        let pageIndex = this.windowTransparencyEffectOptionsPages.findIndex(page => {
          return page.name === this.windowTransparencyEffectOptionsSelectedPage.name
        })
        let clone = this.$utils.cloneDeep(this.windowTransparencyEffectOptionsPages)
        clone[pageIndex] = this.windowTransparencyEffectOptionsSelectedPage
        this.windowTransparencyEffectOptionsPages = clone
        // Turn on preview automatically
        if (!this.windowTransparencyEffectPreviewEffect) {
          this.windowTransparencyEffectPreviewEffect = true
        }
      },
      deep: true,
    },
    windowTransparencyEffectSameSettingsOnAllPages (newValue) {
      if (newValue) {
        this.windowTransparencyEffectOptionsSelectedPage = this.windowTransparencyEffectOptionsPages.find(page => {
          return page.name === ''
        })
      }
    },
    settingsSelectedTab (value) {
      this.lastOpenedSettingsTabValue = value
    },
    globalSearchDisallowedPaths () {
      this.globalSearchDisallowedPathsItems = [...new Set([
        ...this.globalSearchDisallowedPathsItems,
        ...this.globalSearchDisallowedPaths,
      ])]
    },
    autoCheckForAppUpdates (value) {
      if (value) {
        this.$store.dispatch('INIT_APP_UPDATER')
      }
      else if (!value) {
        this.$store.dispatch('STOP_APP_UPDATER')
        this.autoDownloadAppUpdates = false
        this.autoInstallAppUpdates = false
      }
    },
    storeDirItemOpenEvent (newValue) {
      if (!newValue) {
        this.$store.dispatch('SET', {
          key: 'storageData.stats.dirItemsTimeline',
          value: [],
        })
      }
    },
  },
  beforeCreate () {
    const models = {
      storeDirItemOpenEvent: 'storageData.settings.stats.storeDirItemOpenEvent',
      storeDirItemOpenCount: 'storageData.settings.stats.storeDirItemOpenCount',
      storeDirItemOpenDate: 'storageData.settings.stats.storeDirItemOpenDate',
      globalSearchCompressSearchData: 'storageData.settings.compressSearchData',
      globalSearchScanDepth: 'storageData.settings.globalSearchScanDepth',
      globalSearchAutoScanIntervalTime: 'storageData.settings.globalSearchAutoScanIntervalTime',
      globalSearchAutoScanIntervalItems: 'storageData.settings.globalSearchAutoScanIntervalItems',
      autoCheckForAppUpdates: 'storageData.settings.appUpdates.autoCheck',
      autoDownloadAppUpdates: 'storageData.settings.appUpdates.autoDownload',
      autoInstallAppUpdates: 'storageData.settings.appUpdates.autoInstall',
      windowCloseButtonAction: 'storageData.settings.windowCloseButtonAction',
      themeType: 'storageData.settings.theme.type',
      showDirItemKindDividers: 'storageData.settings.navigator.showDirItemKindDividers',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
      navigatorLayout: 'storageData.settings.navigatorLayout',
      showWorkspaceTitleInToolbar: 'storageData.settings.navigator.workspaces.showTitleInToolbar',
      navigatorTabBehavior: 'storageData.settings.navigator.tabs.tabBehavior',
      navigatorTabLayout: 'storageData.settings.navigator.tabs.layout',
      closeAppWindowWhenLastWorkspaceTabIsClosed: 'storageData.settings.navigator.tabs.closeAppWindowWhenLastWorkspaceTabIsClosed',
      navigatorhistoryNavigationStyleSelected: 'storageData.settings.navigator.historyNavigationStyle.selected',
      navigatorShowHiddenDirItems: 'storageData.settings.navigator.showHiddenDirItems',
      navigatorOpenDirItemWithSingleClick: 'storageData.settings.navigator.openDirItemWithSingleClick',
      dirItemHoverEffect: 'storageData.settings.dirItemHoverEffect',
      navigatorNameColumnMaxWidth: 'storageData.settings.navigator.nameColumnMaxWidth',
      windowTransparencyEffectValue: 'storageData.settings.windowTransparencyEffect.value',
      windowTransparencyEffectLessProminentOnHomePage: 'storageData.settings.windowTransparencyEffect.lessProminentOnHomePage',
      windowTransparencyEffectPreviewEffect: 'storageData.settings.windowTransparencyEffect.previewEffect',
      windowTransparencyEffectSameSettingsOnAllPages: 'storageData.settings.windowTransparencyEffect.sameSettingsOnAllPages',
      windowTransparencyEffectOptionsPages: 'storageData.settings.windowTransparencyEffect.options.pages',
      windowTransparencyEffectOptionsSelectedPage: 'storageData.settings.windowTransparencyEffect.options.selectedPage',
      windowTransparencyEffectBlur: 'storageData.settings.windowTransparencyEffect.options.selectedPage.blur',
      windowTransparencyEffectOpacity: 'storageData.settings.windowTransparencyEffect.options.selectedPage.opacity',
      windowTransparencyEffectParallaxDistance: 'storageData.settings.windowTransparencyEffect.options.selectedPage.parallaxDistance',
      windowTransparencyEffectDataBackgroundItems: 'storageData.settings.windowTransparencyEffect.data.background.items',
      windowTransparencyEffectDataBackgroundSelected: 'storageData.settings.windowTransparencyEffect.options.selectedPage.background',
      homeBannerMediaGlowEffectValue: 'storageData.settings.visualEffects.homeBannerMediaGlowEffect.value',
      animationsOnRouteChangeMediaBannerIn: 'storageData.settings.animations.onRouteChangeMediaBannerIn',
      visualFiltersApplyFiltersToMediaElements: 'storageData.settings.visualFilters.applyFiltersToMediaElements',
      visualFiltersContrast: 'storageData.settings.visualFilters.contrast',
      visualFiltersContrastValue: 'storageData.settings.visualFilters.contrast.value',
      visualFiltersBrightness: 'storageData.settings.visualFilters.brightness',
      visualFiltersBrightnessValue: 'storageData.settings.visualFilters.brightness.value',
      visualFiltersSaturation: 'storageData.settings.visualFilters.saturation',
      visualFiltersSaturationValue: 'storageData.settings.visualFilters.saturation.value',
      dateTimeMonth: 'storageData.settings.dateTime.month',
      navPanelDriveLetterOverlayValue: 'storageData.settings.overlays.navPanelDriveLetterOverlay.value',
      pointerButton3onMouseUpEvent: 'storageData.settings.input.pointerButtons.button3.onMouseUpEvent',
      pointerButton3onMouseUpEventItems: 'storageData.settings.input.pointerButtons.button3.onMouseUpEventItems',
      pointerButton4onMouseUpEvent: 'storageData.settings.input.pointerButtons.button4.onMouseUpEvent',
      pointerButton4onMouseUpEventItems: 'storageData.settings.input.pointerButtons.button4.onMouseUpEventItems',
      thumbnailStorageLimit: 'storageData.settings.thumbnailStorageLimit',
      driveCardProgressType: 'storageData.settings.driveCard.progressType',
      driveCardShowProgress: 'storageData.settings.driveCard.showProgress',
      focusMainWindowOnDriveConnected: 'storageData.settings.focusMainWindowOnDriveConnected',
      showUserNameOnUserHomeDir: 'storageData.settings.showUserNameOnUserHomeDir',
      autoCalculateDirSize: 'storageData.settings.autoCalculateDirSize',
      lastOpenedSettingsTabValue: 'storageData.settings.lastOpenedSettingsTab',
      groupDirItems: 'storageData.settings.groupDirItems',
      focusFilterOnDirectoryChange: 'storageData.settings.focusFilterOnDirectoryChange',
      navigatorViewInfoPanel: 'storageData.settings.infoPanels.navigatorView',
      selectedLanguage: 'storageData.settings.localization.selectedLanguage',
      availableLanguages: 'storageData.settings.localization.availableLanguages',
      spellcheck: 'storageData.settings.spellcheck',
      globalSearchDisallowedPathsItems: 'storageData.settings.globalSearch.disallowedPathsItems',
      appPropertiesOpenAtLogin: 'storageData.settings.appProperties.openAtLogin',
      appPropertiesOpenAsHidden: 'storageData.settings.appProperties.openAsHidden',
      homeBannerValue: 'storageData.settings.homeBanner.value',
      dirItemBackground: 'storageData.settings.dirItemBackground',
      itemCardDesign: 'storageData.settings.itemCardDesign',
      dashboardTimeline: 'storageData.settings.dashboard.tabs.timeline.show',
      openDirItemSecondClickDelay: 'storageData.settings.navigator.openDirItemSecondClickDelay',
      windowTransparencyEffect: 'storageData.settings.windowTransparencyEffect',
    }
    const objects = {}
    for (const [modelKey, modelValue] of Object.entries(models)) {
      objects[modelKey] = {
        get () {
          return this.$utils.getDeepProperty(this.$store.state, modelValue)
        },
        set (value) {
          this.$store.dispatch('SET', {
            key: modelValue,
            value,
          })
        },
      }
    }
    this.$options.computed = {
      ...this.$options.computed,
      ...objects,
    }
  },
  activated () {
    this.$store.dispatch('ROUTE_ACTIVATED_HOOK_CALLBACK', {
      route: 'settings',
    })
  },
  created () {
    this.settingsSelectedTab = this.lastOpenedSettingsTabValue
  },
  mounted () {
    this.fetchSettingsDataMap()
    this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
      route: 'settings',
    })
    this.fetchGithubProjectData()
  },
  computed: {
    ...mapFields({
      defaultData: 'defaultData',
      appVersion: 'appVersion',
      appPaths: 'storageData.settings.appPaths',
      windowSize: 'windowSize',
      shortcuts: 'storageData.settings.shortcuts',
      UIZoomLevel: 'storageData.settings.UIZoomLevel',
      toolbarColorItems: 'storageData.settings.theme.toolbarColorItems',
      scanInProgress: 'globalSearch.scanInProgress',
      settingsDataMap: 'settingsView.settingsDataMap',
      filterQuery: 'filterField.view.settings.query',
    }),
    validatedOpenDirItemSecondClickDelay: {
      get () {
        return this.openDirItemSecondClickDelay
      },
      set (value) {
        value = parseInt(value) || 0
        this.openDirItemSecondClickDelay = value
        if (this.checkedOpenDirItemSecondClickDelay.isValid) {
          this.$store.dispatch('SET', {
            key: 'storageData.settings.navigator.openDirItemSecondClickDelay',
            value,
          })
        }
      },
    },
    headerButtons () {
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
        {
          title: `Star | ${this.githubProjectData.stars}`,
          icon: 'mdi-star-outline',
          link: this.appPaths.githubRepoLink,
        },
      ]
    },
    UIButtons () {
      return [
        {
          title: this.$localize.get('tooltip_button_ui_zoom_decrease_title'),
          shortcut: this.shortcuts.zoomDecrease.shortcut,
          icon: 'mdi-minus',
          onClick: () => this.$store.dispatch('DECREASE_UI_ZOOM'),
        },
        {
          title: this.$localize.get('tooltip_button_ui_zoom_increase_title'),
          shortcut: this.shortcuts.zoomIncrease.shortcut,
          icon: 'mdi-plus',
          onClick: () => this.$store.dispatch('INCREASE_UI_ZOOM'),
        },
        {
          title: this.$localize.get('tooltip_button_ui_zoom_reset_title'),
          shortcut: this.shortcuts.zoomReset.shortcut,
          buttonText: this.$localize.get('settings_ui_zoom_button_reset'),
          onClick: () => this.$store.dispatch('RESET_UI_ZOOM'),
        },
        {
          title: this.$localize.get('tooltip_button_full_screen_title'),
          shortcut: this.shortcuts.fullScreen.shortcut,
          icon: 'mdi-fullscreen',
          onClick: () => this.$utils.toggleFullscreen(),
        },
      ]
    },
    globalSearchDisallowedPaths: {
      get () {
        return this.$store.state.storageData.settings.globalSearch.disallowedPaths
      },
      set (value) {
        this.$store.dispatch('SET_GLOBAL_SEARCH_DISALOWED_PATHS', value)
      },
    },
    UIZoomLevelInPercents () {
      return (this.UIZoomLevel * 100).toFixed(0)
    },
    disabledInDev () {
      return process.env.NODE_ENV === 'development'
        ? '::DEV_DISABLED'
        : ''
    },
    estimatedGlobalSearchScanTime () {
      // Note: values were reverse-engineered from the real-world usage.
      // They seem to estimate the time relatively accuratelly (+- 10 seconds)
      return this.getSearchTimeEstimates({
        timePerDepth: 0.8,
        colorTreshold: 120,
        complexity: this.globalSearchScanDepth ** 2,
        compressionMultiplier: this.globalSearchCompressSearchData ? 2 : 1,
      })
    },
    estimatedGlobalSearchTime () {
      return this.getSearchTimeEstimates({
        timePerDepth: 2,
        colorTreshold: 60,
        complexity: this.globalSearchScanDepth * 2.5,
        compressionMultiplier: 1,
      })
    },
    checkedOpenDirItemSecondClickDelay () {
      const value = parseInt(this.openDirItemSecondClickDelay)
      const minValue = 200
      const maxValue = 1000
      const validValueRange = minValue <= value && value <= maxValue
      if (!validValueRange) {
        return {
          isValid: false,
          error: 'The value should be in range 200 - 1000 (ms)',
          minValue,
          maxValue,
        }
      }
      else {
        return {
          isValid: true,
          error: '',
          minValue,
          maxValue,
        }
      }
    },
    localDateTimeExample () {
      return this.$utils.getLocalDateTime(
        Date.now(),
        this.$store.state.storageData.settings.dateTime,
      )
    },
    filteredSettings () {
      return itemFilter({
        filterQuery: this.filterQuery,
        items: this.settingsDataMap,
        filterProperties: this.$store.state.filterField.view[this.$route.name].filterProperties,
        filterQueryOptions: this.$store.state.filterField.view[this.$route.name].options,
      })
    },
  },
  methods: {
    fetchSettingsDataMap () {
      this.settingsDataMap = [
        {
          sectionName: 'language',
          tags: this.$localize.get('language_tags'),
        },
        {
          sectionName: 'ui-scaling',
          tags: this.$localize.get('ui_scaling_tags'),
        },
        {
          sectionName: 'updates',
          tags: this.$localize.get('updates_tags'),
        },
        {
          sectionName: 'app-properties',
          tags: this.$localize.get('app_properties_tags'),
        },
        {
          sectionName: 'window-controls',
          tags: this.$localize.get('window_controls_tags'),
        },
        {
          sectionName: 'visual-effects',
          tags: this.$localize.get('visual_effects_tags'),
        },
        {
          sectionName: 'theme',
          tags: this.$localize.get('theme_tags'),
        },
        {
          sectionName: 'visual-filters',
          tags: this.$localize.get('visual_filters_tags'),
        },
        {
          sectionName: 'animations',
          tags: this.$localize.get('animations_tags'),
        },
        {
          sectionName: 'date-time',
          tags: this.$localize.get('date_time_tags'),
        },
        {
          sectionName: 'overlays',
          tags: this.$localize.get('overlays_tags'),
        },
        {
          sectionName: 'ui-elements',
          tags: this.$localize.get('ui_elements_tags'),
        },
        {
          sectionName: 'home-page-media-banner',
          tags: this.$localize.get('home_page_media_banner_tags'),
        },
        {
          sectionName: 'info-panel',
          tags: this.$localize.get('info_panel_tags'),
        },
        {
          sectionName: 'navigator',
          tags: this.$localize.get('navigator_tags'),
        },
        {
          sectionName: 'shortcuts',
          tags: this.$localize.get('shortcuts_tags'),
        },
        {
          sectionName: 'gpu-system-memory',
          tags: this.$localize.get('gpu_system_memory_tags'),
        },
        {
          sectionName: 'workspaces',
          tags: this.$localize.get('workspaces_tags'),
        },
        {
          sectionName: 'tabs',
          tags: this.$localize.get('tabs_tags'),
        },
        {
          sectionName: 'navigator-history',
          tags: this.$localize.get('navigator_history_tags'),
        },
        {
          sectionName: 'input-navigator',
          tags: this.$localize.get('input_navigator_tags'),
        },
        {
          sectionName: 'input-elements',
          tags: this.$localize.get('input_elements_tags'),
        },
        {
          sectionName: 'mouse-buttons',
          tags: this.$localize.get('mouse_buttons_tags'),
        },
        {
          sectionName: 'global-search',
          tags: this.$localize.get('global_search_tags'),
        },
        {
          sectionName: 'data-backup-reminder',
          tags: this.$localize.get('data_backup_reminder_tags'),
        },
        {
          sectionName: 'drive-detection',
          tags: this.$localize.get('drive_detection_tags'),
        },
        {
          sectionName: 'image-thumbnails',
          tags: this.$localize.get('image_thumbnails_tags'),
        },
        {
          sectionName: 'directory-item-statistics',
          tags: this.$localize.get('directory_item_statistics_tags'),
        },
      ]
    },
    showSection (sectionName) {
      return this.filteredSettings.some(item => item.sectionName === sectionName)
    },
    getSearchTimeEstimates (params) {
      const searchScanTimePerDepthLevelInSeconds = params.timePerDepth
      const totalTimeInSeconds = searchScanTimePerDepthLevelInSeconds *
        params.complexity *
        params.compressionMultiplier
      const color = totalTimeInSeconds > params.colorTreshold
        ? 'red'
        : 'teal'
      return {
        time: this.$utils.prettyTime(totalTimeInSeconds),
        color,
      }
    },
    fetchGithubProjectData () {
      fetch(this.appPaths.githubRepoApiLink)
        .then(response => response.json())
        .then(repoData => {
          this.githubProjectData.stars = repoData.stargazers_count
          return repoData
        })
    },
    handleBlurGlobalSearchScanDepth () {
      this.globalSearchScanDepth = Math.max(3, this.globalSearchScanDepth)
      this.$eventHub.$emit('app:method', {
        method: 'initGlobalSearchDataScan',
      })
    },
    toggleGlobalSearchDisallowedPathItem (item) {
      if (!this.globalSearchDisallowedPaths.includes(item)) {
        const globalSearchDisallowedPathsClone = [...this.globalSearchDisallowedPaths]
        globalSearchDisallowedPathsClone.push(item)
        this.globalSearchDisallowedPaths = globalSearchDisallowedPathsClone
      }
      else {
        this.globalSearchDisallowedPaths = this.globalSearchDisallowedPaths
          .filter(listItem => listItem !== item)
      }
    },
    removeItemFromGlobalSearchDisallowedPathsItems (item) {
      this.globalSearchDisallowedPathsItems = this.globalSearchDisallowedPathsItems
        .filter(listItem => listItem !== item)
      this.globalSearchDisallowedPaths = this.globalSearchDisallowedPaths
        .filter(listItem => listItem !== item)
    },
    setNextWindowTransparencyEffectBackground () {
      let currentItemIndex = this.windowTransparencyEffectDataBackgroundItems
        .findIndex(item => item.path === this.windowTransparencyEffectDataBackgroundSelected.path)
      let nextItemIndex = 0
      if (currentItemIndex > this.windowTransparencyEffectDataBackgroundItems.length - 2) {
        nextItemIndex = 0
      }
      else {
        nextItemIndex = currentItemIndex + 1
      }
      this.windowTransparencyEffectDataBackgroundSelected = this.windowTransparencyEffectDataBackgroundItems[nextItemIndex]
    }
  }
}
</script>

<style>
#settings-view
  .content-area__header {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 48px;
    margin-bottom: 30px;
  }
  @media (max-width: 700px) {
    #settings-view
      .content-area__header {
        gap: 24px;
        margin-bottom: 12px;
        font-size: 14px;
      }
    #settings-view
      .content-area__header img {
        width: 48px;
      }
  }

#settings-view
  .content-area__header__content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

#settings-view
  .content-area__header__buttons {
    display: flex;
    align-items: center;
    gap: 12px;
  }

#settings-view
  .content-area__content-card {
    margin: 16px 0px;
    background-color: var(--bg-color-1);
    box-shadow: 0px 8px 32px rgb(0, 0, 0, 0.1);
  }

#settings-view
  .content-area__content-card__section:not(:last-child) {
    border-bottom: 1px solid var(--divider-color-2);
  }

#settings-view
  .tab-view {
    grid-template-columns: 1fr;
  }

#settings-view[filter-is-empty]
  .tab-view {
    grid-template-columns: 230px 1fr;
  }

#settings-view
  .tab-view
    .v-window {
      border-right: 1px solid var(--divider-color-2);
    }

#settings-view
  .settings-section__content {
    padding: 12px 16px;
    background-color: rgb(200, 200, 230, 0.04);
    border-radius: 8px;
    transition: all 0.1s ease;
  }
</style>
