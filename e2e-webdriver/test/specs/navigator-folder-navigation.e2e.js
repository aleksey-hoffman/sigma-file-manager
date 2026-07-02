import assert from 'node:assert/strict';
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

describe('Navigator folder navigation', () => {
  it('opens a subfolder on double-click and returns via the parent breadcrumb', async function () {
    await focusWindowThatContainsMainSidebar();
    await openNavigatorFromSidebar();
    await waitForNavigatorDirectoryListing();

    const initialPath = await getNavigatorCurrentPath();
    assert.ok(initialPath, 'Expected navigator to resolve a current directory path');

    const directoryEntries = await $$(FILE_BROWSER_DIRECTORY_ENTRY_SELECTOR);
    if (directoryEntries.length === 0) {
      this.skip();
    }

    const firstDirectoryEntry = directoryEntries[0];
    const folderPath = await firstDirectoryEntry.getAttribute('data-entry-path');
    assert.ok(folderPath, 'Expected directory entry to expose data-entry-path');

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
