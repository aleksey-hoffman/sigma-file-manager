// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'
import utils from './utils/utils'
import sharedUtils from './utils/sharedUtils'
import storeUtils from './utils/storeUtils'
import {eventHub} from './utils/eventHub'
import {OverlayScrollbarsPlugin} from 'overlayscrollbars-vue'
import {i18n} from './localization/i18n'

// Import components globally, without lazy loading
import WindowToolbar from './components/WindowToolbar.vue'
import ClipboardToolbar from './components/ClipboardToolbar/index.vue'
import NavigationPanel from './components/NavigationPanel.vue'
import Dialogs from './components/Dialogs.vue'
import DialogGenerator from './components/DialogGenerator.vue'
import NotificationManager from './components/NotificationManager.vue'
import Overlays from './components/Overlays.vue'
import WorkspacesMenu from './components/WorkspacesMenu.vue'
import TabsMenu from './components/TabsMenu.vue'
import BasicMenu from './components/BasicMenu.vue'
import NotificationMenu from './components/NotificationMenu.vue'
import NotificationCard from './components/NotificationCard.vue'
import SortableList from './components/SortableList.vue'
import DirItem from './components/DirItem.vue'
import DirItemRow from './components/DirItemRow.vue'
import ContextMenus from './components/ContextMenus.vue'
import AddressBar from './components/AddressBar.vue'
import FilterField from './components/FilterField.vue'
import MediaIterator from './components/MediaIterator.vue'
import UpdatingComponent from './components/UpdatingComponent.vue'
import SectionSettings from './components/SectionSettings.vue'
import WindowEffects from './components/WindowEffects.vue'
import HomeBanner from './components/HomeBanner.vue'
import FsLocalServerManager from './components/FsLocalServerManager.vue'

// Register components
Vue.component('window-toolbar', WindowToolbar)
Vue.component('clipboard-toolbar', ClipboardToolbar)
Vue.component('navigation-panel', NavigationPanel)
Vue.component('dialogs', Dialogs)
Vue.component('dialog-generator', DialogGenerator)
Vue.component('notification-manager', NotificationManager)
Vue.component('overlays', Overlays)
Vue.component('workspaces-menu', WorkspacesMenu)
Vue.component('tabs-menu', TabsMenu)
Vue.component('basic-menu', BasicMenu)
Vue.component('notification-menu', NotificationMenu)
Vue.component('notification-card', NotificationCard)
Vue.component('sortable-list', SortableList)
Vue.component('dir-item', DirItem)
Vue.component('dir-item-row', DirItemRow)
Vue.component('context-menus', ContextMenus)
Vue.component('address-bar', AddressBar)
Vue.component('filter-field', FilterField)
Vue.component('media-iterator', MediaIterator)
Vue.component('updating-component', UpdatingComponent)
Vue.component('section-settings', SectionSettings)
Vue.component('window-effects', WindowEffects)
Vue.component('home-banner', HomeBanner)
Vue.component('fs-local-server-manager', FsLocalServerManager)

require('overlayscrollbars/css/OverlayScrollbars.css')
require('@mdi/font/css/materialdesignicons.css')
require('@fortawesome/fontawesome-free/css/all.css')

Vue.prototype.$utils = utils
Vue.prototype.$sharedUtils = sharedUtils
Vue.prototype.$storeUtils = storeUtils
Vue.prototype.$eventHub = eventHub
Vue.config.productionTip = true
Vue.config.devtools = false

function execDevTasks () {
  if (process.env.NODE_ENV === 'development') {
    require('./appendLicense.js')
    require('./devUtils/syncLocalization.js')
  }
}
execDevTasks()

Vue.use(OverlayScrollbarsPlugin)

new Vue({
  i18n,
  router,
  store,
  vuetify,
  render: h => h(App),
  mounted () {
    // Fix for blank screen in production builds
    this.$router.push('/').catch((error) => {})
  },
}).$mount('#app')
