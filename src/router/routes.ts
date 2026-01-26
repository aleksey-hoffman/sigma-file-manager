// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import HomePage from '@/modules/home/pages/home.vue';
import {
  BlocksIcon, FolderClosedIcon, HomeIcon, LayoutDashboardIcon, SettingsIcon, XIcon,
} from 'lucide-vue-next';
import type { RouteRecordRaw } from 'vue-router';

export const quickViewRoute: RouteRecordRaw = {
  path: '/quick-view',
  name: 'quick-view',
  component: () => import('@/modules/quick-view/pages/quick-view.vue'),
  meta: { layout: 'quick-view' },
};

export const routes: Array<RouteRecordRaw & { icon: typeof XIcon }> = [
  {
    path: '/',
    name: 'home',
    icon: HomeIcon,
    component: HomePage,
  },
  {
    path: '/navigator',
    name: 'navigator',
    icon: FolderClosedIcon,
    component: () => import('@/modules/navigator/pages/navigator.vue'),
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    icon: LayoutDashboardIcon,
    component: () => import('@/modules/dashboard/pages/dashboard.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    icon: SettingsIcon,
    component: () => import('@/modules/settings/pages/settings.vue'),
  },
  {
    path: '/extensions',
    name: 'extensions',
    icon: BlocksIcon,
    component: () => import('@/modules/extensions/pages/extensions.vue'),
  },
];
