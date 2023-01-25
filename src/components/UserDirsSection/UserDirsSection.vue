<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <div v-if="userDirs.length === 0">
      {{$t('placeholders.noUserDirectoriesFound')}}
    </div>
    <ItemCardGrid :lines="1">
      <ItemCard
        v-for="(userDir, index) in userDirsFormatted"
        :key="'user-dir-card-' + index"
        :item="userDir"
        :lines="1"
        target-type="userDir"
      />
    </ItemCardGrid>
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import ItemCardGrid from '@/components/ItemCardGrid/ItemCardGrid.vue'
import ItemCard from '@/components/ItemCard/ItemCard.vue'

export default {
  components: {
    ItemCardGrid,
    ItemCard,
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
