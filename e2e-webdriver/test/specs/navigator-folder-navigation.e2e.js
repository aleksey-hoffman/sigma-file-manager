import assert from 'node:assert/strict';
import fs from 'node:fs';
import { $, browser } from '@wdio/globals';
import {
  ADDRESS_BAR_PARENT_BREADCRUMB_SELECTOR,
  FILE_BROWSER_DIRECTORY_ENTRY_SELECTOR,
  focusWindowThatContainsMainSidebar,
  getNavigatorCurrentPath,
  openNavigatorFromSidebar,
  waitForNavigatorCurrentPath,
  waitForNavigatorCurrentPathChange,
  waitForNavigatorDirectoryListing,
} from '../helpers/main-window.js';

function isListableDirectory(directoryPath) {
  try {
    fs.readdirSync(directoryPath);
    return true;
  }
  catch {
    return false;
  }
}

describe('Navigator folder navigation', () => {
  it('opens a subfolder on double-click and returns via the parent breadcrumb', async function () {
    await focusWindowThatContainsMainSidebar();
    await openNavigatorFromSidebar();
    await waitForNavigatorDirectoryListing();

    const initialPath = await getNavigatorCurrentPath();
    assert.ok(initialPath, 'Expected navigator to resolve a current directory path');

    // Skip entries the current user cannot list, such as the legacy
    // "Application Data" junction in a Windows profile folder: opening those
    // correctly shows an access error instead of navigating.
    let firstDirectoryEntry;
    let folderPath;
    for (const directoryEntry of await $$(FILE_BROWSER_DIRECTORY_ENTRY_SELECTOR)) {
      const entryPath = await directoryEntry.getAttribute('data-entry-path');
      if (entryPath && isListableDirectory(entryPath)) {
        firstDirectoryEntry = directoryEntry;
        folderPath = entryPath;
        break;
      }
    }

    if (!firstDirectoryEntry) {
      this.skip();
    }

    await firstDirectoryEntry.doubleClick();
    await waitForNavigatorCurrentPathChange(initialPath);
    await waitForNavigatorDirectoryListing();

    const openedPath = await getNavigatorCurrentPath();
    assert.equal(openedPath, folderPath);

    const parentBreadcrumbs = await $$(ADDRESS_BAR_PARENT_BREADCRUMB_SELECTOR);
    assert.ok(parentBreadcrumbs.length > 0, 'Expected a parent breadcrumb for back navigation');

    const immediateParentBreadcrumb = parentBreadcrumbs[parentBreadcrumbs.length - 1];
    await immediateParentBreadcrumb.waitForClickable({ timeout: 30000 });
    await immediateParentBreadcrumb.click();

    await waitForNavigatorCurrentPath(initialPath);
    await waitForNavigatorDirectoryListing();

    const returnedPath = await getNavigatorCurrentPath();
    assert.equal(returnedPath, initialPath);
  });
});
