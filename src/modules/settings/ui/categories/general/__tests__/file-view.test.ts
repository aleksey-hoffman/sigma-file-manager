// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 这组测试盯的是「文件视图」分组里列表缩略图开关（上游 #231）的三个最容易回归的点：
//
// 1. **开关必须真的被渲染**：navigator.showListThumbnails 有默认值、有迁移、列表视图也真的消费它，
//    但没有 UI 开关时用户根本关不掉它——而且不会有任何报错，连 npm run ts 都拦不住。
//    所以这里数开关个数，并断言第 4 行里确实有 Switch 控件。
// 2. **写回的 key 不能拼错**：写错同样不会让类型检查报错，只会让这次拨动静默不生效。
//    用 toHaveBeenCalledExactlyOnceWith 把实际传入的 key 钉死。
// 3. **位置**：设计文档要求它排在「文件夹排在文件之前」之后，即文件视图分组的第 4 行。

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type * as VueI18nModule from 'vue-i18n';
import { flushPromises, mount } from '@vue/test-utils';
import FileView from '@/modules/settings/ui/categories/general/file-view.vue';

const { userSettingsStoreMock } = vi.hoisted(() => ({
  userSettingsStoreMock: {
    userSettings: {
      navigator: {
        enableBoxSelection: true,
        increaseFileViewGaps: false,
        foldersFirst: false,
        showListThumbnails: true,
      },
    },
    set: vi.fn(async () => {}),
  },
}));

// user-settings store 直接依赖 tauri plugin-store / os / webview，单元测试里构造不出来
// （tauri feature 不含 test），所以按仓库既有做法整块 mock 掉，只保留本组件真正用到的那两个成员。
vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

// SettingsItem 的替身必须带上 nested 具名插槽：真实的 item.vue 只在 $slots.nested 存在时
// 才渲染那一块，本组件的全部开关都写在 <template #nested> 里，少了这个插槽会渲染出空壳。
vi.mock('@/modules/settings', () => ({
  SettingsItem: {
    props: ['title', 'description', 'icon'],
    template: `
      <section class="settings-view-item">
        <slot name="title-suffix" />
        <slot />
        <div v-if="$slots.nested" class="settings-view-item__nested">
          <slot name="nested" />
        </div>
      </section>
    `,
  },
}));

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof VueI18nModule>();

  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  };
});

const LIST_THUMBNAILS_LABEL = 'settings.general.fileView.showListThumbnails';
const LIST_THUMBNAILS_DESCRIPTION = 'settings.general.fileView.showListThumbnailsDescription';
const LIST_THUMBNAILS_ROW_INDEX = 3;

describe('file view settings', () => {
  beforeEach(() => {
    userSettingsStoreMock.userSettings.navigator.enableBoxSelection = true;
    userSettingsStoreMock.userSettings.navigator.increaseFileViewGaps = false;
    userSettingsStoreMock.userSettings.navigator.foldersFirst = false;
    userSettingsStoreMock.userSettings.navigator.showListThumbnails = true;
    userSettingsStoreMock.set.mockClear();
  });

  it('places the list thumbnails row after folders first', () => {
    const wrapper = mount(FileView);
    const rows = wrapper.findAll('.file-view-settings__row');

    expect(rows, '文件视图分组应当有 4 行开关').toHaveLength(4);

    // 位置要求来自设计文档：排在「文件夹排在文件之前」之后。
    expect(rows[2].text()).toContain('settings.general.fileView.foldersFirst');
    expect(rows[LIST_THUMBNAILS_ROW_INDEX].text(), '列表缩略图开关应当排在第 4 行')
      .toContain(LIST_THUMBNAILS_LABEL);
    expect(rows[LIST_THUMBNAILS_ROW_INDEX].text()).toContain(LIST_THUMBNAILS_DESCRIPTION);
  });

  it('renders a switch inside the list thumbnails row', () => {
    const wrapper = mount(FileView);
    const rows = wrapper.findAll('.file-view-settings__row');

    expect(rows, '文件视图分组应当有 4 行开关').toHaveLength(4);
    expect(
      rows[LIST_THUMBNAILS_ROW_INDEX].find('[role="switch"]').exists(),
      '列表缩略图这一行应当有一个 Switch 控件',
    ).toBe(true);
    expect(
      wrapper.findAll('[role="switch"]'),
      '文件视图分组共 4 个开关：框选 / 间距 / 文件夹优先 / 列表缩略图',
    ).toHaveLength(4);
  });

  it('reflects the current navigator.showListThumbnails value', () => {
    userSettingsStoreMock.userSettings.navigator.showListThumbnails = true;
    const enabledSwitches = mount(FileView).findAll('[role="switch"]');

    expect(enabledSwitches, '文件视图分组共 4 个开关').toHaveLength(4);
    expect(enabledSwitches[LIST_THUMBNAILS_ROW_INDEX].attributes('data-state'))
      .toBe('checked');

    userSettingsStoreMock.userSettings.navigator.showListThumbnails = false;
    const disabledSwitches = mount(FileView).findAll('[role="switch"]');

    expect(disabledSwitches, '文件视图分组共 4 个开关').toHaveLength(4);
    expect(disabledSwitches[LIST_THUMBNAILS_ROW_INDEX].attributes('data-state'))
      .toBe('unchecked');
  });

  it('writes the toggled value back to navigator.showListThumbnails', async () => {
    userSettingsStoreMock.userSettings.navigator.showListThumbnails = true;

    const wrapper = mount(FileView);
    const switches = wrapper.findAll('[role="switch"]');

    expect(switches, '文件视图分组共 4 个开关').toHaveLength(4);

    await switches[LIST_THUMBNAILS_ROW_INDEX].trigger('click');
    await flushPromises();

    // 关掉开关必须写回 navigator.showListThumbnails，且 key 拼写要一字不差。
    expect(userSettingsStoreMock.set).toHaveBeenCalledExactlyOnceWith(
      'navigator.showListThumbnails',
      false,
    );
  });

  it('writes back true when the list thumbnails switch starts off', async () => {
    userSettingsStoreMock.userSettings.navigator.showListThumbnails = false;

    const wrapper = mount(FileView);
    const switches = wrapper.findAll('[role="switch"]');

    expect(switches, '文件视图分组共 4 个开关').toHaveLength(4);

    await switches[LIST_THUMBNAILS_ROW_INDEX].trigger('click');
    await flushPromises();

    expect(userSettingsStoreMock.set).toHaveBeenCalledExactlyOnceWith(
      'navigator.showListThumbnails',
      true,
    );
  });
});
