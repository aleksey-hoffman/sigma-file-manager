<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div id="settings-view">
    <div
      class="content-area custom-scrollbar"
      id="content-area--settings-view"
    >
      <div class="content-area__title">
        {{$localize.get('page_settings_title')}}
      </div>
      <v-divider class="my-3"></v-divider>

      <div class="content-area__header">
        <img
          :src="$storeUtils.getSafePath(appPaths.public + '/icons/logo-1024x1024.png')"
          width="87px"
        >
        <div class="content-area__header__content">
          <div class="content-area__header__text">
            <strong>"Sigma File Manager"</strong> is a free, open source, advanced,
            modern file manager app, licensed under GNU GPLv3 or later.
            <br>Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
          </div>
          <div
            class="content-area__header__buttons"
            v-if="$vuetify.breakpoint.mdAndUp"
          >
            <v-tooltip
              v-for="(item, index) in headerButtons"
              :key="'header-button-' + index"
              bottom
            >
              <template v-slot:activator="{ on }">
                <v-btn
                  v-on="on"
                  @click="$utils.openLink(item.link)"
                  class="content-area__header__buttons__item button-1"
                  depressed
                  small
                >
                  <v-icon
                    class="mr-2"
                    v-if="item.icon"
                    size="16px"
                  >
                    {{item.icon}}
                  </v-icon>
                  {{item.title}}
                </v-btn>
              </template>
              <span>
                <v-layout align-center>
                  <v-icon class="mr-3" size="16px">
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
            class="tab-view__header"
            v-model="settingsSelectedTab"
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
            class="tab-view__header__content"
            v-model="settingsSelectedTab"
          >
            <!-- tab::general -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <!-- section::Language -->
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-translate'
                  },
                  title: $localize.get('settings_language_title')
                }"
              >
                <template v-slot:content>
                  <v-menu offset-y>
                    <template v-slot:activator="{ on }">
                      <v-btn
                        class="button-1 mt-2"
                        v-on="on"
                        small
                        depressed
                      >
                        {{selectedLanguage.name}} - {{selectedLanguage.locale}}
                        <v-icon class="ml-2">mdi-menu-down</v-icon>
                      </v-btn>
                    </template>
                    <v-list dense>
                      <v-list-item
                        v-for="(language, index) in availableLanguages"
                        :key="index"
                        @click="$store.dispatch('SET', {
                          key: 'storageData.localization.selectedLanguage',
                          value: language
                        })"
                        :is-active="language.locale === selectedLanguage.locale"
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
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-fullscreen',
                    size: '28px'
                  },
                  title: $localize.get('settings_ui_zoom_title')
                }"
              >
                <template v-slot:content>
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
                      <template v-slot:activator="{ on }">
                        <v-btn
                          class="button-1 mr-3"
                          v-on="on"
                          @click="item.onClick()"
                          small
                          depressed
                        >
                          <v-icon v-if="item.icon">{{item.icon}}</v-icon>
                          <div v-if="item.buttonText">{{item.buttonText}}</div>
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
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-progress-upload',
                  },
                  title: 'App updates'
                }"
              >
                <template v-slot:description>
                  <div class="text--sub-title-1 mt-2">
                    Current version: {{appVersion}}
                  </div>
                </template>
                <template v-slot:content>
                  <div class="mb-4">
                    <v-btn
                      class="button-1 mr-2"
                      @click="$store.dispatch('INIT_APP_UPDATER', {notifyUnavailable: true})"
                      depressed
                      small
                    >Check for updates now
                    </v-btn>

                    <v-tooltip bottom>
                      <template v-slot:activator="{ on }">
                        <v-btn
                          class="button-1"
                          v-on="on"
                          @click="$utils.openLink(appPaths.githubAllReleases)"
                          depressed
                          small
                        >See all releases
                        </v-btn>
                      </template>
                      <span>
                        <v-layout align-center>
                          <v-icon class="mr-3" size="16px">
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
                  ></v-switch>

                  <v-switch
                    v-if="autoCheckForAppUpdates"
                    v-model="autoDownloadAppUpdates"
                    label="Download updates automatically"
                    hide-details
                  ></v-switch>

                  <v-switch
                    v-if="autoCheckForAppUpdates && autoDownloadAppUpdates"
                    v-model="autoInstallAppUpdates"
                    label="Install updates automatically"
                    hide-details
                  ></v-switch>
                </template>
              </section-settings>

              <!-- section::app properties -->
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-tune',
                  },
                  title: 'App properties'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Startup behavior
                  </div>

                  <v-switch
                    v-model="appPropertiesOpenAtLogin"
                    label="Launch app on system login"
                    hide-details
                  ></v-switch>

                  <v-switch
                    v-model="appPropertiesOpenAsHidden"
                    label="Launch app in hidden state"
                    hide-details
                  ></v-switch>
                </template>
              </section-settings>

              <!-- section::window-controls -->
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-application-settings',
                  },
                  title: 'Window controls'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Window "close" button action
                  </div>

                  <v-radio-group
                    class="py-0 mt-4"
                    v-model="windowCloseButtonAction"
                    hide-details
                  >
                    <v-tooltip
                      bottom
                      open-delay="300"
                      max-width="450"
                      offset-overflow
                    >
                      <template v-slot:activator="{ on }">
                        <div class="mb-4" v-on="on">
                          <v-radio
                            label="Minimize to tray and keep in memory (recommended)"
                            value="minimizeAppToTray"
                          ></v-radio>
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
                      <template v-slot:activator="{ on }">
                        <div class="mb-4" v-on="on">
                          <v-radio
                            label="Minimize to tray and minimize memory usage"
                            value="closeMainWindow"
                          ></v-radio>
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
                      <template v-slot:activator="{ on }">
                        <div v-on="on">
                          <v-radio
                            label="Close the app completely"
                            value="closeApp"
                          ></v-radio>
                        </div>
                      </template>
                      <span>
                        When the app main window is closed, all features stop working
                      </span>
                    </v-tooltip>
                  </v-radio-group>
                </template>
              </section-settings>
            </v-tab-item>

            <!-- tab::ui-appearance -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <!-- TODO: finish when light theme is added -->
              <!-- <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-contrast-box'
                  },
                  title: 'Theme'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Theme type
                  </div>
                  <v-radio-group v-model="themeType" hide-details class="py-0 mt-0">
                    <v-radio label="Light" value="light"></v-radio>
                    <v-radio label="Dark" value="dark"></v-radio>
                  </v-radio-group>
                </template>
              </section-settings> -->

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-animation-play-outline'
                  },
                  title: 'Visual effects'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Window transparency effect
                  </div>
                  <v-switch
                    class="mt-0 pt-0 d-inline-flex"
                    v-model="windowTransparencyEffectValue"
                    label="Display window transparency effect"
                    hide-details
                  ></v-switch>

                  <v-expand-transition>
                    <div v-if="windowTransparencyEffect.value">
                      <div class="mt-2">
                        Overlay blur: {{windowTransparencyEffectBlur}}px
                      </div>
                      <v-layout align-center>
                        <v-slider
                          class="align-center"
                          v-model="windowTransparencyEffectBlur"
                          max="100"
                          min="0"
                          step="1"
                          hide-details
                          style="max-width: 250px"
                        ></v-slider>
                      </v-layout>

                      <div class="mt-2">
                        Overlay opacity: {{windowTransparencyEffectOpacity}}%
                      </div>
                      <v-layout align-center>
                        <v-slider
                          class="align-center"
                          v-model="windowTransparencyEffectOpacity"
                          max="20"
                          min="0"
                          step="1"
                          hide-details
                          style="max-width: 250px"
                        ></v-slider>
                      </v-layout>
                      
                      <div class="mt-2">
                        Overlay parallax distance: 
                        {{windowTransparencyEffectParallaxDistance}}
                      </div>
                      <v-layout align-center>
                        <v-slider
                          class="align-center"
                          v-model="windowTransparencyEffectParallaxDistance"
                          max="10"
                          min="0"
                          step="1"
                          hide-details
                          style="max-width: 250px"
                        ></v-slider>
                      </v-layout>
                      
                      <v-layout align-center>
                        <v-select
                          v-model="windowTransparencyEffectDataBackgroundSelected"
                          :items="windowTransparencyEffectDataBackgroundItems"
                          item-text="fileNameBase"
                          return-object
                          label="Overlay background"
                          style="max-width: 400px"
                        ></v-select>
                        
                        <v-tooltip bottom>
                          <template v-slot:activator="{ on }">
                            <v-btn
                              class="button-1 ml-3"
                              v-on="on"
                              @click="setNextWindowTransparencyEffectBackground()"
                              depressed
                              small
                            >
                              <v-icon size="18px" color="">mdi-autorenew</v-icon>
                            </v-btn>
                          </template>
                          <span>Select next background</span>
                        </v-tooltip>
                      </v-layout>

                      <div>
                        <v-switch
                          class="d-inline-flex mt-0 pt-0"
                          v-model="windowTransparencyEffectLessProminentOnHomePage"
                          label="Make effect less prominent on home page"
                        ></v-switch>
                      </div>

                      <div>
                        <v-switch
                          class="d-inline-flex mt-0 pt-0"
                          v-model="windowTransparencyEffectSameSettingsOnAllPages"
                          label="Use the same settings for all pages"
                        ></v-switch>
                      </div>

                      <v-expand-transition>
                        <div v-if="!windowTransparencyEffectSameSettingsOnAllPages">
                          <div>
                            <v-switch
                              class="d-inline-flex mt-0 pt-0"
                              v-model="windowTransparencyEffectPreviewEffect"
                            >
                              <template v-slot:label>
                                <v-tooltip bottom max-width="400px">
                                  <template v-slot:activator="{ on }">
                                    <v-icon
                                      v-on="on"
                                      v-show="
                                        windowTransparencyEffectPreviewEffect && 
                                        windowTransparencyEffectOptionsSelectedPage.name !== 'settings'
                                      "
                                      color="red"
                                    >mdi-circle-medium
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
                            class="mt-2"
                            v-model="windowTransparencyEffectOptionsSelectedPage"
                            :items="windowTransparencyEffectOptionsPages"
                            item-text="title"
                            return-object
                            label="Page to customize"
                            style="max-width: 400px"
                          >
                            <template v-slot:selection="{item}">
                              <v-icon class="mr-4">
                                {{item.icon}}
                              </v-icon>
                              <div>
                                {{item.title}}
                              </div>
                            </template>

                            <template v-slot:item="{item}">
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
                            <br>- The preview of the effect will be displayed on this page until you visit another page.
                          </div>
                        </div>
                      </v-expand-transition>
                    </div>
                  </v-expand-transition>

                  <div class="text--sub-title-1 mt-4">
                    Home banner effects
                  </div>
                  <v-switch
                    class="mt-0 pt-0 d-inline-flex"
                    v-model="homeBannerMediaGlowEffectValue"
                    label="Background glow effect"
                    hide-details
                  ></v-switch>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-animation-play-outline'
                  },
                  title: 'Animations'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Home page animations
                  </div>

                  <v-switch
                    class="mt-0 pt-0"
                    v-model="animationsOnRouteChangeMediaBannerIn"
                    label="Home banner animation"
                    hint="Setting will apply on the next page change"
                    persistent-hint
                  ></v-switch>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-timetable'
                  },
                  title: 'Date / time'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Month format
                  </div>

                  <v-radio-group
                    class="py-0 mt-0"
                    v-model="dateTimeMonth"
                    hide-details
                  >
                    <v-radio
                      label="Numeric"
                      value="numeric"
                    ></v-radio>
                    <v-radio
                      label="Short"
                      value="short"
                    ></v-radio>
                  </v-radio-group>

                  <div class="mt-2">
                    Example: 
                    <span class="inline-code--light">
                      {{localDateTimeExample}}
                    </span>
                  </div>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-outline'
                  },
                  title: 'UI elements'
                }"
              >
                <template v-slot:content>
                  <!-- TODO: finish in v1.1.0 (see TODO in ActionToolbar.vue) -->
                  <!-- <div class="text--sub-title-1 mt-2">
                    Directory navigator options
                  </div>
                  <v-switch
                    v-model="groupDirItems"
                    label="Group directory items"
                    class="mt-0 pt-0"
                  ></v-switch> -->
                  <div class="text--sub-title-1 mt-2">
                    Dashboard options
                  </div>

                  <v-switch
                    v-model="dashboardTimeline"
                    label="Show timeline"
                    class="mt-0 pt-0"
                  ></v-switch>
                  <div class="text--sub-title-1 mt-2">
                    Home page cards
                  </div>

                  <v-switch
                    v-model="showUserNameOnUserHomeDir"
                    label="Show user name on 'home directory' card"
                    class="mt-0 pt-0"
                  ></v-switch>

                  <v-switch
                    v-model="driveCardShowProgress"
                    label="Show drive space indicator"
                    class="mt-0 pt-0"
                  ></v-switch>

                  <div v-show="driveCardShowProgress">
                    <div class="text--sub-title-1 mt-2">
                      Drive space indicator style
                    </div>

                    <v-radio-group
                      class="py-0 mt-0"
                      v-model="driveCardProgressType"
                      hide-details
                    >
                      <v-radio
                        label="Linear | vertical"
                        value="linearVertical"
                      ></v-radio>
                      <v-radio
                        label="Linear | horizontal"
                        value="linearHorizontal"
                      ></v-radio>
                      <v-radio
                        label="Linear | horizontal | centered"
                        value="linearHorizontalCentered"
                      ></v-radio>
                      <v-radio
                        label="Circular"
                        value="circular"
                      ></v-radio>
                    </v-radio-group>
                  </div>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-outline'
                  },
                  title: 'Home page media banner'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Banner options
                  </div>

                  <v-radio-group v-model="homeBannerValue" hide-details class="py-0 mt-0">
                    <v-radio
                      label="Display media banner"
                      :value="true"
                    ></v-radio>
                    <v-radio
                      label="Hide media banner"
                      :value="false"
                    ></v-radio>
                  </v-radio-group>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-information-outline'
                  },
                  title: 'Info panel'
                }"
              >
                <template v-slot:description>
                  Info panel is located on the navigator page.
                  <br>It displays information about the last selected item.
                </template>
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Info panel options
                  </div>

                  <v-switch
                    class="mt-0 pt-0"
                    v-model="navigatorViewInfoPanel"
                    label="Show info panel"
                    hide-details
                  ></v-switch>

                  <v-tooltip
                    bottom
                    open-delay="300"
                    max-width="400px"
                    offset-overflow
                  >
                    <template v-slot:activator="{ on }">
                      <div v-on="on" style="display: inline-block;">
                        <v-switch
                          v-model="autoCalculateDirSize"
                          hide-details
                        >
                          <template v-slot:label>
                            <v-icon
                              v-show="autoCalculateDirSize"
                              color="red"
                            >mdi-circle-medium
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
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-view-list'
                  },
                  title: 'Navigator'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Navigator view layout
                  </div>

                  <v-radio-group
                    class="py-0 mt-0"
                    v-model="navigatorLayout"
                    hide-details
                  >
                    <v-radio
                      label="List layout"
                      value="list"
                    ></v-radio>
                    <v-radio
                      label="Grid layout"
                      value="grid"
                    ></v-radio>
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    Navigator item hover effect
                  </div>

                  <v-radio-group
                    class="py-0 mt-0"
                    v-model="dirItemHoverEffect"
                    hide-details
                  >
                    <v-radio
                      label="Scale"
                      value="scale"
                    ></v-radio>
                    <v-radio
                      label="Highlight"
                      value="highlight"
                    ></v-radio>
                  </v-radio-group>
                </template>
              </section-settings>
            </v-tab-item>

            <!-- tab::tabs & workspaces -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <!-- section::window-controls -->
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-tab',
                  },
                  title: 'Tabs'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Options
                  </div>
                  <v-switch
                    class="my-0"
                    v-model="closeAppWindowWhenLastWorkspaceTabIsClosed"
                    label="Close app window when all current workspace tabs are closed"
                  ></v-switch>
                </template>
              </section-settings>
            </v-tab-item>

            <!-- tab::navigation -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <!-- section::window-controls -->
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-tab',
                  },
                  title: 'Navigator history'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    History navigation style
                  </div>
                  <v-radio-group
                    class="py-0 mt-0"
                    v-model="navigatorhistoryNavigationStyleSelected"
                    hide-details
                  >
                    <v-tooltip bottom max-width="400px">
                      <template v-slot:activator="{ on }">
                        <v-radio
                          v-on="on"
                          label="Sigma default"
                          value="sigma-default"
                        ></v-radio>
                      </template>
                      <span>
                        This custom Sigma history style allows you to get back to previously opened paths,
                        even after inserting a new path into the history while navigating the history stack.
                        <br><strong>Example:</strong>
                        <br>- Open directory <span class="inline-code--light py-0">"/user"</span>
                        <br>- Open directory <span class="inline-code--light py-0">"/user/pictures"</span>
                        <br>- Open directory <span class="inline-code--light py-0">"/user/pictures/screenshots"</span>
                        <br>If you now go back to directory 
                        <span class="inline-code--light py-0">"/user/pictures"</span> 
                        and then go back again to 
                        <span class="inline-code--light py-0">"/user"</span> 
                        and then open 
                        <span class="inline-code--light py-0">"/user/videos"</span>, 
                        you will still be able to go back in history to the previous directories by pressing
                        "go back" or "go forward" button.
                      </span>
                    </v-tooltip>

                    <v-tooltip bottom max-width="400px">
                      <template v-slot:activator="{ on }">
                        <v-radio
                          v-on="on"
                          label="Traditional"
                          value="traditional"
                        ></v-radio>
                      </template>
                      <span>
                        This is a traditional history style, used in vast majority of apps. 
                        It overwrites all succeding paths when you insert a new path anywhere other than the end, 
                        which means once you go back in history and open some other directory, all succedding entries will be gone.
                        <br><strong>Example:</strong>
                        <br>- Open directory <span class="inline-code--light py-0">"/user"</span>
                        <br>- Open directory <span class="inline-code--light py-0">"/user/pictures"</span>
                        <br>- Open directory <span class="inline-code--light py-0">"/user/pictures/screenshots"</span>
                        <br>If you now go back to directory 
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
            </v-tab-item>

            <!-- tab::input -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-folder-outline'
                  },
                  title: 'Navigator'
                }"
              >
                <template v-slot:content>
                  <div>
                    <div class="text--sub-title-1 mt-2">
                      Directory items
                    </div>

                    <div class="mb-5">
                      <v-switch
                        class="my-0"
                        v-model="navigatorShowHiddenDirItems"
                        label="Show Hidden Items"
                      ></v-switch>

                      <v-switch
                        class="my-0"
                        v-model="navigatorOpenDirItemWithSingleClick"
                        label="Open with single click"
                        hide-details
                      ></v-switch>

                      <div 
                        class="mt-3"
                        v-show="navigatorOpenDirItemWithSingleClick"
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
                      ></v-text-field>
                    </div>
                  </div>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-form-textbox'
                  },
                  title: 'Input elements'
                }"
              >
                <template v-slot:content>
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
                      class="my-0"
                      v-model="spellcheck"
                      label="Spellcheck"
                      hide-details
                    ></v-switch>
                  </div>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-mouse'
                  },
                  title: 'Mouse buttons'
                }"
              >
                <template v-slot:content>
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
                  ></v-select>
                  
                  <v-select
                    v-model="pointerButton4onMouseUpEvent"
                    :items="pointerButton4onMouseUpEventItems"
                    return-object
                    item-text="title"
                    label="Mouse button 4"
                    style="max-width: 400px"
                  ></v-select>
                </template>
              </section-settings>
            </v-tab-item>

            <!-- tab::search-->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-magnify',
                    size: '26px'
                  },
                  title: 'Global search'
                }"
              >
                <template v-slot:content>
                  <div class="text--sub-title-1 mt-2">
                    Quick actions
                  </div>

                  <div class="button-container">
                    <v-btn
                      class="button-1"
                      @click="$eventHub.$emit('app:method', {
                        method: 'initGlobalSearchDataScan'
                      })"
                      depressed
                      small
                    >
                      <v-icon class="mr-2" small>
                        mdi-refresh
                      </v-icon>
                      re-scan drives
                    </v-btn>

                    <v-btn
                      class="button-1"
                      @click="$store.dispatch('LOAD_DIR', {
                        path: appPaths.storageDirectories.appStorageGlobalSearchData
                      })"
                      depressed
                      small
                    >
                      <v-icon class="mr-2" small>
                        mdi-folder-outline
                      </v-icon>
                      Open search data directory
                    </v-btn>
                  </div>

                  <div
                    class="mt-4"
                    v-html="$localize.get('text_allow_global_search_message')"
                  ></div>

                  <div>
                    <div class="text--sub-title-1 mt-2">
                      Search data
                    </div>

                    <updating-component :component="'lastScanTimeElapsed'"/>
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
                    style="max-width: 200px"
                  >
                    <template v-slot:selection="{ item }">
                      {{$utils.formatTime(item, 'ms', 'auto')}}
                    </template>
                    <template v-slot:item="{ item }">
                      {{$utils.formatTime(item, 'ms', 'auto')}}
                    </template>
                  </v-select>

                  <v-tooltip
                    bottom
                    open-delay="300"
                    max-width="400px"
                    offset-overflow
                  >
                    <template v-slot:activator="{ on }">
                      <div v-on="on" style="display: inline-block;">
                        <v-combobox
                          class="mt-0"
                          v-model="globalSearchScanDepth"
                          :items="suggestedGlobalSearchScanDepthItems"
                          :disabled="scanInProgress"
                          @blur="handleBlurGlobalSearchScanDepth"
                          label="Scan depth"
                          style="max-width: 200px"
                        >
                          <template v-slot:selection>
                            {{globalSearchScanDepth}} directories
                          </template>
                          <template v-slot:item="{item}">
                            {{item}} directories
                          </template>
                        </v-combobox>
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
                      <template v-slot:activator="{ on }">
                        <div
                          class="d-inline-flex"
                          v-on="on"
                        >
                          <v-switch
                            class="mt-0"
                            v-model="globalSearchCompressSearchData"
                            :disabled="scanInProgress"
                            @change="$eventHub.$emit('app:method', {
                              method: 'initGlobalSearchDataScan'
                            })"
                          >
                            <template v-slot:label>
                              <v-icon
                                v-show="!globalSearchCompressSearchData"
                                color="red"
                              >mdi-circle-medium
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
                    <template v-slot:prepend-item>
                      <v-list-item>
                        <v-list-item-content>
                          <v-list-item-title>
                            Enter a path to add to the ignored list and press
                            <span class="inline-code--light">Enter</span>
                          </v-list-item-title>
                        </v-list-item-content>
                      </v-list-item>
                    </template>
                    <template v-slot:item="{item}">
                      <v-list-item @click.stop="toggleGlobalSearchDisallowedPathItem(item)">
                        <v-list-item-action>
                          <v-icon>
                            {{globalSearchDisallowedPaths.includes(item)
                              ? 'mdi-check-box-outline'
                              : 'mdi-checkbox-blank-outline'
                            }}
                          </v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                          <v-list-item-title>
                           {{item}}
                          </v-list-item-title>
                        </v-list-item-content>
                        <v-list-item-action>
                          <v-btn
                            @click.stop="removeItemFromGlobalSearchDisallowedPathsItems(item)"
                            icon
                          >
                            <v-icon>mdi-close</v-icon>
                          </v-btn>
                        </v-list-item-action>
                      </v-list-item>
                    </template>
                    <template v-slot:selection="{item, index}">
                      <v-chip v-if="index < 2" small>
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
                    <span class="ml-1" style="font-size: 14px;">
                    {{estimatedGlobalSearchScanTime.time}}
                    (per 1 TB drive)
                    </span>
                  </div>
                  <div>
                    <v-icon :color="estimatedGlobalSearchTime.color">
                      mdi-circle-medium
                    </v-icon>
                    Estimated search time:
                    <span class="ml-1" style="font-size: 14px;">
                    1 sec — {{estimatedGlobalSearchTime.time}}
                    (per 1 TB drive per search word) | depends on file location
                    </span>
                  </div>
                </template>
              </section-settings>
            </v-tab-item>

            <!-- tab::data-and-storage -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-information-outline'
                  },
                  title: 'Reminder'
                }"
              >
                <template v-slot:description>
                  It's recommended to regularly backup (copy)
                  all your important files to an external drive
                  (which is not connected to your computer most of the time),
                  so if something goes wrong, you don't lose important files.
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'fab fa-usb'
                  },
                  title: 'Drive detection'
                }"
              >
                <template v-slot:content>
                  <v-checkbox
                    v-model="focusMainWindowOnDriveConnected"
                    label="Focus the app when a drive is connected"
                    hide-details
                  ></v-checkbox>
                </template>
              </section-settings>

              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-outline'
                  },
                  title: 'Image thumbnails'
                }"
              >
                <template v-slot:description>
                  Every time you open a directory, the app generates a small thumbnail for every image
                  and stores it in the app drectory. This image caching technique improves app performance.
                  When the specified limit is reached, all thumbnails are deleted.
                </template>
                <template v-slot:content>
                  <div class="text--sub-title-1">
                    Thumbnail storage limit
                  </div>

                  <div>Limit: {{thumbnailStorageLimit}} MB</div>

                  <v-slider
                    class="align-center"
                    v-model="thumbnailStorageLimit"
                    max="1000"
                    min="10"
                    step="10"
                    hide-details
                    style="max-width: 250px"
                  ></v-slider>
                </template>
              </section-settings>
            </v-tab-item>

            <!-- tab:stats -->
            <v-tab-item transition="fade-in" reverse-transition="fade-in">
              <section-settings
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-crop'
                  },
                  title: 'Directory item statistics'
                }"
              >
                <template v-slot:description>
                  If enabled, the app will store some event data of your interactions with
                  directories / files, for example, when and how many times they were opened.
                  <br>The statistics data is stored in the file called "stats.json"
                  located in the app directory.
                  <br>This data is needed for features like "timeline" to work.
                </template>
                <template v-slot:content>
                  <v-btn
                    class="button-1 my-4"
                    @click="$store.dispatch('LOAD_DIR', { path: appPaths.storageDirectories.appStorage })"
                    depressed
                    small
                  >
                    <v-icon class="mr-2" small>
                      mdi-folder-outline
                    </v-icon>
                    Open file location
                  </v-btn>

                  <div class="text--sub-title-1">
                    Timeline
                  </div>

                  <v-switch
                    v-model="storeDirItemOpenEvent"
                    label="Store the list of opened directory items"
                    hide-details
                  ></v-switch>

                  <v-switch
                    v-if="storeDirItemOpenEvent"
                    v-model="storeDirItemOpenCount"
                    label="Store the amount of times a directory item was opened"
                    hide-details
                  ></v-switch>

                  <v-switch
                    v-if="storeDirItemOpenEvent"
                    v-model="storeDirItemOpenDate"
                    label="Store the date of opening a directory item"
                    hide-details
                  ></v-switch>
                </template>
              </section-settings>
            </v-tab-item>
          </v-tabs-items>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import SectionSettings from '../components/SectionSettings.vue'

