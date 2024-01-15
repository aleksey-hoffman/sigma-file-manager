// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {ref} from 'vue';
import {defineStore} from 'pinia';
import {routes} from '@/router/routes';
import {useI18n} from 'vue-i18n';

export const useViewsStore = defineStore('views', () => {
  const i18n = useI18n();

  const views = ref(routes.map(route => ({...route, nameI18n: i18n.t(`pages.${route.name}`)})));

  return {
    views
  };
});
