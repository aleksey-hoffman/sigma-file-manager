import { browser } from '@wdio/globals';
import {
  focusWindowThatContainsMainSidebar,
  getNavigatorCurrentPath,
  openNavigatorFromSidebar,
  waitForNavigatorDirectoryListing,
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
    await openNavigatorFromSidebar();
    await waitForNavigatorDirectoryListing();

    await browser.waitUntil(async () => {
      const pathValue = await getNavigatorCurrentPath();
      return looksLikeFilesystemPath(pathValue);
    }, {
      timeout: 30000,
      interval: 100,
      timeoutMsg: 'Timed out waiting for navigator address bar to show a resolved filesystem path',
    });
  });
});
