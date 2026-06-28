// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { createRouter, createWebHistory } from 'vue-router';
import { markNavigatorLayoutResetPending } from '@/modules/navigator/components/info-panel/composables/use-info-panel-layout';
import { routes, quickViewRoute, printViewRoute, extensionPageRoute } from './routes';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [...routes, extensionPageRoute, quickViewRoute, printViewRoute],
});

router.beforeEach((to, from) => {
  if (to.name === 'navigator' && from.name === 'extension-page') {
    markNavigatorLayoutResetPending();
  }
});

export default router;
