// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import Home from '@/pages/Home.vue';

export const routes = [
  {
    path: '/',
    name: 'home',
    icon: 'material-symbols:grid-on-sharp',
    component: Home
  },
  {
    path: '/navigator',
    name: 'navigator',
    icon: 'material-symbols:folder-outline-rounded',
    component: () => import('@/pages/Navigator.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    icon: 'mdi-bookmark-multiple-outline',
    component: () => import('@/pages/Dashboard.vue')
  },
  {
    path: '/settings',
    name: 'settings',
    icon: 'carbon:settings',
    component: () => import('@/pages/Settings.vue')
  },
  {
    path: '/extensions',
    name: 'extensions',
    icon: 'mdi:view-grid-plus-outline',
    component: () => import('@/pages/Extensions.vue')
  }
];