// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import Home from '@/pages/home';

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
    component: () => import('@/pages/navigator')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    icon: 'mdi-bookmark-multiple-outline',
    component: () => import('@/pages/dashboard')
  },
  {
    path: '/settings',
    name: 'settings',
    icon: 'carbon:settings',
    component: () => import('@/pages/settings')
  },
  {
    path: '/extensions',
    name: 'extensions',
    icon: 'mdi:view-grid-plus-outline',
    component: () => import('@/pages/extensions')
  }
];