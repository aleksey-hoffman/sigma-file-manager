import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $, $$, browser } from '@wdio/globals';
import {
  focusWindowThatContainsMainSidebar,
  waitForPathname,
} from '../helpers/main-window.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const EXTENSION_ID = 'sfm-e2e.main-flow';
const EXTENSION_NAME = 'E2E Main Flow';
const EXTENSION_SOURCE_PATH = path.resolve(__dirname, '..', 'fixtures', 'extensions', 'e2e-main-flow');
const RESULT_PREFIX = 'sfm-e2e-main-flow';
const PERMITTED_CALL_RESULT = `${RESULT_PREFIX}: permitted call ok`;
const DENIED_CALL_RESULT = `${RESULT_PREFIX}: denied call rejected: Permission denied: shell`;
const DENIED_CALL_UNEXPECTED_RESULT = `${RESULT_PREFIX}: denied call unexpectedly allowed`;

const INSTALLED_ITEM_SELECTOR = '.extensions-installed__item';

// The native folder picker behind "Install extension from folder" cannot be
// driven over WebDriver, so the test hands the folder path to the same store
// action the picker feeds. Everything after that (install, activation, the
// extension's API calls, disable/enable and uninstall) runs through the real
// app, and the UI steps are driven with clicks.
async function callExtensionsStore(methodName, ...methodArguments) {
  return browser.execute(async (name, args) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const extensionsStore = pinia._s.get('extensions');
    if (!extensionsStore) {
      throw new Error('Extensions store is not initialized');
    }
    await extensionsStore[name](...args);
    return true;
  }, methodName, methodArguments);
}

async function getExtensionState() {
  return browser.execute((extensionId) => {
    const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
    const extensionsStore = pinia._s.get('extensions');
    const installed = extensionsStore?.installedExtensions?.find(extension => extension.id === extensionId);
    return {
      isStoreReady: Boolean(extensionsStore?.isInitialized),
      isInstalled: Boolean(installed),
      isEnabled: Boolean(installed?.enabled),
      isLoaded: Boolean(extensionsStore?.loadedExtensions?.has(extensionId)),
    };
  }, EXTENSION_ID);
}

async function waitForExtensionState(expectedState, timeoutMsg) {
  await browser.waitUntil(async () => {
    const state = await getExtensionState();
    return Object.entries(expectedState).every(([key, value]) => state[key] === value);
  }, {
    timeout: 30000,
    interval: 200,
    timeoutMsg,
  });
}

async function countToastsWithText(text) {
  return browser.execute((expectedText) => {
    return [...document.querySelectorAll('[data-sonner-toast]')]
      .filter(toastElement => toastElement.textContent?.includes(expectedText))
      .length;
  }, text);
}

async function waitForToastCount(text, minimumCount) {
  await browser.waitUntil(async () => (await countToastsWithText(text)) >= minimumCount, {
    timeout: 30000,
    interval: 200,
    timeoutMsg: `Expected at least ${minimumCount} notification(s) containing "${text}"`,
  });
}

// Notifications from the test extension sit over the installed list, and a
// hovered toaster pauses its timers, so move the pointer away and wait for
// them to expire before clicking controls underneath.
async function waitForExtensionToastsToClear() {
  await browser.action('pointer')
    .move({ x: 300, y: 120, origin: 'viewport' })
    .perform();
  await browser.waitUntil(async () => (await countToastsWithText(RESULT_PREFIX)) === 0, {
    timeout: 30000,
    interval: 200,
    timeoutMsg: 'Expected the test extension notifications to expire',
  });
}

async function findInstalledItem() {
  const items = await $$(INSTALLED_ITEM_SELECTOR);
  for (const item of items) {
    const nameElement = await item.$('.extensions-installed__item-name');
    if (await nameElement.isExisting() && (await nameElement.getText()).trim() === EXTENSION_NAME) {
      return item;
    }
  }
  return null;
}

async function waitForInstalledItem() {
  let foundItem = null;
  await browser.waitUntil(async () => {
    foundItem = await findInstalledItem();
    return foundItem !== null;
  }, {
    timeout: 30000,
    interval: 200,
    timeoutMsg: `Expected "${EXTENSION_NAME}" in the installed extensions list`,
  });
  return foundItem;
}

