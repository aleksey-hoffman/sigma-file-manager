// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FileBrowserThumbnailSizeDialog from '../file-browser-thumbnail-size-dialog.vue';

const setMock = vi.fn();

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: { locale: { value: 'en' }, t: (k: string) => k },
  },
  messages: {},
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    set: setMock,
  }),
}));

function mountDialog(props: { open?: boolean; modelValue?: 'small' | 'medium' | 'large' } = {}) {
  return mount(FileBrowserThumbnailSizeDialog, {
    props: {
      open: props.open ?? true,
      modelValue: props.modelValue ?? 'medium',
    },
    global: {
      stubs: {
        Teleport: true,
        // FORK-MODIFICATION: stub reka-ui Dialog components so slot content renders directly in tests.
        // reka-ui 默认只在 open=true 时渲染并 teleport 到 body；测试里直接 mount 不开 portal，
        // 因此 query 不到节点。Stub 后即可直接测试数据流。
        Dialog: { template: '<div><slot /></div>' },
        DialogContent: { template: '<div><slot /></div>' },
        DialogHeader: { template: '<div><slot /></div>' },
        DialogTitle: { template: '<div><slot /></div>' },
        DialogDescription: { template: '<div><slot /></div>' },
        DialogFooter: { template: '<div><slot /></div>' },
      },
    },
  });
}

describe('file-browser-thumbnail-size-dialog', () => {
  it('renders three options', () => {
    const wrapper = mountDialog();
    expect(wrapper.find('[data-test="thumbnail-size-small"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="thumbnail-size-medium"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="thumbnail-size-large"]').exists()).toBe(true);
  });

  it('marks the active option based on modelValue', () => {
    const wrapper = mountDialog({ modelValue: 'large' });
    const active = wrapper.find('.file-browser-thumbnail-size-dialog__option--active');
    expect(active.exists()).toBe(true);
    expect(active.attributes('data-test')).toBe('thumbnail-size-large');
  });

  it('emits update:modelValue and persists setting when an option is clicked', async () => {
    const wrapper = mountDialog({ modelValue: 'medium' });
    await wrapper.find('[data-test="thumbnail-size-large"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['large']]);
    expect(setMock).toHaveBeenCalledWith('navigator.thumbnailSize', 'large');
  });

  it('closes the dialog after selection', async () => {
    const wrapper = mountDialog();
    await wrapper.find('[data-test="thumbnail-size-small"]').trigger('click');
    expect(wrapper.emitted('update:open')).toEqual([[false]]);
  });
});