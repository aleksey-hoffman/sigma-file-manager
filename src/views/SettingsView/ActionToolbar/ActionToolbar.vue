<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <ActionToolbarBase>
    <!-- menu-button::app-quick-actions -->
    <AppMenuButton
      v-if="['settings'].includes($route.name)"
      button-class="action-toolbar__item"
      icon="mdi-menu-down"
      icon-size="32px"
      icon-class="action-toolbar__icon"
      :tooltip="$t('settings.general.appQuickActions')"
      :menu-items="quickActions"
    />
    <!-- menu-button::app-directories -->
    <AppMenuButton
      v-if="['settings'].includes($route.name)"
      button-class="action-toolbar__item"
      icon="mdi-folder-outline"
      icon-size="20px"
      icon-class="action-toolbar__icon"
      :tooltip="$t('settings.general.appDirectories')"
      :menu-items="appDirectories"
    />
    <!-- menu-button::app-related-links -->
    <AppMenuButton
      v-if="['settings'].includes($route.name)"
      button-class="action-toolbar__item"
      icon="mdi-link-variant"
      icon-size="20px"
      icon-class="action-toolbar__icon"
      :tooltip="$t('settings.general.appRelatedLinks')"
      :menu-items="appExternalLinks"
    />
    <VSpacer />
    <!-- filter-field -->
    <FilterField route-name="settings" />
  </ActionToolbarBase>
</template>

<script>
import {mapActions} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import FilterField from '@/components/FilterField.vue'
import ActionToolbarBase from '@/components/ActionToolbarBase/ActionToolbarBase.vue'
import AppMenuButton from '@/components/AppMenuButton/AppMenuButton.vue'

export default {
  components: {
    FilterField,
    ActionToolbarBase,
    AppMenuButton,
  },
  computed: {
    ...mapFields({
      appPaths: 'storageData.settings.appPaths',
    }),
    quickActions () {
      return [
        {
          title: 'Reset settings',
          icon: 'mdi-restore-alert',
          onClick: () => {this.resetAppSettings()},
        },
      ]
    },
    appExternalLinks () {
      return [
        {
          title: 'Project page on Github',
          icon: 'mdi-github',
          onClick: () => {this.$utils.openLink(this.appPaths.githubRepoLink)},
        },
        {
          title: 'Request feature',
          icon: 'mdi-github',
          onClick: () => {this.$utils.openLink(this.appPaths.githubIssueTemplateFeatureRequest)},
        },
        {
          title: 'Report problem',
          icon: 'mdi-github',
          onClick: () => {this.$utils.openLink(this.appPaths.githubIssueTemplateProblemReport)},
        },
      ]
    },
    appDirectories () {
      return [
        {
          title: 'App directory',
          icon: 'mdi-folder-outline',
          link: this.appPaths.storageDirectories.appStorage,
          linkType: 'local',
          onClick: () => {
            this.loadDir({path: this.appPaths.storageDirectories.appStorage})
          },
        },
        {
          title: 'App media directory',
          icon: 'mdi-folder-outline',
          link: this.appPaths.storageDirectories.appStorageMedia,
          linkType: 'local',
          onClick: () => {
            this.loadDir({path: this.appPaths.storageDirectories.appStorageMedia})
          },
        },
      ]
    },
  },
  methods: {
    ...mapActions([
      'resetAppSettings',
      'loadDir',
    ]),
  },
}
</script>
