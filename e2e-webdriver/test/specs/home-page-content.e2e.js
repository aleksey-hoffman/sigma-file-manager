import assert from 'node:assert/strict';
import { $, browser } from '@wdio/globals';
import {
  focusWindowThatContainsMainSidebar,
  waitForPathname,
} from '../helpers/main-window.js';

async function waitUntilHomeSectionNotLoading(loadingSelector) {
  await browser.waitUntil(async () => {
    return !(await $(loadingSelector).isExisting());
  }, {
    timeout: 120000,
    timeoutMsg: `Timed out waiting for ${loadingSelector} to disappear`,
  });
}

describe('Home page content', () => {
  it('loads user directories and drives after the home route is shown', async () => {
    await focusWindowThatContainsMainSidebar();

    const homeButton = $('button.nav-sidebar-item[value="home"]');
    await homeButton.waitForClickable({ timeout: 30000 });
    await homeButton.click();
    await waitForPathname('/');

    await waitUntilHomeSectionNotLoading('.user-directories-section__loading');
    await waitUntilHomeSectionNotLoading('.drives-section__loading');

    if (await $('.user-directories-section__error').isExisting()) {
      const message = await $('.user-directories-section__error').getText();
      throw new Error(`User directories section error: ${message}`);
    }
    if (await $('.drives-section__error').isExisting()) {
      const message = await $('.drives-section__error').getText();
      throw new Error(`Drives section error: ${message}`);
    }

    const userDirectoriesRendered =
      await $('.user-directories-section__grid').isExisting()
      || await $('.user-directories-section__empty').isExisting();
    const drivesRendered =
      await $('.drives-section__grid').isExisting()
      || await $('.drives-section__empty').isExisting();

    assert.ok(
      userDirectoriesRendered,
      'Expected user directories list or empty placeholder after load',
    );
    assert.ok(
      drivesRendered,
      'Expected drives list or empty placeholder after load',
    );
  });
});
