<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <NoData
      title="placeholders.noUserDirectoriesFound"
      :show="userDirsFormatted.length === 0"
    />
    <ItemGrid :lines="1">
      <UserDirCard
        v-for="(userDir, index) in userDirsFormatted"
        :key="'user-dir-card-' + index"
        :user-dir="userDir"
      />
    </ItemGrid>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import NoData from '@/components/NoData/NoData.vue'
import ItemGrid from '@/components/ItemGrid/ItemGrid.vue'
import UserDirCard from '@/components/UserDirCard/UserDirCard.vue'

export default {
  components: {
    NoData,
    ItemGrid,
    UserDirCard,
  },
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
