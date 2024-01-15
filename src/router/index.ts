// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {createRouter, createWebHashHistory} from 'vue-router/dist/vue-router.esm-bundler';
import {routes} from './routes';

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

export default router;