export default {
  components: {
    SectionSettings
  },
  name: 'settings',
  data () {
    return {
      githubProjectData: {
        stars: 0
      },
      settingsSelectedTab: 0,
      settingsTabs: [
        {text: 'General'},
        {text: 'UI appearance'},
        {text: 'Tabs & workspaces'},
        {text: 'Navigation'},
        {text: 'Input'},
        {text: 'Search'},
        {text: 'Data & storage'},
        {text: 'Stats'}
      ],
      suggestedGlobalSearchScanDepthItems: [3, 4, 5, 6, 7, 8, 9, 10]
    }
  },
  beforeRouteLeave (to, from, next) {
    this.$store.dispatch('SAVE_ROUTE_SCROLL_POSITION', {
      toRoute: to,
      fromRoute: from
    })
    next()
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
      navigatorLayout: 'storageData.settings.navigatorLayout',
      closeAppWindowWhenLastWorkspaceTabIsClosed: 'storageData.settings.navigator.tabs.closeAppWindowWhenLastWorkspaceTabIsClosed',
      navigatorhistoryNavigationStyleSelected: 'storageData.settings.navigator.historyNavigationStyle.selected',
      navigatorShowHiddenDirItems: 'storageData.settings.navigator.showHiddenDirItems',
      navigatorOpenDirItemWithSingleClick: 'storageData.settings.navigator.openDirItemWithSingleClick',
      dirItemHoverEffect: 'storageData.settings.dirItemHoverEffect',
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
      dateTimeMonth: 'storageData.settings.dateTime.month',
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
            value
          })
        }
      }
    }
    this.$options.computed = {
      ...this.$options.computed,
      ...objects
    }
  },
  activated () {
    this.$store.dispatch('ROUTE_ACTIVATED_HOOK_CALLBACK', {
      route: 'settings'
    })
  },
  created () {
    this.settingsSelectedTab = this.lastOpenedSettingsTabValue
  },
  mounted () {
    this.$store.dispatch('ROUTE_MOUNTED_HOOK_CALLBACK', {
      route: 'settings'
    })
    this.fetchGithubProjectData()
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
      deep: true
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
        ...this.globalSearchDisallowedPaths
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
          value: []
        })  
      }
    }
  },
  computed: {
    ...mapFields({
      defaultData: 'defaultData',
      appVersion: 'appVersion',
      appPaths: 'appPaths',
      windowSize: 'windowSize',
      shortcuts: 'storageData.settings.shortcuts',
      UIZoomLevel: 'storageData.settings.UIZoomLevel',
      toolbarColorItems: 'storageData.settings.theme.toolbarColorItems',
      dashboardTimeline: 'storageData.settings.dashboard.tabs.timeline.show',
      scanInProgress: 'globalSearch.scanInProgress',
      openDirItemSecondClickDelay: 'storageData.settings.navigator.openDirItemSecondClickDelay',
      windowTransparencyEffect: 'storageData.settings.windowTransparencyEffect',
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
            value
          })
        }
      }
    },
    headerButtons () {
      return [
        {
          title: 'Project page',
          link: this.appPaths.githubRepoLink
        },
        {
          title: 'Requests & issues',
          link: this.appPaths.githubIssuesLink
        },
        {
          title: 'Discussions',
          link: this.appPaths.githubDiscussionsLink
        },
        {
          title: `Star | ${this.githubProjectData.stars}`,
          icon: 'mdi-star-outline',
          link: this.appPaths.githubRepoLink
        }
      ]
    },
    UIButtons () {
      return [
        {
          title: this.$localize.get('tooltip_button_ui_zoom_decrease_title'),
          shortcut: this.shortcuts.zoomDecrease.shortcut,
          icon: 'mdi-minus',
          onClick: () => this.$store.dispatch('DECREASE_UI_ZOOM')
        },
        {
          title: this.$localize.get('tooltip_button_ui_zoom_increase_title'),
          shortcut: this.shortcuts.zoomIncrease.shortcut,
          icon: 'mdi-plus',
          onClick: () => this.$store.dispatch('INCREASE_UI_ZOOM')
        },
        {
          title: this.$localize.get('tooltip_button_ui_zoom_reset_title'),
          shortcut: this.shortcuts.zoomReset.shortcut,
          buttonText: this.$localize.get('settings_ui_zoom_button_reset'),
          onClick: () => this.$store.dispatch('RESET_UI_ZOOM')
        },
        {
          title: this.$localize.get('tooltip_button_full_screen_title'),
          shortcut: this.shortcuts.fullScreen.shortcut,
          icon: 'mdi-fullscreen',
          onClick: () => this.$utils.toggleFullscreen()
        }
      ]
    },
    globalSearchDisallowedPaths: {
      get () {
        return this.$store.state.storageData.settings.globalSearch.disallowedPaths
      },
      set (value) {
        this.$store.dispatch('SET_GLOBAL_SEARCH_DISALOWED_PATHS', value)
      }
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
        compressionMultiplier: this.globalSearchCompressSearchData ? 2 : 1
      })
    },
    estimatedGlobalSearchTime () {
      return this.getSearchTimeEstimates({
        timePerDepth: 2,
        colorTreshold: 60,
        complexity: this.globalSearchScanDepth * 2.5,
        compressionMultiplier: 1
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
          maxValue
        }
      }
      else {
        return {
          isValid: true,
          error: '',
          minValue,
          maxValue
        }
      }
    },
    localDateTimeExample () {
      return this.$utils.getLocalDateTime(
        Date.now(), 
        this.$store.state.storageData.settings.dateTime
      )
    }
  },
  methods: {
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
        color
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
        method: 'initGlobalSearchDataScan'
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
</style>
