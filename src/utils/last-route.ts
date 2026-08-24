// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { RouteLocationNormalized } from 'vue-router';
import type { LastRoute, RestorableRouteName, StartupPage } from '@/types/user-settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const RESTORABLE_ROUTE_NAMES: readonly RestorableRouteName[] = [
  'home',
  'navigator',
  'dashboard',
  'settings',
  'extensions',
  'extension-page',
];

export type StartupRouteLocation = {
  name: RestorableRouteName;
  params?: { fullPageId: string };
};

let lastRouteAfterEachRegistered = false;

export function isRestorableRouteName(routeName: unknown): routeName is RestorableRouteName {
  return typeof routeName === 'string'
    && RESTORABLE_ROUTE_NAMES.includes(routeName as RestorableRouteName);
}

export function getLastRouteFromLocation(route: RouteLocationNormalized): LastRoute | null {
  if (!isRestorableRouteName(route.name)) {
    return null;
  }

  if (route.name === 'extension-page') {
    const fullPageId = typeof route.params.fullPageId === 'string' ? route.params.fullPageId : '';

    if (!fullPageId) {
      return null;
    }

    return {
      name: 'extension-page',
      fullPageId,
    };
  }

  return {
    name: route.name,
    fullPageId: '',
  };
}

export function getStartupRouteLocation(lastRoute: LastRoute | undefined): StartupRouteLocation | null {
  if (!isRestorableRouteName(lastRoute?.name) || lastRoute.name === 'home') {
    return null;
  }

  if (lastRoute.name === 'extension-page') {
    const fullPageId = lastRoute.fullPageId?.trim() ?? '';

    if (!fullPageId) {
      return null;
    }

    return {
      name: 'extension-page',
      params: { fullPageId },
    };
  }

  return {
    name: lastRoute.name,
  };
}

export function resolveStartupRouteLocation(
  startupPage: StartupPage,
  lastRoute: LastRoute | undefined,
): StartupRouteLocation | null {
  switch (startupPage) {
    case 'last':
      return getStartupRouteLocation(lastRoute);
    case 'home':
      return null;
    case 'dashboard':
      return { name: 'dashboard' };
    case 'navigator':
      return { name: 'navigator' };

    default: {
      const exhaustiveCheck: never = startupPage;
      return exhaustiveCheck;
    }
  }
}

function isSameLastRoute(currentRoute: LastRoute, nextRoute: LastRoute): boolean {
  return currentRoute.name === nextRoute.name && currentRoute.fullPageId === nextRoute.fullPageId;
}

export async function persistLastRoute(route: RouteLocationNormalized) {
  const nextRoute = getLastRouteFromLocation(route);

  if (!nextRoute) {
    return;
  }

  const userSettingsStore = useUserSettingsStore();
  const currentRoute = userSettingsStore.userSettings.lastRoute ?? {
    name: 'home',
    fullPageId: '',
  };

  if (isSameLastRoute(currentRoute, nextRoute)) {
    return;
  }

  await userSettingsStore.set('lastRoute', nextRoute);
}

export function startLastRoutePersistence(router: {
  afterEach: (guard: (to: RouteLocationNormalized) => unknown) => unknown;
}) {
  if (lastRouteAfterEachRegistered) {
    return;
  }

  lastRouteAfterEachRegistered = true;

  router.afterEach((to) => {
    persistLastRoute(to).catch((error) => {
      console.error('Failed to persist last route:', error);
    });
  });
}
