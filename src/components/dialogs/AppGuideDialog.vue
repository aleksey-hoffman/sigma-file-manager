<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <dialog-generator
    :dialog="dialog"
    :close-button="{
      onClick: () => $store.dispatch('closeDialog', {name: 'appGuideDialog'}),
    }"
    :title="$t('dialogs.appGuideDialog.appGuide')"
    max-width="90vw"
    height="85vh"
    fade-mask-bottom="8%"
  >
    <template #content>
      <div class="tab-view">
        <v-tabs
          v-model="dialog.data.guideTabsSelected"
          class="tab-view__header"
          show-arrows="mobile"
          :vertical="windowSize.x > 700"
          :height="windowSize.x > 700 ? '' : '42'"
        >
          <v-tab
            v-for="(tab, index) in dialog.data.guideTabs"
            :key="index"
            :style="{
              'border': tab.text === 'dialogs.appGuideDialog.nav.comingSoon' ? '3px dotted var(--highlight-color-3)' : 'none',
            }"
          >
            <!-- <v-badge
              :value="tab.text !== 'dialogs.appGuideDialog.nav.comingSoon'"
              color="blue"
              dot
              left
            > -->
            <v-icon
              v-if="tab.icon"
              class="mr-4"
              size="20"
            >
              {{tab.icon}}
            </v-icon>
            {{$t(tab.text)}}
            <!-- </v-badge> -->
          </v-tab>
        </v-tabs>

        <v-tabs-items
          v-model="dialog.data.guideTabsSelected"
          class="tab-view__header__content mb-6"
        >
          <!-- tab:shorcuts -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />

            <ShortcutList />

            <h3>{{$t('dialogs.appGuideDialog.shortcuts.about')}}</h3>
            <p>
              {{$t('dialogs.appGuideDialog.shortcuts.shortcutsInfo')}}
            </p>
            <p>
              {{$t('dialogs.appGuideDialog.shortcuts.efficiencyBenefit')}}
            </p>
            <p>
              {{$t('dialogs.appGuideDialog.shortcuts.press')}}
              <span class="inline-code--light mx-1">
                {{shortcuts.shortcutsDialog.shortcut}}
              </span>
              {{$t('dialogs.appGuideDialog.shortcuts.keyboardButton')}}
              <v-icon
                class="mx-1"
                size="18px"
              >
                mdi-pound
              </v-icon>
              {{$t('dialogs.appGuideDialog.shortcuts.toolbarButton')}}
            </p>
            <div class="text--title-2 mt-2">
              {{$t('dialogs.appGuideDialog.shortcuts.examples')}}
            </div>
            <div class="text--sub-title-1 mt-2">
              {{$t('dialogs.appGuideDialog.shortcuts.focusAppInfo')}}
            </div>
            {{$t('dialogs.appGuideDialog.shortcuts.focusAppShortcut')}}
            <span class="inline-code--light mx-1">
              {{shortcuts.toggleApp.shortcut}}
            </span>
            {{$t('dialogs.appGuideDialog.shortcuts.focusAppInstruction')}}
            <div class="text--sub-title-1 mt-6">
              {{$t('dialogs.appGuideDialog.shortcuts.createNewNoteInfo')}}
            </div>
            {{$t('dialogs.appGuideDialog.shortcuts.createNewNoteShortcut')}}
            <span class="inline-code--light mx-1">
              {{shortcuts.newNote.shortcut}}
            </span>
            {{$t('dialogs.appGuideDialog.shortcuts.createNewNoteInstruction')}}
            <div class="text--sub-title-1 mt-6">
              {{$t('dialogs.appGuideDialog.shortcuts.switchTabInfo')}}
            </div>
            {{$t('dialogs.appGuideDialog.shortcuts.switchTabShortcut')}}
            <span class="inline-code--light mx-1">
              {{shortcuts.switchTab.shortcut}}
            </span>
            {{$t('dialogs.appGuideDialog.shortcuts.switchTabInstruction')}}
          </v-tab-item>

          <!-- tab:introduction -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />
            <h3>{{$t('dialogs.appGuideDialog.introduction.getInvolved')}}</h3>
            <p>
              {{$t('dialogs.appGuideDialog.introduction.participationWays')}}
              <br />{{$t('dialogs.appGuideDialog.introduction.participationOptions')}}:
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
              {{$t('dialogs.appGuideDialog.introduction.rewards')}}:
            </p>

            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-btn
                  class="button-1"
                  depressed
                  small
                  v-on="on"
                  @click="$utils.openLink(appPaths.githubReadmeSupportSectionLink)"
                >
                  {{$t('dialogs.appGuideDialog.introduction.joinCommunity')}}
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

            <h3>{{$t('dialogs.appGuideDialog.introduction.potentialErrors')}}</h3>
            <p>
              {{$t('dialogs.appGuideDialog.introduction.earlyDevelopment')}}
            </p>
            <p>
              {{$t('dialogs.appGuideDialog.introduction.errorReporting')}}
            </p>
            <h3>{{$t('dialogs.appGuideDialog.introduction.potentialProblems')}}</h3>
            <ul>
              <li>
                {{$t('dialogs.appGuideDialog.introduction.nextUpdatesMightOverwrite')}}
              </li>
              <li>
                {{$t('dialogs.appGuideDialog.introduction.expectToSeeSomeErrors')}}
              </li>
              <li>
                {{$t('dialogs.appGuideDialog.introduction.notThoroughlyTestedYet')}}
              </li>
              <li>
                {{$t('dialogs.appGuideDialog.introduction.notOptimizedYet')}}
              </li>
            </ul>
          </v-tab-item>

          <!-- tab:featureOverview -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />
          </v-tab-item>

          <!-- tab:media-downloading -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />

            <h3>{{$t('dialogs.appGuideDialog.mediaDownloading.videoDownloading')}}</h3>
            <p>
              {{$t('dialogs.appGuideDialog.mediaDownloading.mostActionsWithShortcuts')}}
            </p>
          </v-tab-item>

          <!-- tab:navigator tips -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />

            <h3>{{$t('dialogs.appGuideDialog.navigatorTips.rangeItemSelection')}}</h3>
            <div>
              {{$t('dialogs.appGuideDialog.navigatorTips.toSelectMultipleDirectoryItems')}}
              <span class="inline-code--light">{{$t('dialogs.appGuideDialog.navigatorTips.hold')}} [Shift] + LClick</span>
              {{$t('dialogs.appGuideDialog.navigatorTips.toSelectThe')}} <span class="inline-code--light">{{$t('dialogs.appGuideDialog.navigatorTips.start')}}</span>
              {{$t('dialogs.appGuideDialog.navigatorTips.itemThenMoveTheCursor')}}
              <span class="inline-code--light">{{$t('dialogs.appGuideDialog.navigatorTips.end')}}</span> {{$t('dialogs.appGuideDialog.navigatorTips.itemAnd')}}
              {{$t('dialogs.appGuideDialog.navigatorTips.press')}} <span class="inline-code--light">LClick</span> {{$t('dialogs.appGuideDialog.navigatorTips.onItToSelectTheRange')}}
            </div>
            <img
              class="mt-4"
              src="src/assets/guide/navigator-list-highlight-1.png"
            />

            <h3>{{$t('dialogs.appGuideDialog.navigatorTips.singleItemSelection')}}</h3>
            <div>
              {{$t('dialogs.appGuideDialog.navigatorTips.toSelectASingleDirectoryItemPress')}}
              <span class="inline-code--light">Ctrl + LClick</span>
              {{$t('dialogs.appGuideDialog.navigatorTips.onTheItemToSelectIt')}}
            </div>

            <h3>{{$t('dialogs.appGuideDialog.navigatorTips.keyboardItemNavigation')}}</h3>
            <div>
              <ul>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.toMoveSelectionToNextItem')}}
                  <span class="inline-code--light">{{shortcuts.navigateDirDown.shortcut}}</span>
                  {{$t('dialogs.appGuideDialog.navigatorTips.or')}}
                  <span class="inline-code--light">{{shortcuts.navigateDirRight.shortcut}}</span>
                  {{$t('dialogs.appGuideDialog.navigatorTips.gridLayoutOnly')}}
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.toMoveSelectionToPreviousItem')}}
                  <span class="inline-code--light">{{shortcuts.navigateDirUp.shortcut}}</span>
                  {{$t('dialogs.appGuideDialog.navigatorTips.or')}}
                  <span class="inline-code--light">{{shortcuts.navigateDirLeft.shortcut}}</span>
                  {{$t('dialogs.appGuideDialog.navigatorTips.gridLayoutOnly')}}
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.toOpenCurrentDirectoryPress')}}
                  <span class="inline-code--light">{{shortcuts.openSelectedDirectory.shortcut}}</span>
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.toQuitCurrentDirectoryPress')}}
                  <span class="inline-code--light">{{shortcuts.quitSelectedDirectory.shortcut}}</span>
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.goToPreviousDirectoryInHistory')}}
                  <span class="inline-code--light">{{shortcuts.goToPreviousDirectory.shortcut}}</span>
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.goToNextDirectoryInHistory')}}
                  <span class="inline-code--light">{{shortcuts.goToNextDirectory.shortcut}}</span>
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.navigatorTips.goUpDirectory')}}
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
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />
            <p>
              {{$t('dialogs.appGuideDialog.dataProtection.mainPurpose')}}
            </p>
            <p>
              {{$t('dialogs.appGuideDialog.dataProtection.protectionIsAchieved')}}
            </p>
            <p>
              {{$t('dialogs.appGuideDialog.dataProtection.goodWayToPreventYourself')}}
            </p>

            <h3>{{$t('dialogs.appGuideDialog.dataProtection.modes')}}</h3>

            <div class="mt-4">
              <ul>
                <li class="mb-2">
                  {{$t('dialogs.appGuideDialog.dataProtection.simpleMode')}}
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.dataProtection.advancedMode')}}
                </li>
                <li>
                  {{$t('dialogs.appGuideDialog.dataProtection.immutableMode')}}
                </li>
              </ul>
              <div class="mt-4">
                ⚠ <strong>{{$t('dialogs.appGuideDialog.dataProtection.warning')}}</strong>
                <br />
                {{$t('dialogs.appGuideDialog.dataProtection.useWithCaution')}}
              </div>
            </div>
          </v-tab-item>

          <!-- tab:address bar -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />
            <img
              class="mt-0"
              src="src/assets/guide/address-bar-1.png"
            />
            {{$t('dialogs.appGuideDialog.addressBar.addressBarAllows')}}
            <h3>{{$t('dialogs.appGuideDialog.addressBar.features')}}</h3>
            <ul>
              <li>
                <strong>{{$t('dialogs.appGuideDialog.addressBar.quickNavigation')}}:</strong>
                {{$t('dialogs.appGuideDialog.addressBar.itWillAutomaticallyOpen')}}
              </li>
              <li>
                <strong>{{$t('dialogs.appGuideDialog.addressBar.quickFileOpening')}}:</strong>
                {{$t('dialogs.appGuideDialog.addressBar.toOpenTheSpecifiedFile')}}
              </li>
              <li>
                <strong>{{$t('dialogs.appGuideDialog.addressBar.autocomplete')}}:</strong>
                {{$t('dialogs.appGuideDialog.addressBar.press')}}
                <span class="inline-code--light">tab</span>
                {{$t('or')}}
                <span class="inline-code--light">Shift + tab</span>
                {{$t('dialogs.appGuideDialog.addressBar.toAutocompleteIterate')}}
              </li>
              <li>
                <strong>{{$t('dialogs.appGuideDialog.addressBar.quotesNotNeeded')}}:</strong>
                {{$t('dialogs.appGuideDialog.addressBar.namesThatHaveSpaces')}}
              </li>
              <li>
                <strong>{{$t('dialogs.appGuideDialog.addressBar.followsStandards')}}:</strong>
                {{$t('dialogs.appGuideDialog.addressBar.onWindowsOsAllBackwardSlashes')}}
                <span class="inline-code--light">\</span>
                {{$t('dialogs.appGuideDialog.addressBar.areAutomaticallyConverted')}}
                <span class="inline-code--light">/</span>
                {{$t('dialogs.appGuideDialog.addressBar.toProvideSeamless')}}
              </li>
            </ul>
            <h3>{{$t('dialogs.appGuideDialog.addressBar.whereToFindIt')}}</h3>
            {{$t('dialogs.appGuideDialog.addressBar.addressBarCanBeOpened')}}:
            <span class="inline-code--light">
              {{shortcuts.focusAddressBar.shortcut}}
            </span>
            {{$t('dialogs.appGuideDialog.addressBar.orByPressing')}}
            <span class="inline-code--light">{{$t('dialogs.appGuideDialog.addressBar.typeInAddressManually')}}</span>
            {{$t('dialogs.appGuideDialog.addressBar.buttonInTheAddressBarMenu')}}
            <img src="src/assets/guide/address-bar-2.png" />
          </v-tab-item>

          <!-- tab:coming soon -->
          <v-tab-item
            transition="fade-in"
            reverse-transition="fade-in"
          >
            <div class="text--title-1 mb-1">
              {{getGuideTitle(dialog.data.guideTabsSelected)}}
            </div>
            <v-divider class="divider-color-2 mb-4" />
            {{$t('dialogs.appGuideDialog.moreGuidesWillBeAdded')}}
          </v-tab-item>
        </v-tabs-items>
      </div>
    </template>
  </dialog-generator>
