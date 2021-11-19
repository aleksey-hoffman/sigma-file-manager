// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import './setPrototype.js'
import Vue from 'vue'
import App from './App.vue'
import router from './router'
import store from './store'
import vuetify from './plugins/vuetify'
import utils from './utils/utils'
import sharedUtils from './utils/sharedUtils'
import localizeUtils from './utils/localizeUtils'
import storeUtils from './utils/storeUtils'
import { eventHub } from './utils/eventHub'
import { OverlayScrollbarsPlugin } from 'overlayscrollbars-vue'

// Import components globally, without lazy loading
import WindowToolbar from './components/WindowToolbar.vue'
import ActionToolbar from './components/ActionToolbar.vue'
import ClipboardToolbar from './components/ClipboardToolbar.vue'
import NavigationPanel from './components/NavigationPanel.vue'
import NoteCard from './components/NoteCard.vue'
import TextEditor from './components/TextEditor.vue'
import Dialogs from './components/Dialogs.vue'
import DialogGenerator from './components/DialogGenerator.vue'
import NotificationManager from './components/NotificationManager.vue'
import Overlays from './components/Overlays.vue'
import HomeBannerMenu from './components/HomeBannerMenu.vue'
import WorkspacesMenu from './components/WorkspacesMenu.vue'
import TabsMenu from './components/TabsMenu.vue'
import BasicMenu from './components/BasicMenu.vue'
import NotificationMenu from './components/NotificationMenu.vue'
import NotificationCard from './components/NotificationCard.vue'
import SortableList from './components/SortableList.vue'
import DirItem from './components/DirItem.vue'
import DirItemRow from './components/DirItemRow.vue'
import ContextMenus from './components/ContextMenus.vue'
import BasicItemCardIterator from './components/BasicItemCardIterator.vue'
import WorkspaceAreaContent from './components/WorkspaceAreaContent.vue'
import VirtualWorkspaceAreaContent from './components/VirtualWorkspaceAreaContent.vue'
import AddressBar from './components/AddressBar.vue'
import InfoPanel from './components/InfoPanel.vue'
import GlobalSearch from './components/GlobalSearch.vue'
import FilterField from './components/FilterField.vue'
import MediaIterator from './components/MediaIterator.vue'
import DriveCardsIterator from './components/DriveCardsIterator.vue'
import UpdatingComponent from './components/UpdatingComponent.vue'
import SectionSettings from './components/SectionSettings.vue'
import WindowEffects from './components/WindowEffects.vue'
import HomeBanner from './components/HomeBanner.vue'
import FsLocalServerManager from './components/FsLocalServerManager.vue'
import ShortcutList from './components/ShortcutList.vue'
import SortingHeader from './components/SortingHeader.vue'
import SortingMenu from './components/SortingMenu.vue'
import SortingColumnMenu from './components/SortingColumnMenu.vue'

// Register components
Vue.component('window-toolbar', WindowToolbar)
Vue.component('action-toolbar', ActionToolbar)
Vue.component('clipboard-toolbar', ClipboardToolbar)
Vue.component('navigation-panel', NavigationPanel)
Vue.component('note-card', NoteCard)
Vue.component('text-editor', TextEditor)
Vue.component('dialogs', Dialogs)
Vue.component('dialog-generator', DialogGenerator)
Vue.component('notification-manager', NotificationManager)
Vue.component('overlays', Overlays)
Vue.component('home-banner-menu', HomeBannerMenu)
Vue.component('workspaces-menu', WorkspacesMenu)
Vue.component('tabs-menu', TabsMenu)
Vue.component('basic-menu', BasicMenu)
Vue.component('notification-menu', NotificationMenu)
Vue.component('notification-card', NotificationCard)
Vue.component('sortable-list', SortableList)
Vue.component('dir-item', DirItem)
Vue.component('dir-item-row', DirItemRow)
Vue.component('context-menus', ContextMenus)
Vue.component('basic-item-card-iterator', BasicItemCardIterator)
Vue.component('workspace-area-content', WorkspaceAreaContent)
Vue.component('virtual-workspace-area-content', VirtualWorkspaceAreaContent)
Vue.component('address-bar', AddressBar)
Vue.component('info-panel', InfoPanel)
Vue.component('global-search', GlobalSearch)
Vue.component('filter-field', FilterField)
Vue.component('media-iterator', MediaIterator)
Vue.component('drive-cards-iterator', DriveCardsIterator)
Vue.component('updating-component', UpdatingComponent)
Vue.component('section-settings', SectionSettings)
Vue.component('window-effects', WindowEffects)
Vue.component('home-banner', HomeBanner)
Vue.component('fs-local-server-manager', FsLocalServerManager)
Vue.component('shortcut-list', ShortcutList)
Vue.component('sorting-header', SortingHeader)
Vue.component('sorting-menu', SortingMenu)
Vue.component('sorting-column-menu', SortingColumnMenu)

const localize = require('./utils/localize')
require('overlayscrollbars/css/OverlayScrollbars.css')
require('@mdi/font/css/materialdesignicons.css')
require('@fortawesome/fontawesome-free/css/all.css')

Vue.prototype.$utils = utils
Vue.prototype.$sharedUtils = sharedUtils
Vue.prototype.$localizeUtils = localizeUtils
Vue.prototype.$storeUtils = storeUtils
Vue.prototype.$localize = localize
Vue.prototype.$eventHub = eventHub
Vue.config.productionTip = true
Vue.config.devtools = false

function appendLicense () {
  if (process.env.NODE_ENV === 'development') {
    require('./appendLicense.js')
  }
}
appendLicense()

Vue.use(OverlayScrollbarsPlugin)

new Vue({
  router,
  store,
  vuetify,
  render: h => h(App),
  mounted () {
    // Fix for blank screen in production builds
    this.$router.push('/').catch((error) => {})
  }
}).$mount('#app')
