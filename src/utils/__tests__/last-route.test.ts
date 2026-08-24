// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import {
  getLastRouteFromLocation,
  getStartupRouteLocation,
  isRestorableRouteName,
  persistLastRoute,
  resolveStartupRouteLocation,
} from '@/utils/last-route';

const { userSettingsMock, userSettingsSetMock } = vi.hoisted(() => ({
  userSettingsMock: {
    lastRoute: {
      name: 'home' as 'home' | 'navigator' | 'dashboard' | 'settings' | 'extensions' | 'extension-page',
      fullPageId: '',
    },
  },
  userSettingsSetMock: vi.fn(),
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: userSettingsMock,
    set: userSettingsSetMock,
  }),
}));

function createRoute(name: string, params: Record<string, string> = {}): RouteLocationNormalized {
  return {
    name,
    params,
  } as RouteLocationNormalized;
}

describe('last-route', () => {
  it('recognizes restorable main pages', () => {
    expect(isRestorableRouteName('home')).toBe(true);
    expect(isRestorableRouteName('navigator')).toBe(true);
    expect(isRestorableRouteName('dashboard')).toBe(true);
    expect(isRestorableRouteName('settings')).toBe(true);
    expect(isRestorableRouteName('extensions')).toBe(true);
    expect(isRestorableRouteName('extension-page')).toBe(true);
    expect(isRestorableRouteName('quick-view')).toBe(false);
    expect(isRestorableRouteName('print-view')).toBe(false);
  });

  it('reads a main page from the current route', () => {
    expect(getLastRouteFromLocation(createRoute('settings'))).toEqual({
      name: 'settings',
      fullPageId: '',
    });
  });

  it('reads an extension page only when the page id is present', () => {
    expect(getLastRouteFromLocation(createRoute('extension-page'))).toBeNull();
    expect(getLastRouteFromLocation(createRoute('extension-page', { fullPageId: 'demo.ext/page' }))).toEqual({
      name: 'extension-page',
      fullPageId: 'demo.ext/page',
    });
  });

  it('ignores auxiliary window routes', () => {
    expect(getLastRouteFromLocation(createRoute('quick-view'))).toBeNull();
  });

  it('does not push a route when the last page is Home', () => {
    expect(getStartupRouteLocation({
      name: 'home',
      fullPageId: '',
    })).toBeNull();
  });

  it('returns a router location for a saved main page', () => {
    expect(getStartupRouteLocation({
      name: 'settings',
      fullPageId: '',
    })).toEqual({
      name: 'settings',
    });
  });

  it('returns a router location for a saved extension page', () => {
    expect(getStartupRouteLocation({
      name: 'extension-page',
      fullPageId: 'demo.ext/page',
    })).toEqual({
      name: 'extension-page',
      params: {
        fullPageId: 'demo.ext/page',
      },
    });
  });

  it('resolves a fixed startup page to a router location', () => {
    expect(resolveStartupRouteLocation('home', undefined)).toBeNull();
    expect(resolveStartupRouteLocation('dashboard', undefined)).toEqual({
      name: 'dashboard',
    });
    expect(resolveStartupRouteLocation('navigator', undefined)).toEqual({
      name: 'navigator',
    });
  });

  it('resolves the last-page startup option from the saved route', () => {
    expect(resolveStartupRouteLocation('last', {
      name: 'settings',
      fullPageId: '',
    })).toEqual({
      name: 'settings',
    });
  });

  it('persists a changed restorable route', async () => {
    userSettingsSetMock.mockReset().mockResolvedValue(undefined);
    userSettingsMock.lastRoute = {
      name: 'home',
      fullPageId: '',
    };

    await persistLastRoute(createRoute('settings'));

    expect(userSettingsSetMock).toHaveBeenCalledWith('lastRoute', {
      name: 'settings',
      fullPageId: '',
    });
  });

  it('does not persist the same route twice', async () => {
    userSettingsSetMock.mockReset().mockResolvedValue(undefined);
    userSettingsMock.lastRoute = {
      name: 'settings',
      fullPageId: '',
    };

    await persistLastRoute(createRoute('settings'));

    expect(userSettingsSetMock).not.toHaveBeenCalled();
  });
});
