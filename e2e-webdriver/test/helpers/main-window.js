import { $, browser } from '@wdio/globals';

export const NAV_SIDEBAR_ROOT_SELECTOR = '[data-e2e-root="nav-sidebar"]';

export const ADDRESS_BAR_BREADCRUMBS_SELECTOR = '[data-e2e-root="address-bar-breadcrumbs"]';
export const FILE_BROWSER_LOADING_SELECTOR = '[data-e2e-root="file-browser-loading"]';
export const FILE_BROWSER_ENTRIES_SELECTOR = '[data-e2e-root="file-browser-entries"]';
export const FILE_BROWSER_EMPTY_DIRECTORY_SELECTOR = '[data-e2e-root="file-browser-empty-directory"]';
export const FILE_BROWSER_DIRECTORY_ENTRY_SELECTOR = '.file-browser-list-view__entry--dir[data-entry-path]';
export const ADDRESS_BAR_PARENT_BREADCRUMB_SELECTOR = '.address-bar__part:not(.address-bar__part--last)';

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

export async function openNavigatorFromSidebar() {
  const navigatorButton = $('button.nav-sidebar-item[value="navigator"]');
  await navigatorButton.waitForClickable({ timeout: 30000 });
  await navigatorButton.click();
  await waitForPathname('/navigator');
}

export async function waitForNavigatorDirectoryListing() {
  const breadcrumbs = $(ADDRESS_BAR_BREADCRUMBS_SELECTOR);
  await breadcrumbs.waitForDisplayed({ timeout: 30000 });

  await browser.waitUntil(async () => {
    return !(await $(FILE_BROWSER_LOADING_SELECTOR).isExisting());
  }, {
    timeout: 120000,
    timeoutMsg: 'Timed out waiting for navigator directory content to finish loading',
  });

  const hasEntryList = await $(FILE_BROWSER_ENTRIES_SELECTOR).isExisting();
  const hasEmptyDirectoryState = await $(FILE_BROWSER_EMPTY_DIRECTORY_SELECTOR).isExisting();

  if (!hasEntryList && !hasEmptyDirectoryState) {
    throw new Error('Expected file list or empty directory state after navigator load');
  }
}

export async function getNavigatorCurrentPath() {
  return $(ADDRESS_BAR_BREADCRUMBS_SELECTOR).getAttribute('data-e2e-current-path');
}

export async function waitForNavigatorCurrentPath(expectedPath) {
  await browser.waitUntil(async () => {
    const currentPath = await getNavigatorCurrentPath();
    return currentPath === expectedPath;
  }, {
    timeout: 30000,
    interval: 100,
    timeoutMsg: `Timed out waiting for navigator path to become ${expectedPath}`,
  });
}

export async function waitForNavigatorCurrentPathChange(previousPath) {
  await browser.waitUntil(async () => {
    const currentPath = await getNavigatorCurrentPath();
    return Boolean(currentPath) && currentPath !== previousPath;
  }, {
    timeout: 30000,
    interval: 100,
    timeoutMsg: `Timed out waiting for navigator path to change from ${previousPath}`,
  });
}
