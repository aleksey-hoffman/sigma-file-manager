import { $ } from '@wdio/globals';
import {
  focusWindowThatContainsMainSidebar,
  NAV_SIDEBAR_ROOT_SELECTOR,
  waitForPathname,
} from '../helpers/main-window.js';

const SIDEBAR_ROUTE_NAMES = [
  'home',
  'navigator',
  'dashboard',
  'settings',
  'extensions',
];

const ROUTE_NAME_TO_PATHNAME = {
  home: '/',
  navigator: '/navigator',
  dashboard: '/dashboard',
  settings: '/settings',
  extensions: '/extensions',
};

describe('Navigation sidebar', () => {
  it('opens each built-in page when its sidebar control is activated', async () => {
    await focusWindowThatContainsMainSidebar();

    const sidebar = $(NAV_SIDEBAR_ROOT_SELECTOR);
    await sidebar.waitForDisplayed();

    for (const routeName of SIDEBAR_ROUTE_NAMES) {
      const navButton = $(`button.nav-sidebar-item[value="${routeName}"]`);
      await navButton.waitForClickable({ timeout: 30000 });
      await navButton.click();

      const expectedPathname = ROUTE_NAME_TO_PATHNAME[routeName];
      await waitForPathname(expectedPathname);
    }
  });
});
