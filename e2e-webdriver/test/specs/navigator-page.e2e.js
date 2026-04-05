import assert from 'node:assert/strict';
import { $, browser } from '@wdio/globals';
import {
  ADDRESS_BAR_BREADCRUMBS_SELECTOR,
  FILE_BROWSER_EMPTY_DIRECTORY_SELECTOR,
  FILE_BROWSER_ENTRIES_SELECTOR,
  FILE_BROWSER_LOADING_SELECTOR,
  focusWindowThatContainsMainSidebar,
  waitForPathname,
} from '../helpers/main-window.js';

function looksLikeFilesystemPath(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  const trimmed = path.trim();
  if (trimmed.length < 2) {
    return false;
  }
  if (/^[\\/]{2}/.test(trimmed)) {
    return true;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed)) {
    return true;
  }
  if (trimmed.startsWith('/')) {
    return true;
  }
  return false;
}

describe('Navigator page', () => {
  it('opens on a real folder and shows a directory listing or empty state', async () => {
    await focusWindowThatContainsMainSidebar();

    const navigatorButton = $('button.nav-sidebar-item[value="navigator"]');
    await navigatorButton.waitForClickable({ timeout: 30000 });
    await navigatorButton.click();
    await waitForPathname('/navigator');

    const breadcrumbs = $(ADDRESS_BAR_BREADCRUMBS_SELECTOR);
    await breadcrumbs.waitForDisplayed({ timeout: 30000 });

    await browser.waitUntil(async () => {
      const pathValue = await breadcrumbs.getAttribute('data-e2e-current-path');
      return looksLikeFilesystemPath(pathValue);
    }, {
      timeout: 30000,
      interval: 100,
      timeoutMsg: 'Timed out waiting for navigator address bar to show a resolved filesystem path',
    });

    await browser.waitUntil(async () => {
      return !(await $(FILE_BROWSER_LOADING_SELECTOR).isExisting());
    }, {
      timeout: 120000,
      timeoutMsg: 'Timed out waiting for navigator directory content to finish loading',
    });

    const hasEntryList = await $(FILE_BROWSER_ENTRIES_SELECTOR).isExisting();
    const hasEmptyDirectoryState = await $(FILE_BROWSER_EMPTY_DIRECTORY_SELECTOR).isExisting();

    assert.ok(
      hasEntryList || hasEmptyDirectoryState,
      'Expected file list or empty directory state after load',
    );
  });
});
