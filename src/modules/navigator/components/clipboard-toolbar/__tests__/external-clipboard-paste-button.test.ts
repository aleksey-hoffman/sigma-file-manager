// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  enableAutoUnmount,
  flushPromises,
  mount,
} from '@vue/test-utils';
import ExternalClipboardPasteButton from '../external-clipboard-paste-button.vue';
import type { ExternalClipboardPasteTarget } from '../external-clipboard-context';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {},
  }),
}));

const splitViewTargets: ExternalClipboardPasteTarget[] = [
  {
    paneIndex: 0,
    path: 'C:/Left',
  },
  {
    paneIndex: 1,
    path: 'C:/Right',
  },
];

function mountPasteButton(targets: ExternalClipboardPasteTarget[], canPasteTo: (target: ExternalClipboardPasteTarget) => boolean = () => true) {
  return mount(ExternalClipboardPasteButton, {
    attachTo: document.body,
    props: {
      targets,
      canPasteTo,
    },
  });
}

async function openPaneMenu(wrapper: ReturnType<typeof mountPasteButton>) {
  await wrapper.find('.external-clipboard-paste-button').trigger('click');
  await flushPromises();
}

function getMenuItems() {
  return Array.from(document.body.querySelectorAll<HTMLElement>('.external-clipboard-paste-menu__item'));
}

enableAutoUnmount(afterEach);

describe('external clipboard paste button', () => {
  it('pastes into the only target when split view is off', async () => {
    const wrapper = mountPasteButton([{
      paneIndex: null,
      path: 'C:/Target',
    }]);
    const pasteButton = wrapper.find('.external-clipboard-paste-button');

    expect(pasteButton.text()).toBe('fileBrowser.actions.paste');
    expect(pasteButton.find('.external-clipboard-paste-button__chevron').exists()).toBe(false);

    await pasteButton.trigger('click');

    expect(wrapper.emitted('paste')).toEqual([[{
      paneIndex: null,
      path: 'C:/Target',
    }]]);
  });

  it('disables the single paste button when the target cannot take the paste', () => {
    const wrapper = mountPasteButton([{
      paneIndex: null,
      path: 'C:/Target',
    }], () => false);

    expect(wrapper.find('.external-clipboard-paste-button').attributes('disabled')).toBeDefined();
  });

  it('shows a chevron in split view and picks the pane from a dropdown', async () => {
    const wrapper = mountPasteButton(splitViewTargets);
    const pasteButton = wrapper.find('.external-clipboard-paste-button');

    expect(pasteButton.text()).toBe('fileBrowser.actions.paste');
    expect(pasteButton.find('.external-clipboard-paste-button__chevron').exists()).toBe(true);
    expect(getMenuItems()).toHaveLength(0);

    await openPaneMenu(wrapper);

    expect(wrapper.emitted('update:menuOpen')).toEqual([[true]]);
    expect(getMenuItems().map(item => item.querySelector('.external-clipboard-paste-menu__item-label')?.textContent?.trim())).toEqual([
      'fileBrowser.actions.pasteToPane1',
      'fileBrowser.actions.pasteToPane2',
    ]);
    expect(getMenuItems().map(item => item.querySelector('.external-clipboard-paste-menu__item-folder')?.textContent?.trim())).toEqual([
      'Left',
      'Right',
    ]);

    getMenuItems()[1].click();
    await flushPromises();

    expect(wrapper.emitted('paste')).toEqual([[splitViewTargets[1]]]);
    expect(wrapper.emitted('update:menuOpen')?.at(-1)).toEqual([false]);
  });

  it('disables a pane the clipboard cannot be pasted into', async () => {
    const wrapper = mountPasteButton(splitViewTargets, target => target.paneIndex === 1);

    await openPaneMenu(wrapper);

    expect(getMenuItems()[0].hasAttribute('data-disabled')).toBe(true);
    expect(getMenuItems()[1].hasAttribute('data-disabled')).toBe(false);
  });

  it('disables the split paste button when no pane can take the paste', () => {
    const wrapper = mountPasteButton(splitViewTargets, () => false);

    expect(wrapper.find('.external-clipboard-paste-button').attributes('disabled')).toBeDefined();
  });
});
