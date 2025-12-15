// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { routes } from '@/router/routes';
import { defineStore } from 'pinia';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

export const useAppStore = defineStore('app', () => {
  const i18n = useI18n();

  const pages = computed(() => routes.map((route) => {
    return {
      ...route,
      title: i18n.t(`pages.${String(route.name)}`),
    };
  }));

  return {
    pages,
  };
});
