// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 导航栏「远程」按钮的悬停面板。
//
// 盯的是用户 2026-10-18 提的那颗**设置按钮**：点它要直接进那条连接的编辑
// 界面，而不是只落到「远程」分类让用户自己再找一次。
//
// 另外钉住一条结构约束：行主体与设置按钮是**两个并列的 button**。
// 一开始它被写成「button 里再放 button」，那样点设置会连带把外层的 click
// 一起触发 —— 等于既进了编辑界面、又把双屏开出来了。

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import RemoteNavPanel from '@/modules/nav-sidebar/components/remote-nav-panel.vue';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';

const { lazyStoreSaveMock, storageContents } = vi.hoisted(() => ({
  lazyStoreSaveMock: vi.fn(),
  storageContents: new Map<string, unknown>(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {
      await lazyStoreSaveMock();
    }

    async get<T>(key: string): Promise<T | undefined> {
      return storageContents.get(key) as T | undefined;
    }

    async set(key: string, value: unknown): Promise<void> {
      storageContents.set(key, value);
    }
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: async (command: string) => {
    if (command === 'get_startup_storage_bootstrap') {
      return {};
    }

    return undefined;
  },
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataDir: '/tmp/user-data',
      appUserDataRemoteConnectionsPath: '/tmp/user-data/user-remote-connections.json',
    },
  }),
}));

function createI18nStubPlugin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createI18n } = require('vue-i18n');
  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackWarn: false,
    missingWarn: false,
    messages: {} as Record<string, unknown>,
  });
}

function mountedPanel() {
  return mount(RemoteNavPanel, {
    global: {
      plugins: [createI18nStubPlugin()],
    },
  });
}

const CONNECTIONS = [
  {
    id: 'c1',
    name: '速豹堂',
    protocol: 'sftp' as const,
    host: '192.168.1.9',
    port: 22,
    username: 'duanyi',
    initialPath: '/',
    localPath: 'E:/website_sbt',
    proxy: {
      kind: 'direct' as const,
    },
  },
  {
    id: 'c2',
    name: '没有本地目录',
    protocol: 'ftp' as const,
    host: 'a.example.com',
    port: 21,
    username: '',
    initialPath: '/',
    proxy: {
      kind: 'direct' as const,
    },
  },
];

describe('导航栏远程悬停面板', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    lazyStoreSaveMock.mockReset();
    storageContents.clear();
    storageContents.set('connections', CONNECTIONS);
  });

  it('每条连接旁边都有一颗设置按钮，标题里带上连接名', async () => {
    const wrapper = mountedPanel();
    await flushPromises();

    const editButtons = wrapper.findAll('[data-test="remote-nav-edit"]');
    expect(editButtons).toHaveLength(2);
    expect(editButtons[0].attributes('aria-label')).toContain('速豹堂');
    expect(editButtons[1].attributes('aria-label')).toContain('没有本地目录');
  });

  it('点设置只发 edit，不会顺带把连接也打开', async () => {
    const wrapper = mountedPanel();
    await flushPromises();

    await wrapper.findAll('[data-test="remote-nav-edit"]')[1].trigger('click');
    await flushPromises();

    expect(wrapper.emitted('edit')).toHaveLength(1);
    expect(wrapper.emitted('edit')?.[0]?.[0]).toMatchObject({ id: 'c2' });
    // 双屏和编辑是两件事。一起发出去，用户点设置会莫名开出一组标签页。
    expect(wrapper.emitted('open')).toBeUndefined();
  });

  it('点行主体仍然只发 open', async () => {
    const wrapper = mountedPanel();
    await flushPromises();

    await wrapper.findAll('[data-test="remote-nav-connection"]')[0].trigger('click');
    await flushPromises();

    expect(wrapper.emitted('open')).toHaveLength(1);
    expect(wrapper.emitted('open')?.[0]?.[0]).toMatchObject({ id: 'c1' });
    expect(wrapper.emitted('edit')).toBeUndefined();
  });

  it('设置按钮与行主体不是嵌套的 button', () => {
    // 无效 HTML 之外，更要紧的是嵌套会让点设置连带触发行的 click。
    const source = readFileSync(
      resolve(process.cwd(), 'src/modules/nav-sidebar/components/remote-nav-panel.vue'),
      'utf8',
    );
    expect(source).toContain('remote-nav-panel__entry');
    expect(source).toContain('remote-nav-panel__row--open');
    // 两个 data-test 必须落在同一层的两个兄弟元素上。
    const entryOpen = source.indexOf('data-test="remote-nav-connection"');
    const entryEdit = source.indexOf('data-test="remote-nav-edit"');
    const entryClose = source.indexOf('</div>', entryEdit);
    expect(entryOpen).toBeGreaterThan(-1);
    expect(entryEdit).toBeGreaterThan(entryOpen);
    expect(entryClose).toBeGreaterThan(entryEdit);
  });

  it('双屏标记只挂在有本地目录的连接上', async () => {
    const wrapper = mountedPanel();
    await flushPromises();

    const rows = wrapper.findAll('[data-test="remote-nav-connection-row"]');
    expect(rows[0].find('[data-test="remote-nav-split-tag"]').exists()).toBe(true);
    expect(rows[1].find('[data-test="remote-nav-split-tag"]').exists()).toBe(false);
  });

  it('请求的编辑 id 会进 store，被设置页消费一次后清空', async () => {
    const store = useRemoteConnectionsStore();
    await store.init();

    store.requestRemoteEdit('c2');
    expect(store.pendingEditId).toBe('c2');
    expect(store.consumeRemoteEdit()).toBe('c2');
    expect(store.pendingEditId).toBeNull();
    expect(store.consumeRemoteEdit()).toBeNull();
  });
});