async function clickEnableSwitch() {
  const item = await waitForInstalledItem();
  const enableSwitch = await item.$('.extensions-installed__enable-switch .sigma-ui-switch');
  await enableSwitch.waitForClickable({ timeout: 30000 });
  await enableSwitch.click();
}

async function openInstalledExtensionsTab() {
  await focusWindowThatContainsMainSidebar();

  const extensionsButton = $('button.nav-sidebar-item[value="extensions"]');
  await extensionsButton.waitForClickable({ timeout: 30000 });
  await extensionsButton.click();
  await waitForPathname('/extensions');

  const installedTab = $('.extensions-page__tab-trigger[id$="-trigger-installed"]');
  await installedTab.waitForClickable({ timeout: 30000 });
  await installedTab.click();
  await browser.waitUntil(async () => (await installedTab.getAttribute('data-state')) === 'active', {
    timeout: 15000,
    timeoutMsg: 'Installed extensions tab did not become active',
  });

  await browser.waitUntil(async () => (await getExtensionState()).isStoreReady, {
    timeout: 60000,
    interval: 200,
    timeoutMsg: 'Extensions store did not finish initializing',
  });
}

describe('Extension main flow', () => {
  before(async () => {
    await openInstalledExtensionsTab();

    // Each run starts from an empty isolated data folder (see wdio.conf.js),
    // so nothing can be left over from an earlier run.
    assert.equal((await getExtensionState()).isInstalled, false, 'Expected a fresh profile without the test extension');
  });

  it('installs a local extension from a folder and activates it', async () => {
    await callExtensionsStore('installLocalExtension', EXTENSION_SOURCE_PATH);

    await waitForInstalledItem();
    await waitForExtensionState(
      { isInstalled: true, isEnabled: true, isLoaded: true },
      'Expected the local extension to be installed, enabled and loaded',
    );
  });

  it('allows an API call covered by a declared permission', async () => {
    await waitForToastCount(PERMITTED_CALL_RESULT, 1);
  });

  it('denies an API call without the required permission', async () => {
    await waitForToastCount(DENIED_CALL_RESULT, 1);
    assert.equal(
      await countToastsWithText(DENIED_CALL_UNEXPECTED_RESULT),
      0,
      'A shell call from an extension without the shell permission must be rejected',
    );
  });

  it('unloads the extension when disabled and reactivates it when enabled', async () => {
    await waitForExtensionToastsToClear();

    await clickEnableSwitch();
    await waitForExtensionState(
      { isInstalled: true, isEnabled: false, isLoaded: false },
      'Expected the extension to be disabled and unloaded',
    );
    await browser.waitUntil(async () => {
      const item = await findInstalledItem();
      return Boolean(item) && (await item.getAttribute('class')).includes('extensions-installed__item--disabled');
    }, {
      timeout: 15000,
      timeoutMsg: 'Expected the installed list item to show the disabled state',
    });

    await clickEnableSwitch();
    await waitForExtensionState(
      { isInstalled: true, isEnabled: true, isLoaded: true },
      'Expected the extension to be enabled and loaded again',
    );
    await waitForToastCount(PERMITTED_CALL_RESULT, 1);
  });

  it('uninstalls the extension', async () => {
    await waitForExtensionToastsToClear();

    const item = await waitForInstalledItem();
    const uninstallButton = await item.$('.extensions-installed__item-actions-dynamic-container > button:last-of-type');
    await uninstallButton.waitForClickable({ timeout: 30000 });
    await uninstallButton.click();

    await waitForExtensionState(
      { isInstalled: false, isLoaded: false },
      'Expected the extension to be uninstalled and unloaded',
    );
    await browser.waitUntil(async () => (await findInstalledItem()) === null, {
      timeout: 15000,
      timeoutMsg: `Expected "${EXTENSION_NAME}" to be removed from the installed extensions list`,
    });

    const installedOnDisk = await browser.execute(async () => {
      return window.__TAURI_INTERNALS__.invoke('get_installed_extensions');
    });
    assert.ok(
      !installedOnDisk.some(extension => extension.id === EXTENSION_ID),
      'Expected the extension folder to be removed from disk',
    );
  });
});
