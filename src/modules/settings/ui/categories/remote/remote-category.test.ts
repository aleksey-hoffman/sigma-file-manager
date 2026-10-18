// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 这个测试盯的是**接线**，不是 store 逻辑（store 逻辑在
// `src/stores/storage/__tests__/remote-connections.test.ts`）。
//
// 三条不可省：
// 1. **分类真的被注册进设置页**：只建了组件、忘了在 `settingsTabs` 与
//    `categoryComponentMap` 里挂上，用户根本看不到这个页签，而两边都不会报错。
// 2. **保存走的是 store 而不是组件自建的对象**：组件里另存一份就会出现
//    「界面有、盘上无」。
// 3. **删除按钮点的是那条连接**：列表里两条同名连接时，点错一条是肉眼看不出来的。

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { flushPromises, mount } from '@vue/test-utils';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import RemoteCategory from '@/modules/settings/ui/categories/remote/index.vue';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';

const { invokeMock, lazyStoreSaveMock, storageContents } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
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
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataDir: '/tmp/user-data',
      appUserDataRemoteConnectionsPath: '/tmp/user-data/user-remote-connections.json',
    },
  }),
}));

// 整个 barrel 换成替身：`@/modules/settings` 的 index 把 pages/settings.vue 与
// nav.vue 都导出进来，会一路拖到 router，而 router 在测试环境里
// `routes is not iterable` 直接崩。与 thumbnail-cache.test.ts 同一处理。
vi.mock('@/modules/settings', () => ({
  SettingsItem: {
    props: ['title', 'description', 'icon'],
    template: `
      <section class="settings-view-item">
        <slot name="title-suffix" />
        <slot />
      </section>
    `,
  },
}));

/**
 * 把 i18n 打回键名，这样断言可以直接对键，不受翻译影响。
 *
 * 刻意**不**从 `@/stores/runtime/settings` 导入 `settingsTabs` 来断言注册 ——
 * 那个模块会把 router / workspaces 一整条依赖图拖进测试环境，
 * 在没有完整应用上下文时直接 `routes is not iterable` 崩掉。
 * 注册表是纯数据，读源码验更稳，且验的仍然是真实的那份文件。
 */
function readSource(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

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

function mountedCategory() {
  return mount(RemoteCategory, {
    global: {
      plugins: [createI18nStubPlugin()],
      stubs: {
        Select: true,
        SelectTrigger: true,
        SelectContent: true,
        SelectItem: true,
        SelectValue: true,
        Checkbox: true,
      },
    },
  });
}

describe('远程设置分类', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      // 启动引导里没有这个文件 → store 走 `loadStorageData()` 的真实读盘路径。
      // 返回 undefined 会让 `bootstrap[fileName]` 抛，init 静默失败、storage 永远是 null。
      if (command === 'get_startup_storage_bootstrap') {
        return {};
      }

      return undefined;
    });
    lazyStoreSaveMock.mockReset();
    storageContents.clear();
  });

  describe('接线', () => {
    it('页签注册进了设置页的分类表', () => {
      const source = readSource('src/stores/runtime/settings.ts');

      expect(source).toContain('name: \'remote\'');
      expect(source).toContain('labelKey: \'settingsTabs.remote\'');
    });

    it('分类组件挂到了页签映射表上', () => {
      const source = readSource('src/modules/settings/ui/view.vue');

      expect(source).toContain('RemoteCategory');
      expect(source).toMatch(/remote:\s*RemoteCategory/);
    });
  });

  it('页签指向的组件存在，能真的渲染出来', async () => {
    const wrapper = mountedCategory();
    await flushPromises();

    expect(wrapper.find('[data-test="empty"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="add"]').exists()).toBe(true);
  });

  it('已保存的连接出现在列表里，并标出「已保存密码」', async () => {
    storageContents.set('connections', [{
      id: 'c1',
      name: '备份服务器',
      protocol: 'sftp',
      host: 'sftp.example.com',
      port: 22,
      username: 'me',
      initialPath: '/',
      proxy: {
        kind: 'direct',
      },
      credentialKey: 'c1',
    }]);

    const wrapper = mountedCategory();
    await flushPromises();

    expect(wrapper.find('[data-test="empty"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="entry-c1"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="has-password"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('sftp.example.com:22');
  });

  it('删除按钮删掉的是它自己那一条', async () => {
    storageContents.set('connections', [
      {
        id: 'c1',
        name: '甲',
        protocol: 'ftp',
        host: 'a.example.com',
        port: 21,
        username: '',
        initialPath: '/',
        proxy: {
          kind: 'direct',
        },
      },
      {
        id: 'c2',
        name: '乙',
        protocol: 'ftp',
        host: 'b.example.com',
        port: 21,
        username: '',
        initialPath: '/',
        proxy: {
          kind: 'direct',
        },
      },
    ]);

    const wrapper = mountedCategory();
    await flushPromises();

    await wrapper.find('[data-test="delete-c2"]').trigger('click');
    await flushPromises();

    const remaining = storageContents.get('connections') as { id: string }[];
    expect(remaining.map(connection => connection.id)).toEqual(['c1']);
    expect(wrapper.find('[data-test="entry-c2"]').exists()).toBe(false);
    expect(wrapper.find('[data-test="entry-c1"]').exists()).toBe(true);
  });

  it('删除会顺带清掉该连接的密文', async () => {
    storageContents.set('connections', [{
      id: 'c1',
      name: '甲',
      protocol: 'ftp',
      host: 'a.example.com',
      port: 21,
      username: '',
      initialPath: '/',
      proxy: {
        kind: 'direct',
      },
      credentialKey: 'c1',
    }]);

    const wrapper = mountedCategory();
    await flushPromises();
    invokeMock.mockClear();

    await wrapper.find('[data-test="delete-c1"]').trigger('click');
    await flushPromises();

    expect(invokeMock).toHaveBeenCalledWith('remote_delete_credential', {
      key: 'c1',
    });
  });

  it('组件与 store 共用同一份连接状态，不是各存一份', async () => {
    const wrapper = mountedCategory();
    await flushPromises();

    const store = useRemoteConnectionsStore();
    await store.saveConnection({
      name: '来自 store',
      protocol: 'ftp',
      host: 'store.example.com',
      port: 21,
      username: '',
      initialPath: '/',
      localPath: '',
      proxy: {
        kind: 'direct',
      },
      password: '',
      clearPassword: false,
    });
    await flushPromises();

    expect(wrapper.find('[data-test="empty"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('来自 store');
  });
});
