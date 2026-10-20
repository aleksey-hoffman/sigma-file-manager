// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20（用户附图要求）：「位置」页不显示「修改时间」列。
//
// 纯函数那一层在 `file-browser-list-columns.test.ts` 里。
// 这里验的是**接线**：当前路径变了，实际可见性要跟着变。

import { mount } from '@vue/test-utils';
import {
  defineComponent,
  nextTick,
  provide,
  ref,
  type Ref,
} from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { ListColumnVisibility } from '@/types/user-settings';

const { userSettingsStoreMock } = vi.hoisted(() => {
  const visibility: ListColumnVisibility = {
    kind: true,
    links: false,
    linkTarget: false,
    linkStatus: false,
    items: true,
    size: true,
    availableSpace: true,
    modified: true,
    created: false,
    tags: false,
  };
  return {
    userSettingsStoreMock: {
      userSettings: {
        navigator: {
          listColumnVisibility: visibility,
        },
      },
    },
  };
});

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

import { useFileBrowserListColumnVisibility } from '../use-file-browser-list-column-visibility';
import { FILE_BROWSER_CONTEXT_KEY, type FileBrowserContext } from '../use-file-browser-context';

function createHarness(currentPath: Ref<string>) {
  let visibility = {} as ReturnType<typeof useFileBrowserListColumnVisibility>;

  const Probe = defineComponent({
    setup() {
      visibility = useFileBrowserListColumnVisibility();

      return {};
    },
    template: '<div />',
  });

  const wrapper = mount(defineComponent({
    components: { Probe },
    setup() {
      provide(FILE_BROWSER_CONTEXT_KEY, {
        currentPath,
      } as unknown as FileBrowserContext);

      return {};
    },
    template: '<Probe />',
  }));

  return {
    wrapper,
    get visibility() {
      return visibility.value;
    },
  };
}

describe('useFileBrowserListColumnVisibility', () => {
  it('普通目录：日期列在，「可用空间」不在', () => {
    const harness = createHarness(ref('C:/Users'));

    expect(harness.visibility.modified).toBe(true);
    expect(harness.visibility.availableSpace).toBe(false);
    expect(harness.visibility.size).toBe(true);
  });

  it('位置页：日期列不在，「可用空间」在', () => {
    const harness = createHarness(ref('sfm://locations'));

    expect(harness.visibility.modified).toBe(false);
    expect(harness.visibility.availableSpace).toBe(true);
    expect(harness.visibility.items).toBe(true);
    expect(harness.visibility.size).toBe(true);
  });

  it('换到位置页再换回来，可见性跟着路径走', async () => {
    const currentPath = ref('C:/Users');
    const harness = createHarness(currentPath);

    expect(harness.visibility.modified).toBe(true);
    expect(harness.visibility.availableSpace).toBe(false);

    currentPath.value = 'sfm://locations';
    await nextTick();

    expect(harness.visibility.modified).toBe(false);
    expect(harness.visibility.availableSpace).toBe(true);

    currentPath.value = 'C:/Users';
    await nextTick();

    expect(harness.visibility.modified).toBe(true);
    expect(harness.visibility.availableSpace).toBe(false);
  });

  it('全局偏好本身不被改掉', () => {
    createHarness(ref('sfm://locations'));

    expect(userSettingsStoreMock.userSettings.navigator.listColumnVisibility.modified).toBe(true);
    expect(userSettingsStoreMock.userSettings.navigator.listColumnVisibility.availableSpace).toBe(true);
  });
});
