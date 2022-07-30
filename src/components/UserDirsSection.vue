<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div v-if="userDirs.length === 0">
      No user directories found
    </div>

    <item-card-grid
      :lines="1"
    >
      <item-card
        v-for="(userDir, index) in userDirsFormatted"
        :key="'userDir-card-' + index"
        :item="userDir"
        :lines="1"
        target-type="userDir"
      />
    </item-card-grid>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'

export default {
  computed: {
    ...mapFields({
      userDirs: 'storageData.settings.appPaths.userDirs',
      showUserNameOnUserHomeDir: 'storageData.settings.showUserNameOnUserHomeDir',
    }),
    userDirsFormatted () {
      return this.$utils.cloneDeep(this.userDirs).map(item => {
        if (item.name === 'home' && this.showUserNameOnUserHomeDir) {
          item.title = `${item.title} | ${this.$utils.getPathBase(item.path)}`
        }
        return item
      })
    },
  },
}
</script>
