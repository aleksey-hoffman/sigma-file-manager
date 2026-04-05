import { $, browser } from '@wdio/globals';

export const NAV_SIDEBAR_ROOT_SELECTOR = '[data-e2e-root="nav-sidebar"]';

export const ADDRESS_BAR_BREADCRUMBS_SELECTOR = '[data-e2e-root="address-bar-breadcrumbs"]';
export const FILE_BROWSER_LOADING_SELECTOR = '[data-e2e-root="file-browser-loading"]';
export const FILE_BROWSER_ENTRIES_SELECTOR = '[data-e2e-root="file-browser-entries"]';
export const FILE_BROWSER_EMPTY_DIRECTORY_SELECTOR = '[data-e2e-root="file-browser-empty-directory"]';

export async function focusWindowThatContainsMainSidebar() {
  await browser.waitUntil(async () => {
    const handles = await browser.getWindowHandles();
    for (const handle of handles) {
      await browser.switchToWindow(handle);
      if (await $(NAV_SIDEBAR_ROOT_SELECTOR).isExisting()) {
        return true;
      }
    }
    return false;
  }, {
    timeout: 120000,
    interval: 250,
    timeoutMsg: 'Expected a window containing the main app sidebar (not the quick-view window)',
  });
}

export async function waitForPathname(expectedPathname) {
  await browser.waitUntil(async () => {
    const pathnameFromPage = await browser.execute(
      () => window.location.pathname,
    );
    return pathnameFromPage === expectedPathname;
  }, {
    timeout: 15000,
    timeoutMsg: `Route did not become ${expectedPathname}`,
  });
}