</template>

<script>
import {mapState} from 'vuex'
import ShortcutList from '@/components/ShortcutList.vue'

export default {
  components: {
    ShortcutList,
  },
  computed: {
    ...mapState({
      appPaths: state => state.storageData.settings.appPaths,
      dialog: state => state.dialogs.appGuideDialog,
      windowSize: state => state.windowSize,
      shortcuts: state => state.storageData.settings.shortcuts,
    }),
    guideHeaderButtons () {
      return [
        {
          title: this.$t('dialogs.appGuideDialog.guideHeaderButtons.projectPage'),
          link: this.appPaths.githubRepoLink,
        },
        {
          title: this.$t('dialogs.appGuideDialog.guideHeaderButtons.requestsIssues'),
          link: this.appPaths.githubIssuesLink,
        },
        {
          title: this.$t('dialogs.appGuideDialog.guideHeaderButtons.discussions'),
          link: this.appPaths.githubDiscussionsLink,
        },
      ]
    },
  },
  methods: {
    getGuideTitle (index) {
      const text = this.dialog?.data?.guideTabs?.[index]?.text
      return text ? this.$t(text) : ''
    },
  },
}
</script>

<style scoped>
.dialog-card
  .tab-view
    .tab-view__header {
      z-index: 2;
      position: sticky;
      height: fit-content;
      top: 0;
      background-color: var(--bg-color-1);
    }
</style>