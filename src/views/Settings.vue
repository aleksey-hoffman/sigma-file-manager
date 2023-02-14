<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    id="settings-view"
    :filter-is-empty="filterQuery === ''"
  >
    <ActionToolbar />
    <div
      id="content-area--settings-view"
      class="content-area custom-scrollbar"
    >
      <div class="content-area__title">
        {{$t('pages.settings')}}
      </div>
      <v-divider class="my-3" />

      <div class="content-area__header">
        <img
          :src="$storeUtils.getSafePath(appPaths.public + '/icons/logo-1024x1024.png')"
          width="87px"
        />
        <div class="content-area__header__content">
          <div class="content-area__header__text">
            <strong>"{{$t('app.name')}}"</strong>
            {{$t('app.description')}}
            <br />{{$t('app.copyright')}}
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
              class="ml-4 mt-4"
            >
              <div class="text--sub-title-1">
                {{$t('settings.general.filteredSettings')}}
              </div>
              <FilterClearButton
                :filter-query="filterQuery"
                class="mb-4"
                @click="filterQuery = ''"
              />
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
                  title: $t('language.language')
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
                        {{selectedLanguage.name}}
                        <v-icon class="ml-2">
                          mdi-menu-down
                        </v-icon>
                      </v-btn>
                    </template>
                    <v-list dense>
                      <v-list-item
                        v-for="(language, index) in languages"
                        :key="index"
                        :is-active="language.locale === selectedLanguage.locale"
                        @click="$store.dispatch('changeLanguage', language)"
                      >
                        <v-list-item-content>
                          <v-list-item-title>
                            {{language.name}}
                          </v-list-item-title>
                        </v-list-item-content>
                        <v-list-item-icon>
                          <AppIcon
                            v-if="language.isCorrected"
                            icon="mdi-account-check-outline"
                            icon-size="18px"
                            :tooltip="$t('language.isCorrectedLanguage')"
                          />
                          <AppIcon
                            v-if="!language.isCorrected"
                            icon="mdi-robot-outline"
                            icon-size="16px"
                            :tooltip="$t('language.isAutoTranslatedLanguage')"
                          />
                        </v-list-item-icon>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                  <div
                    class="mt-4"
                    v-html="$t('settings.general.toAddNewLanguage')"
                  />
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
                  title: $t('settings.general.windowScaling')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.general.currentUiZoomLevel')}}
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
                          {{$t('shortcut')}} {{item.shortcut}}
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
                  title: $t('appUpdates')
                }"
              >
                <template #description>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('currentVersion')}}: {{appVersion}}
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
                      {{$t('checkUpdatesNow')}}
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
                          {{$t('seeAllReleases')}}
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
                    {{$t('options')}}
                  </div>

                  <v-switch
                    v-model="autoCheckForAppUpdates"
                    :label="$t('settings.general.checkForUpdatesAutomatically')"
                    hide-details
                  />

                  <v-switch
                    v-if="autoCheckForAppUpdates"
                    v-model="autoDownloadAppUpdates"
                    :label="$t('settings.general.downloadUpdatesAutomatically')"
                    hide-details
                  />

                  <v-switch
                    v-if="autoCheckForAppUpdates && autoDownloadAppUpdates"
                    v-model="autoInstallAppUpdates"
                    :label="$t('settings.general.installUpdatesAutomatically')"
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
                  title: $t('appProperties')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.general.startupBehavior')}}
                  </div>

                  <v-switch
                    v-model="appPropertiesOpenAtLogin"
                    :label="$t('settings.general.launchAppOnSystemLogin')"
                    hide-details
                  />

                  <v-switch
                    v-model="appPropertiesOpenAsHidden"
                    :label="$t('settings.general.launchAppInHiddenState')"
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
                  title: $t('settings.general.windowControls')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.general.windowCloseButtonAction')}}
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
                            :label="$t('settings.windowControls.minimizeAppToTray.radioLabel')"
                            value="minimizeAppToTray"
                          />
                        </div>
                      </template>
                      <span>
                        <strong>
                          {{$t('settings.windowControls.minimizeAppToTray.description')}}
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
                            :label="$t('settings.windowControls.closeMainWindow.radioLabel')"
                            value="closeMainWindow"
                          />
                        </div>
                      </template>
                      <span>
                        <p>
                          {{$t('settings.windowControls.closeMainWindow.description.title')}}
                        </p>

                        <strong>
                          <v-icon color="teal">mdi-circle-medium</v-icon>
                          {{$t('settings.windowControls.closeMainWindow.description.subtitle1')}}
                        </strong>
                        <div class="ml-4 my-2">
                          - {{$t('settings.windowControls.closeMainWindow.description.feature1')}}
                        </div>

                        <strong>
                          <v-icon color="orange">mdi-circle-medium</v-icon>
                          {{$t('settings.windowControls.closeMainWindow.description.subtitle2')}}
                        </strong>
                        <div class="ml-4 my-2">
                          - {{$t('settings.windowControls.closeMainWindow.description.feature2')}}
                        </div>

                        <strong>
                          <v-icon color="red">mdi-circle-medium</v-icon>
                          {{$t('settings.windowControls.closeMainWindow.description.subtitle3')}}
                        </strong>
                        <div class="ml-4 my-2">
                          - {{$t('settings.windowControls.closeMainWindow.description.feature3')}}
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
                            :label="$t('settings.windowControls.closeApp.radioLabel')"
                            value="closeApp"
                          />
                        </div>
                      </template>
                      <span>
                        {{$t('settings.windowControls.closeApp.description')}}
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
                  title: $t('settings.visualEffects.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.visualEffects.windowTransparencyEffect')}}
                  </div>
                  <v-switch
                    v-model="windowTransparencyEffectValue"
                    class="mt-0 pt-0 d-inline-flex"
                    :label="$t('settings.visualEffects.windowTransparencyEffect')"
                    hide-details
                  />

                  <v-expand-transition>
                    <div v-if="windowTransparencyEffect.value">
                      <div class="mt-2">
                        {{$t('settings.visualEffects.overlayBlur', {n: windowTransparencyEffectBlur})}}
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
                        {{$t('settings.visualEffects.overlayOpacity', {n: windowTransparencyEffectOpacity})}}
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
                        {{$t('settings.visualEffects.overlayParallaxDistance', {n: windowTransparencyEffectParallaxDistance})}}
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
                          :label="$t('settings.visualEffects.overlayBackground')"
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
                          <span>{{$t('settings.visualEffects.selectNextBackground')}}</span>
                        </v-tooltip>
                      </v-layout>

                      <div>
                        <v-switch
                          v-model="windowTransparencyEffectLessProminentOnHomePage"
                          class="d-inline-flex mt-0 pt-0"
                          :label="$t('settings.visualEffects.makeEffectLessProminentOnHomePage')"
                        />
                      </div>

                      <div>
                        <v-switch
                          v-model="windowTransparencyEffectSameSettingsOnAllPages"
                          class="d-inline-flex mt-0 pt-0"
                          :label="$t('settings.visualEffects.useTheSameSettingsForAllPages')"
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
                                    {{$t('settings.visualEffects.previewEffectForSelectedPage')}}
                                  </template>
                                  <span>
                                    {{$t('settings.visualEffects.previewEffectForSelectedPageTooltip')}}
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
                            :label="$t('settings.visualEffects.pageToCustomize')"
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
                            - {{$t('settings.visualEffects.pageToCustomizeDescription1')}}
                            <br />- {{$t('settings.visualEffects.pageToCustomizeDescription2')}}
                          </div>
                        </div>
                      </v-expand-transition>
                    </div>
                  </v-expand-transition>

                  <div class="text--sub-title-1 mt-4">
                    {{$t('settings.homeBannerEffects.title')}}
                  </div>
                  <v-switch
                    v-model="homeBannerMediaGlowEffectValue"
                    class="mt-0 pt-0 d-inline-flex"
                    :label="$t('settings.homeBannerEffects.backgroundGlowEffect')"
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
                  title: $t('settings.homeBannerEffects.theme.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.homeBannerEffects.theme.themeType')}}
                  </div>

                  <v-radio-group
                    v-model="themeType"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      :label="$t('settings.homeBannerEffects.theme.themeTypeRadio.dark')"
                      value="dark"
                    />

                    <v-radio
                      :label="$t('settings.homeBannerEffects.theme.themeTypeRadio.lightFilter')"
                      value="light-filter"
                    />

                    <v-radio
                      :label="$t('settings.homeBannerEffects.theme.themeTypeRadio.light')"
                      value="light"
                      disabled
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-4">
                    {{$t('settings.transparentToolbars.title')}}
                  </div>

                  <v-switch
                    v-model="transparentToolbars"
                    class="mt-4 pt-0"
                    :label="$t('settings.transparentToolbars.switchLabel')"
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('visual-filters')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-image-filter-black-white'
                  },
                  title: $t('settings.visualFilters.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.visualFilters.filters')}}
                  </div>

                  <v-switch
                    v-model="visualFiltersApplyFiltersToMediaElements"
                    class="mt-4 pt-0"
                    :label="$t('settings.visualFilters.applyFiltersToMediaElements')"
                  />

                  <div class="mt-4">
                    {{$t('settings.visualFilters.contrast', {n: Math.round(visualFiltersContrastValue * 100)})}}
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
                    {{$t('settings.visualFilters.brightness', {n: Math.round(visualFiltersBrightnessValue * 100)})}}
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
                    {{$t('settings.visualFilters.saturation', {n: Math.round(visualFiltersSaturationValue * 100)})}}
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
                  title: $t('settings.animations.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.animations.homePageAnimations')}}
                  </div>

                  <v-switch
                    v-model="animationsOnRouteChangeMediaBannerIn"
                    class="mt-0 pt-0"
                    :label="$t('settings.animations.homeBannerAnimation.title')"
                    :hint="$t('settings.animations.homeBannerAnimation.hint')"
                    persistent-hint
                  />
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('fonts')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-format-font'
                  },
                  title: $t('settings.fonts.fonts')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.fonts.selectedFont')}}
                  </div>

                  <v-layout align-center>
                    <v-select
                      v-model="font"
                      :items="filteredFonts"
                      :menu-props="{'max-width': '400px'}"
                      return-object
                      item-value="name"
                      item-text="name"
                      :label="$t('settings.fonts.fontName')"
                      style="max-width: 400px"
                    >
                      <template #prepend-item>
                        <v-list-item @mousedown.prevent>
                          <v-text-field
                            v-model="fontFilter"
                            class="pt-0 mb-2"
                            :label="$t('filter.filter')"
                            single-line
                            hide-details
                          />
                        </v-list-item>
                        <v-divider class="mt-2" />
                      </template>
                      <template #item="{item}">
                        <v-list-item
                          :is-active="font === item.name"
                          @click.stop="font = item.name"
                        >
                          <v-list-item-content>
                            <v-list-item-title :style="{'font-family': item.name}">
                              {{item.name}}
                            </v-list-item-title>
                            <v-list-item-subtitle :style="{'font-family': item.name}">
                              {{item.type}} {{isDeafultFont(item.name) ? `(${$t('settings.fonts.defaultFont')})` : ''}}
                            </v-list-item-subtitle>
                          </v-list-item-content>
                        </v-list-item>
                      </template>
                      <template #selection="{item}">
                        <v-layout
                          v-if="isFetchingSystemFonts"
                          align-center
                        >
                          <v-progress-circular
                            indeterminate
                            size="20"
                            width="2"
                            :background-color="$utils.getCSSVar('--bg-color-2')"
                            :color="$utils.getCSSVar('--highlight-color-1')"
                          />
                          <div class="ml-2">
                            {{$t('loadingDots')}}
                          </div>
                        </v-layout>
                        <div v-else>
                          {{item.name}}
                        </div>
                      </template>
                    </v-select>

                    <AppButton
                      button-class="button-1 ml-2"
                      type="button"
                      small
                      icon="mdi-autorenew"
                      icon-size="18px"
                      icon-class="action-toolbar__icon"
                      :tooltip="$t('settings.fonts.reFetchSystemFonts')"
                      @click="fetchSystemFonts()"
                    />

                    <AppButton
                      button-class="button-1 ml-2"
                      type="button"
                      small
                      icon="mdi-restore-alert"
                      icon-size="18px"
                      icon-class="action-toolbar__icon"
                      :tooltip="$t('settings.fonts.resetFontToDefault')"
                      @click="resetFont()"
                    />
                  </v-layout>
                </template>
              </section-settings>

              <section-settings
                v-if="showSection('date-time')"
                class="content-area__content-card__section"
                :header="{
                  icon: {
                    name: 'mdi-timetable'
                  },
                  title: $t('settings.dateTime.dateTime')
                }"
              >
                <template #content>
                  <div class="mt-2">
                    {{$t('settings.dateTime.dateTimePreview')}}
                    <span class="inline-code--light">
                      {{localDateTimeExample}}
                    </span>
                  </div>

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.dateTime.dateTimeRegionalFormat')}}
                  </div>
                  <v-switch
                    v-model="autoDetectDateTimeRegionalFormat"
                    :label="$t('settings.dateTime.autoDetectRegionalFormat')"
                    class="mt-0 mb-2 pt-0"
                    hide-details
                  />
                  <v-expand-transition>
                    <v-layout
                      v-if="!autoDetectDateTimeRegionalFormat"
                      align-center
                    >
                      <v-select
                        v-model="dateTimeRegionalFormat"
                        :items="filteredDateTimeRegionalFormats"
                        :menu-props="{'max-width': '400px'}"
                        return-object
                        item-value="code"
                        item-text="name"
                        :label="$t('settings.dateTime.dateTimeRegionalFormat')"
                        style="max-width: 400px"
                      >
                        <template #prepend-item>
                          <v-list-item @mousedown.prevent>
                            <v-text-field
                              v-model="dateTimeRegionalFormatFilter"
                              class="pt-0 mb-2"
                              :label="$t('filter.filter')"
                              single-line
                              hide-details
                            />
                          </v-list-item>
                          <v-divider class="mt-2" />
                        </template>
                        <template #item="{item}">
                          <v-list-item
                            :is-active="dateTimeRegionalFormat === item.code"
                            @click.stop="dateTimeRegionalFormat = item.code"
                          >
                            <v-list-item-content>
                              <v-list-item-title>
                                {{item.name}}
                              </v-list-item-title>
                              <v-list-item-subtitle>
                                {{item.code}}
                              </v-list-item-subtitle>
                            </v-list-item-content>
                          </v-list-item>
                        </template>
                        <template #selection="{item}">
                          {{item.name}}
                        </template>
                      </v-select>

                      <AppButton
                        button-class="button-1 ml-2"
                        type="button"
                        small
                        icon="mdi-restore-alert"
                        icon-size="18px"
                        icon-class="action-toolbar__icon"
                        :tooltip="$t('settings.dateTime.resetRegionalFormatToDefault')"
                        @click="resetRegionalFormat()"
                      />
                    </v-layout>
                  </v-expand-transition>

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.dateTime.monthFormat')}}
                  </div>
                  <v-radio-group
                    v-model="dateTimeMonth"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      :label="$t('settings.dateTime.numeric')"
                      value="numeric"
                    />
                    <v-radio
                      :label="$t('settings.dateTime.short')"
                      value="short"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-4">
                    {{$t('settings.dateTime.timeFormat')}}
                  </div>
                  <v-switch
                    v-model="dateTimeHour12"
                    :label="$t('settings.dateTime.12HourFormat')"
                    class="mt-0 mb-4 pt-0"
                    hide-details
                  />

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.dateTime.displayedDateProperties')}}
                  </div>
                  <v-switch
                    v-model="dateTimePropertiesShowSeconds"
                    class="mt-0 mb-4 pt-0"
                    :label="$t('settings.dateTime.showSeconds')"
                    hide-details
                  />

                  <v-switch
                    v-model="dateTimePropertiesShowMilliseconds"
                    class="mt-0 mb-4 pt-0"
                    :label="$t('settings.dateTime.showMilliseconds')"
                    hide-details
                  />
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
                    title: $t('settings.overlays.overlays')
                  }"
                >
                  <template #content>
                    <v-switch
                      v-model="navPanelDriveLetterOverlayValue"
                      :label="$t('settings.overlays.navigationPanelDriveLetterOverlay')"
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
                  title: $t('settings.uiElements.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.uiElements.directoryItemIconBackgroundColor')}}
                  </div>

                  <v-radio-group
                    v-model="dirItemBackground"
                    class="py-0 mt-0 mb-6"
                    hide-details
                  >
                    <v-radio
                      :label="$t('settings.uiElements.none')"
                      value="none"
                    />
                    <v-radio
                      :label="$t('settings.uiElements.minimal')"
                      value="minimal"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.uiElements.homePageItemCardDesign')}}
                  </div>

                  <v-radio-group
                    v-model="itemCardDesign"
                    class="py-0 mt-0 mb-6"
                    hide-details
                  >
                    <v-radio
                      :label="$t('settings.uiElements.neoinfusiveExtruded')"
                      value="neoinfusive-extruded"
                    />
                    <v-radio
                      :label="$t('settings.uiElements.neoinfusiveFlatGlow')"
                      value="neoinfusive-flat-glow"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.uiElements.dashboardOptions')}}
                  </div>

                  <v-switch
                    v-model="dashboardTimeline"
                    :label="$t('settings.uiElements.showTimeline')"
                    class="mt-0 pt-0"
                  />

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.uiElements.homePageCards')}}
                  </div>

                  <v-switch
                    v-model="showUserNameOnUserHomeDir"
                    :label="$t('settings.uiElements.showUserNameOnHomeDirectoryCard')"
                    class="mt-0 pt-0"
                  />

                  <v-switch
                    v-model="driveCardShowProgress"
                    :label="$t('settings.uiElements.showDriveSpaceIndicator')"
                    class="mt-0 pt-0"
                  />

                  <div v-show="driveCardShowProgress">
                    <div class="text--sub-title-1 mt-2">
                      {{$t('settings.uiElements.driveSpaceIndicatorStyle')}}
                    </div>

                    <v-radio-group
                      v-model="driveCardProgressType"
                      class="py-0 mt-0"
                      hide-details
                    >
                      <v-radio
                        :label="$t('settings.uiElements.linearVertical')"
                        value="linearVertical"
                      />
                      <v-radio
                        :label="$t('settings.uiElements.linearHorizontal')"
                        value="linearHorizontal"
                      />
                      <v-radio
                        :label="$t('settings.uiElements.linearHorizontalCentered')"
                        value="linearHorizontalCentered"
                      />
                      <v-radio
                        :label="$t('settings.uiElements.circular')"
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
                  title: $t('settings.homePageMediaBanner.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.homePageMediaBanner.options')}}
                  </div>

                  <v-radio-group
                    v-model="homeBannerValue"
                    hide-details
                    class="py-0 mt-0"
                  >
                    <v-radio
                      :label="$t('settings.homePageMediaBanner.display')"
                      :value="true"
                    />
                    <v-radio
                      :label="$t('settings.homePageMediaBanner.hide')"
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
                  title: $t('settings.infoPanel.title')
                }"
              >
                <template #description>
                  {{$t('settings.infoPanel.infoPanelIsLocated')}}
                  <br />{{$t('settings.infoPanel.itDisplaysLastItem')}}
                </template>
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.infoPanel.options')}}
                  </div>

                  <v-switch
                    v-model="navigatorViewInfoPanel"
                    class="mt-0 pt-0"
                    :label="$t('settings.infoPanel.show')"
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
                            {{$t('settings.infoPanel.calculateDirectorySize')}}
                          </template>
                        </v-switch>
                      </div>
                    </template>
                    <span>
                      <div>
                        <strong> {{$t('warning')}}:</strong> {{$t('settings.infoPanel.intensiveFeature')}}
                      </div>
                      <div class="mt-2">
                        <strong> {{$t('description')}}:</strong> {{$t('settings.infoPanel.whenOpenDirectory')}}
                      </div>
                      <div class="mt-2">
                        {{$t('settings.infoPanel.oneSecond')}}
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
                  title: $t('settings.navigator.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.navigator.dividersTitles')}}
                  </div>

                  <v-switch
                    v-model="showDirItemKindDividers"
                    class="mt-0 pt-0"
                    :label="$t('settings.navigator.showDividersBetweenFilesAndDirectories')"
                    hide-details
                  />

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.navigator.sortingType')}}
                  </div>
                  <div class="mb-2">
                    {{$t('settings.navigator.ifEnabledTheSelectedSortingType')}}
                  </div>

                  <v-switch
                    v-model="saveNavigatorSorting"
                    class="mt-0 pt-0"
                    :label="$t('settings.navigator.saveSortingType')"
                    hide-details
                  />

                  <div class="text--sub-title-1 mt-4">
                    {{$t('settings.navigator.sortingElementDisplayType')}}
                  </div>

                  <v-radio-group
                    v-model="navigatorSortingElementDisplayType"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      :label="$t('settings.navigator.showSortingIcon')"
                      value="icon"
                    />
                    <v-radio
                      :label="$t('settings.navigator.showSortingToolbar')"
                      value="toolbar"
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
                    {{$t('settings.navigator.navigatorViewLayout')}}
                  </div>

                  <v-radio-group
                    v-model="navigatorLayout"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      :label="$t('listLayout')"
                      value="list"
                    />
                    <v-radio
                      :label="$t('gridLayout')"
                      value="grid"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-4">
                    {{$t('settings.navigator.navigatorItemHoverEffect')}}
                  </div>

                  <v-radio-group
                    v-model="dirItemHoverEffect"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      :label="$t('scale')"
                      value="scale"
                    />
                    <v-radio
                      :label="$t('highlight')"
                      value="highlight"
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-4">
                    {{$t('settings.navigator.navigatorItemList')}}
                  </div>

                  <p>
                    <b>{{$t('settings.navigator.ocdNameColumnMaxWidth')}}</b>
                    {{$t('settings.navigator.filesWithDisproportionatelyLongNames')}}
                  </p>

                  <v-text-field
                    v-model="navigatorNameColumnMaxWidth"
                    :label="$t('settings.navigator.nameColumnMaxWidthCssValue')"
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
                  title: $t('shortcutPlural')
                }"
              >
                <template #content>
                  <ShortcutList />
                </template>
              </section-settings>
            </div>

            <div
              v-if="false"
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
                <template #content />
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 3 || filterQuery !== ''"
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
                  title: $t('settings.workspaces.workspaces')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.workspaces.workspacesMenu')}}
                  </div>
                  <v-switch
                    v-model="showWorkspaceTitleInToolbar"
                    class="my-0"
                    :label="$t('settings.workspaces.showWorkspaceTitle')"
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
                  title: $t('settings.tabs.tabs')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.tabs.tabBehavior')}}
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
                          :label="$t('settings.tabs.immutable')"
                          value="immutable"
                          v-on="on"
                        />
                      </template>
                      <span>{{$t('settings.tabs.tabsBehaveAsPinnedDirectories')}}</span>
                    </v-tooltip>
                    <v-radio
                      :label="$t('settings.tabs.traditional')"
                      value="traditional"
                      disabled
                    />
                  </v-radio-group>

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.tabs.tabLayout')}}
                  </div>
                  <v-radio-group
                    v-model="navigatorTabLayout"
                    class="py-0 mt-0"
                    hide-details
                  >
                    <v-radio
                      :label="$t('settings.tabs.compactVertical')"
                      value="compact-vertical"
                    />
                    <v-radio
                      :label="$t('settings.tabs.compactVerticalTraditionalHorizontal')"
                      value="compact-vertical-and-traditional-horizontal"
                    />
                  </v-radio-group>

                  <v-expand-transition>
                    <div v-show="navigatorTabLayout === 'compact-vertical-and-traditional-horizontal'">
                      <div class="text--sub-title-1 mt-2">
                        {{$t('settings.tabs.tabPreview')}}
                      </div>
                      <v-switch
                        v-model="showTabPreview"
                        class="my-0"
                        :label="$t('settings.tabs.showTabPreview')"
                        hide-details
                      />

                      <div class="text--sub-title-1 mt-2">
                        {{$t('settings.tabs.tabStorageIndicator')}}
                      </div>
                      <v-switch
                        v-model="showTabStorageIndicator"
                        class="my-0"
                        :label="$t('settings.tabs.showStorageIndicator')"
                        hide-details
                      />
                    </div>
                  </v-expand-transition>

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.tabs.tabProperties')}}
                  </div>
                  <div>
                    {{$t('settings.tabs.tabWidth')}} <span class="inline-code--light">{{navigatorTabWidth}}{{$t('units.px')}}</span>
                  </div>
                  <v-slider
                    v-model="navigatorTabWidth"
                    class="align-center"
                    max="300"
                    min="50"
                    step="10"
                    hide-details
                    style="max-width: 250px"
                  />

                  <div class="text--sub-title-1 mt-2">
                    {{$t('options')}}
                  </div>
                  <v-switch
                    v-model="closeAppWindowWhenLastWorkspaceTabIsClosed"
                    class="my-0"
                    :label="$t('settings.tabs.closeAppWindow')"
                  />
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 4 || filterQuery !== ''"
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
                  title: $t('settings.navigatorHistory.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.navigatorHistory.historyNavigationStyle')}}
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
                          :label="$t('settings.navigatorHistory.sigmaDefault')"
                          value="sigma-default"
                          v-on="on"
                        />
                      </template>
                      <span>
                        {{$t('settings.navigatorHistory.sigmaDefaultDescription')}}
                        <br /><strong>{{$t('example')}}</strong>
                        <br />- {{$t('settings.navigatorHistory.example.openDirectory')}} <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPath')}}"</span>
                        <br />- {{$t('settings.navigatorHistory.example.openDirectory')}} <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPicturesPath')}}"</span>
                        <br />- {{$t('settings.navigatorHistory.example.openDirectory')}} <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPicturesScreenshotsPath')}}"</span>
                        <br />{{$t('settings.navigatorHistory.example.ifYouNowGoBackToDirectory')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPicturesPath')}}"</span>
                        {{$t('settings.navigatorHistory.example.andThenGoBackAgainTo')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPath')}}"</span>
                        {{$t('settings.navigatorHistory.example.andThenOpen')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userVideosPath')}}"</span>,
                        {{$t('settings.navigatorHistory.example.sigmaDefaultExampleDescription')}}
                      </span>
                    </v-tooltip>

                    <v-tooltip
                      bottom
                      max-width="400px"
                    >
                      <template #activator="{ on }">
                        <v-radio
                          :label="$t('settings.navigatorHistory.traditional')"
                          value="traditional"
                          v-on="on"
                        />
                      </template>
                      <span>
                        {{$t('settings.navigatorHistory.traditionalDescription')}}
                        <br /><strong>{{$t('example')}}</strong>
                        <br />- {{$t('settings.navigatorHistory.example.openDirectory')}} <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPath')}}"</span>
                        <br />- {{$t('settings.navigatorHistory.example.openDirectory')}} <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPicturesPath')}}"</span>
                        <br />- {{$t('settings.navigatorHistory.example.openDirectory')}} <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPicturesScreenshotsPath')}}"</span>
                        <br />{{$t('settings.navigatorHistory.example.ifYouNowGoBackToDirectory')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPicturesPath')}}"</span>
                        {{$t('settings.navigatorHistory.example.andThenGoBackAgainTo')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPath')}}"</span>
                        {{$t('settings.navigatorHistory.example.andThenOpen')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userVideosPath')}}"</span>,
                        {{$t('settings.navigatorHistory.example.traditionalExampleDescription')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userPath')}}"</span>
                        {{$t('settings.navigatorHistory.example.and')}}
                        <span class="inline-code--light py-0">"{{$t('settings.navigatorHistory.example.userVideosPath')}}"</span>.
                      </span>
                    </v-tooltip>
                  </v-radio-group>
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 5 || filterQuery !== ''"
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
                  title: $t('settings.input.navigator')
                }"
              >
                <template #content>
                  <div>
                    <div class="text--sub-title-1 mt-2">
                      {{$t('settings.input.directoryItems')}}
                    </div>

                    <div class="mb-5">
                      <v-switch
                        v-model="navigatorShowHiddenDirItems"
                        class="my-0"
                        :label="$t('settings.input.showHiddenItems')"
                      />

                      <v-switch
                        v-model="navigatorOpenDirItemWithSingleClick"
                        class="my-0"
                        :label="$t('settings.input.openWithSingleClick')"
                        hide-details
                      />

                      <div
                        v-show="navigatorOpenDirItemWithSingleClick"
                        class="mt-3"
                      >
                        {{$t('settings.input.hold')}} <span class="inline-code--light">Alt</span> {{$t('settings.input.buttonToSelectWithoutOpening')}}
                      </div>
                    </div>

                    <div class="mb-0">
                      <v-text-field
                        v-show="!navigatorOpenDirItemWithSingleClick"
                        v-model="validatedOpenDirItemSecondClickDelay"
                        :label="$t('settings.input.doubleClickDelayMs')"
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
                  title: $t('settings.input.inputElements')
                }"
              >
                <template #content>
                  <div>
                    <div class="text--sub-title-1 mt-2">
                      {{$t('filter.filterOptions')}}
                    </div>
                    <v-switch
                      v-model="focusFilterOnTyping"
                      class="mt-0 mb-4"
                      :label="$t('settings.input.activateWhenTyping')"
                      hide-details
                    />

                    <v-switch
                      v-model="focusFilterOnDirectoryChange"
                      class="mt-0 mb-4"
                      :label="$t('settings.input.activateWhenDirectoryChanges')"
                      hide-details
                    />

                    <div class="text--sub-title-1 mt-2">
                      {{$t('settings.input.helpers')}}
                    </div>
                    <v-switch
                      v-model="spellcheck"
                      class="my-0"
                      :label="$t('settings.input.spellcheck')"
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
                  title: $t('settings.mouseButtons.mouseButtons')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.mouseButtons.buttonActions')}}
                  </div>

                  <v-select
                    v-model="pointerButton3onMouseUpEvent"
                    :items="pointerButton3onMouseUpEventItems"
                    return-object
                    item-text="title"
                    :label="$t('settings.mouseButtons.mouseButton3')"
                    style="max-width: 400px"
                  />

                  <v-select
                    v-model="pointerButton4onMouseUpEvent"
                    :items="pointerButton4onMouseUpEventItems"
                    return-object
                    item-text="title"
                    :label="$t('settings.mouseButtons.mouseButton4')"
                    style="max-width: 400px"
                  />
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 6 || filterQuery !== ''"
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
                  title: $t('settings.globalSearch.title')
                }"
              >
                <template #content>
                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.globalSearch.globalSearchFeature')}}
                  </div>

                  <v-switch
                    v-model="globalSearchIsEnabled"
                    class="my-0"
                    :label="$t('settings.globalSearch.enableGlobalSearch')"
                    hide-details
                  />

                  <div class="text--sub-title-1 mt-2">
                    {{$t('settings.globalSearch.quickActions')}}
                  </div>

                  <div class="button-container">
                    <v-btn
                      v-if="globalSearchIsEnabled"
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
                      {{$t('settings.globalSearch.reScanDrives')}}
                    </v-btn>

                    <v-btn
                      class="button-1"
                      depressed
                      small
                      @click="$store.dispatch('loadDir', {
                        path: appPaths.storageDirectories.appStorageGlobalSearchData
                      })"
                    >
                      <v-icon
                        class="mr-2"
                        small
                      >
                        mdi-folder-outline
                      </v-icon>
                      {{$t('settings.globalSearch.openSearchDataDirectory')}}
                    </v-btn>
                  </div>

                  <div
                    class="mt-4"
                    v-html="$t('allowGlobalSearchMessage')"
                  />

                  <div v-if="globalSearchIsEnabled">
                    <div class="text--sub-title-1 mt-2">
                      {{$t('settings.globalSearch.searchData')}}
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

                    <div class="text--sub-title-1 mt-2">
                      {{$t('settings.globalSearch.searchOptions')}}
                    </div>

                    <v-select
                      v-model="globalSearchAutoScanIntervalTime"
                      :items="globalSearchAutoScanIntervalItems"
                      :label="`${$t('settings.globalSearch.autoScanPeriod')} ${disabledInDev}`"
                      :disabled="scanInProgress || searchInProgress"
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
                            :disabled="scanInProgress || searchInProgress"
                            :label="$t('settings.globalSearch.scanDepth')"
                            :menu-props="{
                              contentClass: 'custom-scrollbar',
                              offsetY: true
                            }"
                            style="max-width: 200px"
                            @blur="handleBlurGlobalSearchScanDepth"
                          >
                            <template #selection>
                              {{$tc('count.directories', globalSearchScanDepth)}}
                            </template>
                            <template #item="{item}">
                              {{$tc('count.directories', item)}}
                            </template>
                          </v-select>
                        </div>
                      </template>
                      <span>
                        {{$t('settings.globalSearch.higherDepthScansWillIncrease')}}
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
                              :disabled="scanInProgress || searchInProgress"
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
                                {{$t('settings.globalSearch.compressSearchData')}}
                              </template>
                            </v-switch>
                          </div>
                        </template>
                        <span>
                          {{$t('settings.globalSearch.compressionReduces')}}
                        </span>
                      </v-tooltip>
                    </div>

                    <v-combobox
                      v-model="globalSearchDisallowedPaths"
                      :items="globalSearchDisallowedPathsItems"
                      :label="$t('settings.globalSearch.ignoredPaths')"
                      :disabled="scanInProgress || searchInProgress"
                      multiple
                      style="max-width: 400px"
                    >
                      <template #prepend-item>
                        <v-list-item>
                          <v-list-item-content>
                            <v-list-item-title>
                              {{$t('settings.globalSearch.enterPathToAddToIgnored')}}
                              <span class="inline-code--light">Enter</span>
                            </v-list-item-title>
                          </v-list-item-content>
                        </v-list-item>
                      </template>
                      <template #item="{item}">
                        <v-list-item @click.stop="toggleGlobalSearchDisallowedPathItem(item)">
                          <v-list-item-action>
                            <v-icon>{{globalSearchDisallowedPathsIcon(item)}}</v-icon>
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
                          (+{{$t('count.other', {n: globalSearchDisallowedPaths.length - 2})}})
                        </span>
                      </template>
                    </v-combobox>

                    <div class="text--sub-title-1 mt-2">
                      {{$t('settings.globalSearch.timeEstimates')}}
                    </div>
                    <div>
                      <v-icon :color="estimatedGlobalSearchScanTime.color">
                        mdi-circle-medium
                      </v-icon>
                      {{$t('settings.globalSearch.estimatedDataScanTime')}}
                      <span
                        class="ml-1"
                        style="font-size: 14px;"
                      >
                        {{estimatedGlobalSearchScanTime.time}}
                        {{$t('settings.globalSearch.per1TbDrive')}}
                      </span>
                    </div>
                    <div>
                      <v-icon :color="estimatedGlobalSearchTime.color">
                        mdi-circle-medium
                      </v-icon>
                      {{$t('settings.globalSearch.estimatedSearchTime')}}
                      <span
                        class="ml-1"
                        style="font-size: 14px;"
                      >
                        {{estimatedGlobalSearchTimeText}}
                      </span>
                    </div>
                  </div>
                </template>
              </section-settings>
            </div>

            <div
              v-show="settingsSelectedTab === 7 || filterQuery !== ''"
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
                  title: $t('dataBackupReminder.title')
                }"
              >
                <template #content>
                  <p>
                    {{$t('dataBackupReminder.description')}}
                  </p>
                  <p>
                    {{$t('dataBackupReminder.autoBackupWillBeAdded')}}
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
                  title: $t('settings.drives.driveDetection')
                }"
              >
                <template #content>
                  <v-checkbox
                    v-model="focusMainWindowOnDriveConnected"
                    :label="$t('settings.drives.focusAppWhenDriveConnected')"
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
                  title: $t('settings.data.imageThumbnails')
                }"
              >
                <template #description>
                  {{$t('settings.data.everyTimeYouOpenDirectory')}}
                </template>
                <template #content>
                  <div class="text--sub-title-1">
                    {{$t('settings.data.thumbnailStorageLimit')}}
                  </div>

                  <div>{{$t('limit')}}: {{thumbnailStorageLimit}} {{$t('units.mb')}}</div>

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
              v-show="settingsSelectedTab === 8 || filterQuery !== ''"
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
                  title: $t('settings.stats.directoryItemStatistics')
                }"
              >
                <template #description>
                  <p>
                    {{$t('settings.stats.storeSomeEventData')}}
                  </p>
                  <p>
                    {{$t('settings.stats.thisDataIsUsed')}}
                  </p>
                </template>
                <template #content>
                  <div class="text--sub-title-1">
                    {{$t('settings.stats.statisticsStoring')}}
                  </div>

                  <div
                    class="setting-container"
                  >
                    <v-switch
                      v-model="storeDirItemOpenEvent"
                      :label="$t('settings.stats.storeOpenedDirectoryItems')"
                      hide-details
                    />
                  </div>

                  <div
                    class="setting-container"
                  >
                    <v-switch
                      v-if="storeDirItemOpenEvent"
                      v-model="storeDirItemOpenCount"
                      :label="$t('settings.stats.storeAmountDirectoryItemWasOpened')"
                      hide-details
                    />
                  </div>

                  <v-switch
                    v-if="storeDirItemOpenEvent"
                    v-model="storeDirItemOpenDate"
                    :label="$t('settings.stats.storeTheDateOpeningDirectoryItem')"
                    hide-details
                  />

                  <p class="mt-6">
                    {{$t('settings.stats.statisticsLocationDescription')}}
                  </p>
                  <v-btn
                    class="button-1 mb-2"
                    depressed
                    small
                    @click="$store.dispatch('loadDir', { path: appPaths.storageDirectories.appStorage })"
                  >
                    <v-icon
                      class="mr-2"
                      small
                    >
                      mdi-folder-outline
                    </v-icon>
                    {{$t('settings.stats.openFileLocation')}}
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
import ActionToolbar from '@/views/SettingsView/ActionToolbar/ActionToolbar.vue'
import SectionSettings from '../components/SectionSettings.vue'
import itemFilter from '../utils/itemFilter'
import FilterClearButton from '@/components/FilterClearButton/index.vue'
import AppButton from '@/components/AppButton/AppButton.vue'
import AppIcon from '@/components/AppIcon/AppIcon.vue'
import ShortcutList from '@/components/ShortcutList.vue'
import {getSystemFontsWithType} from '@/utils/getSystemFonts.js'
import {regionalFormats} from '@/data/regionalFormats.js'

const electron = require('electron')

export default {
  name: 'settings',
  components: {
    SectionSettings,
    FilterClearButton,
    ActionToolbar,
    AppButton,
    AppIcon,
    ShortcutList,
  },
  data () {
    return {
      isFetchingSystemFonts: false,
      fontFilter: '',
      dateTimeRegionalFormatFilter: '',
      githubProjectData: {
        stars: 0,
      },
      settingsSelectedTab: 0,
      suggestedGlobalSearchScanDepthItems: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    }
  },
  watch: {
    globalSearchIsEnabled (value) {
      if (value) {
        this.$eventHub.$emit('app:method', {
          method: 'initGlobalSearchDataScan',
        })
      }
    },
    autoDetectDateTimeRegionalFormat (value) {
      if (value) {
        this.setAutoDetectedDateTimeRegionalFormat()
      }
    },
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
    dateTimePropertiesShowSeconds (value) {
      if (!value) {
        this.dateTimePropertiesShowMilliseconds = false
      }
    },
    dateTimePropertiesShowMilliseconds (value) {
      if (value) {
        this.dateTimePropertiesShowSeconds = true
      }
    },
  },
  beforeCreate () {
    const models = {
      storeDirItemOpenEvent: 'storageData.settings.stats.storeDirItemOpenEvent',
      storeDirItemOpenCount: 'storageData.settings.stats.storeDirItemOpenCount',
      storeDirItemOpenDate: 'storageData.settings.stats.storeDirItemOpenDate',
      globalSearchIsEnabled: 'storageData.settings.globalSearchIsEnabled',
      globalSearchCompressSearchData: 'storageData.settings.compressSearchData',
      globalSearchScanDepth: 'storageData.settings.globalSearchScanDepth',
      globalSearchAutoScanIntervalTime: 'storageData.settings.globalSearchAutoScanIntervalTime',
      globalSearchAutoScanIntervalItems: 'storageData.settings.globalSearchAutoScanIntervalItems',
      autoCheckForAppUpdates: 'storageData.settings.appUpdates.autoCheck',
      autoDownloadAppUpdates: 'storageData.settings.appUpdates.autoDownload',
      autoInstallAppUpdates: 'storageData.settings.appUpdates.autoInstall',
      windowCloseButtonAction: 'storageData.settings.windowCloseButtonAction',
      themeType: 'storageData.settings.theme.type',
      transparentToolbars: 'storageData.settings.theme.transparentToolbars',
      showDirItemKindDividers: 'storageData.settings.navigator.showDirItemKindDividers',
      saveNavigatorSorting: 'storageData.settings.sorting.saveNavigatorSorting',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
      navigatorLayout: 'storageData.settings.navigatorLayout',
      showWorkspaceTitleInToolbar: 'storageData.settings.navigator.workspaces.showTitleInToolbar',
      navigatorTabBehavior: 'storageData.settings.navigator.tabs.tabBehavior',
      navigatorTabLayout: 'storageData.settings.navigator.tabs.layout',
      navigatorTabWidth: 'storageData.settings.navigator.tabs.tabWidth',
      showTabPreview: 'storageData.settings.navigator.tabs.showTabPreview',
      showTabStorageIndicator: 'storageData.settings.navigator.tabs.showTabStorageIndicator',
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
      font: 'storageData.settings.text.font',
      dateTimeMonth: 'storageData.settings.dateTime.month',
      dateTimeHour12: 'storageData.settings.dateTime.hour12',
      dateTimeRegionalFormat: 'storageData.settings.dateTime.regionalFormat',
      autoDetectDateTimeRegionalFormat: 'storageData.settings.dateTime.autoDetectRegionalFormat',
      dateTimePropertiesShowSeconds: 'storageData.settings.dateTime.properties.showSeconds',
      dateTimePropertiesShowMilliseconds: 'storageData.settings.dateTime.properties.showMilliseconds',
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
      focusFilterOnTyping: 'storageData.settings.focusFilterOnTyping',
      focusFilterOnDirectoryChange: 'storageData.settings.focusFilterOnDirectoryChange',
      navigatorViewInfoPanel: 'storageData.settings.infoPanels.navigatorView',
      selectedLanguage: 'storageData.settings.localization.selectedLanguage',
      languages: 'storageData.settings.localization.languages',
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
    this.$store.dispatch('routeOnActivated', this.$route.name)
  },
  created () {
    this.settingsSelectedTab = this.lastOpenedSettingsTabValue
  },
  mounted () {
    this.$store.dispatch('routeOnMounted', this.$route.name)
    this.setAutoDetectedDateTimeRegionalFormat()
    this.fetchSystemFonts()
    this.fetchSettingsDataMap()
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
      searchInProgress: 'globalSearch.searchInProgress',
      settingsDataMap: 'settingsView.settingsDataMap',
      filterQuery: 'filterField.view.settings.query',
      fonts: 'storageData.settings.text.fonts',
    }),
    filteredFonts () {
      const filterQuery = this.fontFilter.toLowerCase()
      return this.fonts.filter(font => {
        const nameMatch = font.name.toLowerCase().includes(filterQuery)
        return nameMatch
      })
    },
    dateTimeRegionalFormats () {
      return regionalFormats
    },
    filteredDateTimeRegionalFormats () {
      const filterQuery = this.dateTimeRegionalFormatFilter.toLowerCase()
      return this.dateTimeRegionalFormats.filter(item => {
        const codeMatch = item.code.toLowerCase().includes(filterQuery)
        const nameMatch = item.name.toLowerCase().includes(filterQuery)
        return codeMatch || nameMatch
      })
    },
    settingsTabs () {
      return [
        {text: this.$t('settingsTabs.general')},
        {text: this.$t('settingsTabs.uiAppearance')},
        {text: this.$t('settingsTabs.shortcuts')},
        // {text: this.$t('settingsTabs.performance')},
        {text: this.$t('settingsTabs.tabsWorkspaces')},
        {text: this.$t('settingsTabs.navigation')},
        {text: this.$t('settingsTabs.input')},
        {text: this.$t('settingsTabs.search')},
        {text: this.$t('settingsTabs.dataStorage')},
        {text: this.$t('settingsTabs.stats')},
      ]
    },
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
          title: this.$t('projectGithubButtons.projectPage'),
          link: this.appPaths.githubRepoLink,
        },
        {
          title: this.$t('projectGithubButtons.requestsIssues'),
          link: this.appPaths.githubIssuesLink,
        },
        {
          title: this.$t('projectGithubButtons.discussions'),
          link: this.appPaths.githubDiscussionsLink,
        },
        {
          title: this.$t('projectGithubButtons.stars', {n: this.githubProjectData.stars}),
          icon: 'mdi-star-outline',
          link: this.appPaths.githubRepoLink,
        },
      ]
    },
    UIButtons () {
      return [
        {
          title: this.$t('settings.general.decreaseZoomLevel'),
          shortcut: this.shortcuts.zoomDecrease.shortcut,
          icon: 'mdi-minus',
          onClick: () => this.$store.dispatch('DECREASE_UI_ZOOM'),
        },
        {
          title: this.$t('settings.general.increaseZoomLevel'),
          shortcut: this.shortcuts.zoomIncrease.shortcut,
          icon: 'mdi-plus',
          onClick: () => this.$store.dispatch('INCREASE_UI_ZOOM'),
        },
        {
          title: this.$t('settings.general.resetZoomLevel'),
          shortcut: this.shortcuts.zoomReset.shortcut,
          buttonText: this.$t('reset'),
          onClick: () => this.$store.dispatch('RESET_UI_ZOOM'),
        },
        {
          title: this.$t('fullScreen'),
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
    estimatedGlobalSearchTimeText () {
      const minTime = `1 ${this.$t('sec')}`
      const maxTime = `${this.estimatedGlobalSearchTime.time}`
      const description = this.$t('settings.globalSearch.dependsOnFileLocation')
      return `${minTime} — ${maxTime} ${description}`
    },
    checkedOpenDirItemSecondClickDelay () {
      const value = parseInt(this.openDirItemSecondClickDelay)
      const minValue = 200
      const maxValue = 1000
      const validValueRange = minValue <= value && value <= maxValue
      if (!validValueRange) {
        return {
          isValid: false,
          error: this.$t('settings.input.valueRangeFrom200To1000ms'),
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
        filterProperties: this.$store.state.filterField.view.settings.filterProperties,
        filterQueryOptions: this.$store.state.filterField.view.settings.options,
      })
    },
  },
  methods: {
    globalSearchDisallowedPathsIcon (item) {
      return this.globalSearchDisallowedPaths.includes(item)
        ? 'mdi-checkbox-outline'
        : 'mdi-checkbox-blank-outline'
    },
    async fetchSystemFonts () {
      electron.ipcRenderer.send('focus-main-app-window')
      this.isFetchingSystemFonts = true
      setTimeout(async () => {
        const defaultFont = this.defaultData.storageData.settings.text.font
        const systemFonts = await getSystemFontsWithType()
        this.fonts = [...[{name: defaultFont, type: ''}], ...systemFonts]
        this.isFetchingSystemFonts = false
      }, 500)
    },
    resetFont () {
      this.font = this.defaultData.storageData.settings.text.font
    },
    isDeafultFont (font) {
      return font === this.defaultData.storageData.settings.text.font
    },
    resetRegionalFormat () {
      this.dateTimeRegionalFormat = this.defaultData.storageData.settings.dateTime.regionalFormat
    },
    setAutoDetectedDateTimeRegionalFormat () {
      if (this.autoDetectDateTimeRegionalFormat) {
        const detectedLocale = this.$utils.detectedLocale.toLowerCase()
        let foundRegionalFormat = regionalFormats.find(regionalFormat => regionalFormat.code.toLowerCase() === detectedLocale)
        if (foundRegionalFormat) {
          this.dateTimeRegionalFormat = foundRegionalFormat
        }
      }
    },
    fetchSettingsDataMap () {
      this.settingsDataMap = [
        {
          sectionName: 'language',
          tags: this.$t('settingsTags.language'),
        },
        {
          sectionName: 'ui-scaling',
          tags: this.$t('settingsTags.uiScaling'),
        },
        {
          sectionName: 'updates',
          tags: this.$t('settingsTags.updates'),
        },
        {
          sectionName: 'app-properties',
          tags: this.$t('settingsTags.appProperties'),
        },
        {
          sectionName: 'window-controls',
          tags: this.$t('settingsTags.windowControls'),
        },
        {
          sectionName: 'visual-effects',
          tags: this.$t('settingsTags.visualEffects'),
        },
        {
          sectionName: 'theme',
          tags: this.$t('settingsTags.theme'),
        },
        {
          sectionName: 'visual-filters',
          tags: this.$t('settingsTags.visualFilters'),
        },
        {
          sectionName: 'animations',
          tags: this.$t('settingsTags.animations'),
        },
        {
          sectionName: 'fonts',
          tags: this.$t('settingsTags.fonts'),
        },
        {
          sectionName: 'date-time',
          tags: this.$t('settingsTags.dateTime'),
        },
        {
          sectionName: 'overlays',
          tags: this.$t('settingsTags.overlays'),
        },
        {
          sectionName: 'ui-elements',
          tags: this.$t('settingsTags.uiElements'),
        },
        {
          sectionName: 'home-page-media-banner',
          tags: this.$t('settingsTags.homePageMediaBanner'),
        },
        {
          sectionName: 'info-panel',
          tags: this.$t('settingsTags.infoPanel'),
        },
        {
          sectionName: 'navigator',
          tags: this.$t('settingsTags.navigator'),
        },
        {
          sectionName: 'shortcuts',
          tags: this.$t('settingsTags.shortcuts'),
        },
        {
          sectionName: 'gpu-system-memory',
          tags: this.$t('settingsTags.gpuSystemMemory'),
        },
        {
          sectionName: 'workspaces',
          tags: this.$t('settingsTags.workspaces'),
        },
        {
          sectionName: 'tabs',
          tags: this.$t('settingsTags.tabs'),
        },
        {
          sectionName: 'navigator-history',
          tags: this.$t('settingsTags.navigatorHistory'),
        },
        {
          sectionName: 'input-navigator',
          tags: this.$t('settingsTags.inputNavigator'),
        },
        {
          sectionName: 'input-elements',
          tags: this.$t('settingsTags.inputElements'),
        },
        {
          sectionName: 'mouse-buttons',
          tags: this.$t('settingsTags.mouseButtons'),
        },
        {
          sectionName: 'global-search',
          tags: this.$t('settingsTags.globalSearch'),
        },
        {
          sectionName: 'data-backup-reminder',
          tags: this.$t('settingsTags.dataBackupReminder'),
        },
        {
          sectionName: 'drive-detection',
          tags: this.$t('settingsTags.driveDetection'),
        },
        {
          sectionName: 'image-thumbnails',
          tags: this.$t('settingsTags.imageThumbnails'),
        },
        {
          sectionName: 'directory-item-statistics',
          tags: this.$t('settingsTags.directoryItemStatistics'),
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
    },
  },
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
    grid-template-columns: 280px 1fr;
  }

#settings-view
  .tab-view
    .v-window {
      border-right: 1px solid var(--divider-color-2);
    }
</style>
