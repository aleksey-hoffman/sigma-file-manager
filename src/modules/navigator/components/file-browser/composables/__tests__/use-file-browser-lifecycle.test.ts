// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineComponent, nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import type { Tab } from '@/types/workspaces';
import { useFileBrowserLifecycle } from '../use-file-browser-lifecycle';

function createTab(path: string): Tab {
  return {
    id: 'current-tab',
    name: path,
    path,
    type: 'directory',
    paneWidth: 100,
    filterQuery: '',
    dirEntries: [],
    selectedDirEntries: [],
  };
}

describe('useFileBrowserLifecycle', () => {
  it('reloads when the current tab path changes outside the file browser', async () => {
    const currentPath = ref('C:/Users/aleks/Projects');
    const tabRef = ref<Tab | undefined>(createTab('C:/Users/aleks/Projects'));
    const readDir = vi.fn();
    const init = vi.fn();

    mount(defineComponent({
      setup() {
        useFileBrowserLifecycle({
          tabRef,
          currentPath,
          readDir,
          init,
        });
        return {};
      },
      template: '<div />',
    }));

    tabRef.value = createTab('D:/');
    await nextTick();

    expect(readDir).toHaveBeenCalledWith('D:/', false);
  });

  it('records external current-tab navigation in history when requested', async () => {
    const currentPath = ref('C:/Users/aleks/Projects');
    const tabRef = ref<Tab | undefined>(createTab('C:/Users/aleks/Projects'));
    const readDir = vi.fn();
    const init = vi.fn();
    const shouldAddExternalPathToHistory = vi.fn().mockReturnValue(true);

    mount(defineComponent({
      setup() {
        useFileBrowserLifecycle({
          tabRef,
          currentPath,
          readDir,
          init,
          shouldAddExternalPathToHistory,
        });
        return {};
      },
      template: '<div />',
    }));

    tabRef.value = createTab('D:/');
    await nextTick();

    expect(shouldAddExternalPathToHistory).toHaveBeenCalledWith('current-tab', 'D:/');
    expect(readDir).toHaveBeenCalledWith('D:/', true);
  });

  it('does not reload when readDir already synchronized the current path', async () => {
    const currentPath = ref('D:/');
    const tabRef = ref<Tab | undefined>(createTab('C:/Users/aleks/Projects'));
    const readDir = vi.fn();
    const init = vi.fn();

    mount(defineComponent({
      setup() {
        useFileBrowserLifecycle({
          tabRef,
          currentPath,
          readDir,
          init,
        });
        return {};
      },
      template: '<div />',
    }));

    tabRef.value = createTab('D:/');
    await nextTick();

    expect(readDir).not.toHaveBeenCalled();
  });
});
