// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';
import type { RemoteConnection, RemoteConnectionForm } from '@/types/remote';

/**
 * 存储桩带一个**真实的** map，并且把内容交给测试去读。
 *
 * 只断言 `store.connections` 抓不到落盘缺陷 —— 本项目已经因为
 * 「内存里对、盘上是 undefined」吃过一次亏，返工代价是整轮验收。
 */
const {
  lazyStoreSaveMock,
  storageContents,
} = vi.hoisted(() => ({
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

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataDir: '/tmp/user-data',
      appUserDataRemoteConnectionsPath: '/tmp/user-data/user-remote-connections.json',
    },
  }),
}));

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

function form(overrides: Partial<RemoteConnectionForm> = {}): RemoteConnectionForm {
  return {
    name: '备份服务器',
    protocol: 'ftp',
    host: 'ftp.example.com',
    port: 21,
    username: 'anonymous',
    initialPath: '/pub',
    localPath: '',
    proxy: {
      kind: 'direct',
    },
    password: '',
    clearPassword: false,
    ...overrides,
  };
}

/** 从存储桩里读回真正落盘的那份记录。 */
function storedConnections(): RemoteConnection[] {
  return (storageContents.get('connections') as RemoteConnection[]) ?? [];
}

describe('remote connections storage', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    lazyStoreSaveMock.mockReset();
    storageContents.clear();
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command: string) => {
      // 启动引导里**没有**这个文件 → store 走 `loadStorageData()` 的真实读盘路径。
      // 刻意不走 bootstrap 快路径：快路径会跳过读盘，那样「重启后读回」这条测的就不是磁盘了。
      if (command === 'get_startup_storage_bootstrap') {
        return {};
      }

      return undefined;
    });
  });

  describe('落盘往返', () => {
    it('真正把连接写进 storage 文件，而不只是内存状态', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      const saved = await store.saveConnection(form({ password: 'secret' }));

      expect(storedConnections()).toEqual([saved]);
      expect(storageContents.has('connections')).toBe(true);
    });

    it('落盘的记录里只有 credentialKey，绝不含密码', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      await store.saveConnection(form({ password: 'PlainTextSecret' }));

      const onDisk = JSON.stringify(storedConnections());
      expect(onDisk).not.toContain('PlainTextSecret');
      expect(onDisk).toContain('"credentialKey"');
    });

    it('没有密码的连接不带 credentialKey 字段', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      const saved = await store.saveConnection(form());

      expect(saved.credentialKey).toBeUndefined();
      expect(JSON.stringify(storedConnections())).not.toContain('credentialKey');
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it('重启后从 storage 读回同一批连接', async () => {
      const first = useRemoteConnectionsStore();
      await first.init();
      await first.saveConnection(form({ name: 'A' }));
      await first.saveConnection(form({
        name: 'B',
        port: 2121,
      }));

      // 模拟重启：全新的 pinia + 同样的 storage 桩
      setActivePinia(createPinia());
      const second = useRemoteConnectionsStore();
      await second.init();

      expect(second.connections.map(connection => connection.name)).toEqual(['A', 'B']);
    });
  });

  describe('写顺序：密文先行', () => {
    /**
     * 这是本 store 最要紧的一条。
     *
     * 如果先写 storage 再写密文，密文失败时会留下一条 `credentialKey`
     * 指向不存在数据的连接 —— 界面显示「已保存密码」，连上去必然认证失败，
     * 而且没有任何报错可查。
     */
    it('DPAPI 写失败时不碰 storage，也不留下内存里的连接', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      invokeMock.mockRejectedValue({
        kind: 'auth',
        message: 'DPAPI 加密失败',
      });

      await expect(store.saveConnection(form({ password: 'secret' }))).rejects.toBeTruthy();

      expect(storageContents.has('connections')).toBe(false);
      expect(store.connections).toEqual([]);
    });

    it('DPAPI 写失败时原有连接不受影响', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'keep-me',
        name: '原有',
      }));

      invokeMock.mockRejectedValueOnce(new Error('boom'));
      await expect(store.saveConnection(form({
        id: 'keep-me',
        name: '改名失败',
        password: 'secret',
      }))).rejects.toBeTruthy();

      expect(storedConnections()).toHaveLength(1);
      expect(storedConnections()[0].name).toBe('原有');
    });
  });

  describe('密码框语义', () => {
    it('空密码框不改已存的密码，也不调 save_credential', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'c1',
        password: 'secret',
      }));
      invokeMock.mockClear();

      const updated = await store.saveConnection(form({
        id: 'c1',
        name: '改了名字',
        password: '',
      }));

      expect(invokeMock).not.toHaveBeenCalled();
      expect(updated.credentialKey).toBe('c1');
      expect(storedConnections()[0].credentialKey).toBe('c1');
    });

    it('显式 clearPassword 才真的清掉密码', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'c1',
        password: 'secret',
      }));
      invokeMock.mockClear();

      const updated = await store.saveConnection(form({
        id: 'c1',
        password: '',
        clearPassword: true,
      }));

      expect(invokeMock).toHaveBeenCalledWith('remote_delete_credential', { key: 'c1' });
      expect(updated.credentialKey).toBeUndefined();
      expect(JSON.stringify(storedConnections())).not.toContain('credentialKey');
    });

    it('改了密码就覆盖同一条密文，不新增一条', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'c1',
        password: 'old',
      }));
      invokeMock.mockClear();

      await store.saveConnection(form({
        id: 'c1',
        password: 'new',
      }));

      expect(invokeMock).toHaveBeenCalledWith('remote_save_credential', {
        key: 'c1',
        secret: 'new',
      });
      expect(storedConnections()).toHaveLength(1);
    });
  });

  describe('删除', () => {
    it('删连接会连同它的密文一起清掉', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'c1',
        password: 'secret',
      }));
      invokeMock.mockClear();

      await store.deleteConnection('c1');

      expect(invokeMock).toHaveBeenCalledWith('remote_delete_credential', { key: 'c1' });
      expect(storedConnections()).toEqual([]);
    });

    it('没有密码的连接删除时不发多余请求', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({ id: 'c1' }));
      invokeMock.mockClear();

      await store.deleteConnection('c1');

      expect(invokeMock).not.toHaveBeenCalled();
      expect(storedConnections()).toEqual([]);
    });

    /** 密文删不掉时连接必须已经消失 —— 宁可留一块没人引用的加密数据，
     * 也不能留下一个「显示有密码但永远连不上」的连接。 */
    it('密文删除失败不影响连接本身被删掉', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'c1',
        password: 'secret',
      }));
      invokeMock.mockRejectedValueOnce(new Error('文件被占用'));

      await store.deleteConnection('c1');

      expect(store.connections).toEqual([]);
      expect(storedConnections()).toEqual([]);
    });
  });

  describe('校验', () => {
    it.each([
      ['nameRequired', form({ name: '   ' })],
      ['hostRequired', form({ host: '' })],
      ['hostHasWhitespace', form({ host: 'ftp example com' })],
      ['portInvalid', form({ port: 0 })],
      ['portInvalid', form({ port: 70000 })],
      ['initialPathInvalid', form({ initialPath: '/pub/../etc' })],
      ['proxyHostRequired', form({
        proxy: {
          kind: 'socks5',
          host: '',
          port: 1080,
        },
      })],
      ['proxyPortInvalid', form({
        proxy: {
          kind: 'socks5',
          host: '127.0.0.1',
          port: 0,
        },
      })],
      ['connectionIdInvalid', form({ id: 'a/b' })],
      ['connectionIdInvalid', form({ id: 'a\\b' })],
    ])('拒绝：%s', async (expectedCode, invalidForm) => {
      const store = useRemoteConnectionsStore();
      await store.init();

      await expect(store.saveConnection(invalidForm)).rejects.toThrow(expectedCode);
      expect(storedConnections()).toEqual([]);
    });

    it('初始目录被规范化后落盘', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      const saved = await store.saveConnection(form({ initialPath: 'pub//docs/' }));

      expect(saved.initialPath).toBe('/pub/docs');
      expect(storedConnections()[0].initialPath).toBe('/pub/docs');
    });

    it('代理的 username / password 原样保留', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      const saved = await store.saveConnection(form({
        proxy: {
          kind: 'socks5',
          host: '127.0.0.1',
          port: 1080,
          username: 'agent',
          password: 'proxy-pass',
        },
      }));

      // 代理认证信息同样属于机密，本阶段只保证形状透传，
      // 落盘加密留给设置页接入时处理（见模块注释里的两条链）。
      expect(saved.proxy).toEqual({
        kind: 'socks5',
        host: '127.0.0.1',
        port: 1080,
        username: 'agent',
        password: 'proxy-pass',
      });
    });

    // ---- 本地目录（可选） -------------------------------------------------

    it('本地目录会落盘', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      const saved = await store.saveConnection(form({
        localPath: 'C:/Users/test/Downloads',
      }));

      expect(saved.localPath).toBe('C:/Users/test/Downloads');
      expect(storedConnections()[0].localPath).toBe('C:/Users/test/Downloads');
    });

    it.each([
      ['空串', ''],
      ['纯空白', '   '],
    ])('本地目录是%s时字段整个不写出去', async (_label, localPath) => {
      const store = useRemoteConnectionsStore();
      await store.init();

      const saved = await store.saveConnection(form({ localPath }));

      expect(saved.localPath).toBeUndefined();
      expect(JSON.stringify(storedConnections())).not.toContain('localPath');
    });

    it('编辑时把本地目录清空等同于关掉双屏', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();
      await store.saveConnection(form({
        id: 'c1',
        localPath: 'C:/keep',
      }));

      const updated = await store.saveConnection(form({
        id: 'c1',
        localPath: '',
      }));

      expect(updated.localPath).toBeUndefined();
      expect(storedConnections()[0].localPath).toBeUndefined();
    });

    it('拒绝含空格的本地目录', async () => {
      const store = useRemoteConnectionsStore();
      await store.init();

      await expect(store.saveConnection(form({
        localPath: 'C:/My Documents',
      }))).rejects.toThrow('localPathHasWhitespace');
      expect(storedConnections()).toEqual([]);
    });
  });

  it('同名连接可以共存，不会互相覆盖', async () => {
    const store = useRemoteConnectionsStore();
    await store.init();

    await store.saveConnection(form({
      name: '备份',
      host: 'a.example.com',
    }));
    await store.saveConnection(form({
      name: '备份',
      host: 'b.example.com',
    }));

    expect(storedConnections()).toHaveLength(2);
    expect(storedConnections().map(connection => connection.host)).toEqual([
      'a.example.com',
      'b.example.com',
    ]);
  });

  // -------------------------------------------------------------------------
  // 测试连接
  //
  // 这里真正要钉住的是**密码从哪来**：密码框空串的语义是「不碰已存的密码」，
  // 所以编辑既有连接时必须把存过的那条取出来送过去，否则测的其实是「空密码」，
  // 而空密码的结论和「没存过」长得一样 —— 用户看不出自己测错了东西。
  // -------------------------------------------------------------------------

  describe('testConnection', () => {
    it('表单里有密码就直接送那个密码，不去读存档', async () => {
      invokeMock.mockImplementation(async (command: string) => {
        if (command === 'remote_test_connection') {
          return {
            outcome: 'verified',
            passwordChecked: true,
            tlsVerified: false,
            message: 'ok',
          };
        }

        return undefined;
      });
      const store = useRemoteConnectionsStore();

      await store.testConnection(form({ password: 'typed-in' }));

      expect(invokeMock).not.toHaveBeenCalledWith('remote_load_credential', expect.anything());
      const call = invokeMock.mock.calls.find(entry => entry[0] === 'remote_test_connection');
      expect(call?.[1]).toMatchObject({
        request: expect.objectContaining({ password: 'typed-in' }),
      });
    });

    it('编辑既有连接且密码框留空时，取出存过的密码去测', async () => {
      invokeMock.mockImplementation(async (command: string) => {
        if (command === 'remote_load_credential') {
          return 'stored-secret';
        }

        if (command === 'remote_test_connection') {
          return {
            outcome: 'verified',
            passwordChecked: true,
            tlsVerified: false,
            message: 'ok',
          };
        }

        return undefined;
      });
      const store = useRemoteConnectionsStore();

      await store.testConnection(form({
        id: 'c1',
        password: '',
      }));

      expect(invokeMock).toHaveBeenCalledWith('remote_load_credential', { key: 'c1' });
      const call = invokeMock.mock.calls.find(entry => entry[0] === 'remote_test_connection');
      expect(call?.[1]).toMatchObject({
        request: expect.objectContaining({ password: 'stored-secret' }),
      });
    });

    it('没存过密码时送 undefined，而不是空串', async () => {
      // 空串会让后端把一个空口令真的发出去，结论会被误读成「服务器认了空密码」。
      invokeMock.mockImplementation(async (command: string) => {
        if (command === 'remote_load_credential') {
          return null;
        }

        if (command === 'remote_test_connection') {
          return {
            outcome: 'missing_credential',
            passwordChecked: false,
            tlsVerified: false,
            message: 'no password',
          };
        }

        return undefined;
      });
      const store = useRemoteConnectionsStore();

      const report = await store.testConnection(form({
        id: 'c1',
        password: '',
      }));

      const call = invokeMock.mock.calls.find(entry => entry[0] === 'remote_test_connection');
      expect(call?.[1]).toMatchObject({
        request: expect.objectContaining({ password: undefined }),
      });
      expect(report.passwordChecked).toBe(false);
    });

    it('测试不写任何盘上的状态', async () => {
      // 纯读操作：测一次不能顺手改掉下次测试的输入。
      invokeMock.mockImplementation(async (command: string) => {
        if (command === 'remote_test_connection') {
          return {
            outcome: 'verified',
            passwordChecked: true,
            tlsVerified: false,
            message: 'ok',
          };
        }

        return undefined;
      });
      const store = useRemoteConnectionsStore();

      await store.testConnection(form({
        id: 'c1',
        password: 'x',
      }));

      expect(invokeMock).not.toHaveBeenCalledWith('remote_save_credential', expect.anything());
      expect(invokeMock).not.toHaveBeenCalledWith('remote_delete_credential', expect.anything());
      expect(lazyStoreSaveMock).not.toHaveBeenCalled();
      expect(storageContents.has('connections')).toBe(false);
    });
  });
});
