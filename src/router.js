// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import Vue from 'vue'
import VueRouter from 'vue-router'

// Import views without lazy loading
import Home from './views/Home.vue'

Vue.use(VueRouter)

const routes = [
  {
    path: '/',
    name: 'home',
    component: Home
  },
  // Import views with lazy loading
  {
    path: '/navigator',
    name: 'navigator',
    component: () => import(
      /* webpackChunkName: "lazy-loaded-navigator" */
      './views/Navigator.vue'
    )
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import(
      /* webpackChunkName: "lazy-loaded-dashboard" */
      './views/Dashboard.vue'
    )
  },
  {
    path: '/notes',
    name: 'notes',
    component: () => import(
      /* webpackChunkName: "lazy-loaded-notes" */
      './views/Notes.vue'
    )
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import(
      /* webpackChunkName: "lazy-loaded-settings" */
      './views/Settings.vue'
    )
  }
]

const router = new VueRouter({
  mode: process.env.IS_ELECTRON ? 'hash' : 'history',
  base: process.env.BASE_URL,
  routes
})

export default router
