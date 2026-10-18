// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 远程连接的**元数据**由本 store 经 tauri-plugin-store 拥有（落在
// `user-data/user-remote-connections.json`），密码由 Rust 侧经 DPAPI 拥有
// （落在 app-data 目录根的 `remote-credentials.json`）。
//
// 两条链刻意分开。合并成一条的后果是密文要跟着前端 schema 迁移走，还要塞进读白名单 ——
// 本项目已经因为「读写两侧不同步导致重启即丢」吃过一次亏。
//
// 但分开不等于可以随便写：**写顺序有硬约束**，见 `saveConnection`。

import { defineStore } from 'pinia';
import { LazyStore } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { ref } from 'vue';
import type {
  RemoteConnection,
  RemoteConnectionForm,
  RemoteConnectionTestReport,
  RemoteProxyConfig,
} from '@/types/remote';
import { createRemoteConnectionId } from '@/types/remote';
import { normalizeRemotePath } from '@/utils/remote-paths';
import { useUserPathsStore } from './user-paths';
import {
  canUseStartupStorageFastPath,
  getStartupStorageFile,
  getStartupStorageRecord,
  type StartupStorageFileBootstrap,
} from './utils/startup-storage-bootstrap';

/** storage 文件里的键。与后端 `src-tauri/src/user_storage_files_config.rs` 无关，两边各存各的。 */
const CONNECTIONS_KEY = 'connections';

export const useRemoteConnectionsStore = defineStore('remoteConnections', () => {
  const userPathsStore = useUserPathsStore();

  const storage = ref<LazyStore | null>(null);
  const connections = ref<RemoteConnection[]>([]);
  const isInitialized = ref(false);

  function isValidConnectionId(id: string): boolean {
    return id.length > 0 && !id.includes('/') && !id.includes('\\');
  }

  /**
   * 逐条校验，与后端 `RemoteConnection::validate` 对齐。
   *
   * 前端也要校验，不是为了代替后端，而是为了**在写盘之前**挡住明显错误 ——
   * 后端校验发生在凭据已经写进 DPAPI 之后，那时用户看到的是「保存失败」，
   * 而密码已经留下了。前端这一层是提前给出可读提示。
   */
  function validateForm(form: RemoteConnectionForm, id: string): string | null {
    if (!isValidConnectionId(id)) {
      return 'connectionIdInvalid';
    }

    if (form.name.trim().length === 0) {
      return 'nameRequired';
    }

    if (form.host.trim().length === 0) {
      return 'hostRequired';
    }

    if (/\s/.test(form.host)) {
      return 'hostHasWhitespace';
    }

    if (!Number.isInteger(form.port) || form.port < 1 || form.port > 65535) {
      return 'portInvalid';
    }

    if (normalizeRemotePath(form.initialPath) === null) {
      return 'initialPathInvalid';
    }

    // 本地目录**只查「像不像路径」**，不查存在性 ——
    // 校验发生在写盘之前，去 stat 一个还没建好的目录只会误报。
    // 与 Rust 侧 `RemoteConnection::validate` 同规则。
    if (form.localPath.trim().length > 0 && /\s/.test(form.localPath)) {
      return 'localPathHasWhitespace';
    }

    if (form.proxy.kind !== 'direct') {
      if (form.proxy.host.trim().length === 0) {
        return 'proxyHostRequired';
      }

      if (/\s/.test(form.proxy.host)) {
        return 'proxyHostHasWhitespace';
      }

      if (!Number.isInteger(form.proxy.port) || form.proxy.port < 1 || form.proxy.port > 65535) {
        return 'proxyPortInvalid';
      }
    }

    return null;
  }

  function applyRecord(record: Record<string, unknown>): void {
    const stored = record[CONNECTIONS_KEY];

    connections.value = Array.isArray(stored) ? (stored as RemoteConnection[]) : [];
  }

  async function loadStorageData(): Promise<void> {
    if (!storage.value) return;

    try {
      const stored = await storage.value.get<RemoteConnection[]>(CONNECTIONS_KEY);
      applyRecord({ [CONNECTIONS_KEY]: stored });
    }
    catch (error) {
      console.error('Failed to load remote connections storage:', error);
    }
  }

  function loadFromBootstrap(bootstrapFile?: StartupStorageFileBootstrap): boolean {
    if (!canUseStartupStorageFastPath(bootstrapFile)) {
      return false;
    }

    const bootstrapRecord = getStartupStorageRecord(bootstrapFile);

    if (!bootstrapRecord) {
      return true;
    }

    applyRecord(bootstrapRecord);
    return true;
  }

  async function saveStorageData(): Promise<void> {
    // **刻意不静默 no-op。** 仓库里既有的 store 在这里写的是
    // `if (!storage.value) return;`，后果是 init 失败时每次保存都悄悄丢掉：
    // 界面立刻显示新连接、内存里也有，重启即无，全程零报错。
    // 密码的写入顺序依赖这一层「要么写成功、要么明确失败」，
    // 静默返回会让调用方以为已经落盘。
    if (!storage.value) {
      throw new Error('remoteConnectionsStorageNotReady');
    }

    try {
      await storage.value.set(CONNECTIONS_KEY, connections.value);
      await storage.value.save();
    }
    catch (error) {
      console.error('Failed to save remote connections storage:', error);
      throw error;
    }
  }

  async function init(bootstrapFile?: StartupStorageFileBootstrap): Promise<void> {
    if (isInitialized.value) return;

    try {
      const resolvedBootstrapFile = bootstrapFile ?? await getStartupStorageFile('remoteConnections');
      storage.value = await new LazyStore(userPathsStore.customPaths.appUserDataRemoteConnectionsPath);
      await storage.value.save();

      if (!loadFromBootstrap(resolvedBootstrapFile)) {
        await loadStorageData();
      }

      isInitialized.value = true;
    }
    catch (error) {
      console.error('Failed to initialize remote connections storage:', error);
    }
  }

  function getConnection(id: string): RemoteConnection | undefined {
    return connections.value.find(connection => connection.id === id);
  }

  /**
   * 新建或更新一条连接。
   *
   * ## 写顺序是硬约束，不能调换
   *
   * 1. **先**写 DPAPI 密文，**后**写 storage。密文写失败就直接抛错返回，
   *    storage 一行都不动。反过来的话，storage 里会留下一条 `credentialKey`
   *    指向不存在的密文 —— 界面显示「已保存密码」，实际连上去必然认证失败，
   *    而且没有任何报错可查。
   * 2. storage 写失败不回滚密文。那只是一条没有引用的加密数据块，
   *    用户重新保存一次覆盖掉即可；反过来回滚则要在失败路径上再发一次 invoke，
   *    反而制造出「invoke 成功但 store 没更新」这种更难查的状态。
   *
   * ## 密码框空串 = 「不碰已存的密码」
   *
   * 用户改个端口顺手清空密码框是常事，那**不等于**要清密码。
   * 真正要清必须显式传 `clearPassword`。
   */
  async function saveConnection(form: RemoteConnectionForm): Promise<RemoteConnection> {
    const id = form.id ?? createRemoteConnectionId();
    const validationError = validateForm(form, id);

    if (validationError) {
      throw new Error(validationError);
    }

    const existing = getConnection(id);
    const hasNewPassword = form.password.length > 0 && !form.clearPassword;
    const normalizedPath = normalizeRemotePath(form.initialPath) ?? '/';
    const trimmedLocalPath = form.localPath.trim();

    // 第一步：密文先行。
    let credentialKey = existing?.credentialKey;

    if (hasNewPassword) {
      await invoke('remote_save_credential', {
        key: id,
        secret: form.password,
      });
      credentialKey = id;
    }
    else if (form.clearPassword) {
      await invoke('remote_delete_credential', {
        key: id,
      });
      credentialKey = undefined;
    }

    const connection: RemoteConnection = {
      id,
      name: form.name.trim(),
      protocol: form.protocol,
      host: form.host.trim(),
      port: form.port,
      username: form.username,
      initialPath: normalizedPath,
      // 空串 / 纯空白 → 字段整个不写出去，保持与「不摆双屏」同义。
      ...(trimmedLocalPath
        ? { localPath: trimmedLocalPath }
        : {}),
      proxy: form.proxy,
      ...(credentialKey
        ? { credentialKey }
        : {}),
    };

    // 第二步：storage。走到这里密文已经在盘上。
    if (existing) {
      connections.value = connections.value.map(item => (item.id === id ? connection : item));
    }
    else {
      connections.value = [...connections.value, connection];
    }

    await saveStorageData();

    return connection;
  }

  /**
   * 删掉一条连接，并把它的密文一并清掉。
   *
   * storage 先删、密文后删，且**密文删失败不抛错**：连接已经不存在了，
   * 残留的密文只是一块没人引用的加密数据。反过来的话，凭据没了而连接还在，
   * 用户会看到一个「有密码」的连接但怎么都连不上。
   */
  async function deleteConnection(id: string): Promise<void> {
    const existing = getConnection(id);

    connections.value = connections.value.filter(connection => connection.id !== id);
    await saveStorageData();

    if (!existing?.credentialKey) return;

    try {
      await invoke('remote_delete_credential', {
        key: existing.credentialKey,
      });
    }
    catch (error) {
      console.error('Failed to delete remote credential:', error);
    }
  }

  /** 代理密码也走 DPAPI，与连接密码是两条独立记录。 */
  async function saveProxySecret(
    connectionId: string,
    proxy: RemoteProxyConfig,
  ): Promise<RemoteProxyConfig> {
    if (proxy.kind === 'direct' || !proxy.password) {
      return proxy;
    }

    await invoke('remote_save_credential', {
      key: `${connectionId}:proxy`,
      secret: proxy.password,
    });

    return proxy;
  }

  /**
   * 拿一条已保存连接的密码，供「测试连接」用。
   *
   * **只在内存里过一趟，不写回任何地方。** 测试连接是个纯读操作：
   * 测一次不该改变下次测试的输入，也不该动 DPAPI 存档。
   *
   * 返回 `null` 表示「没存过」—— 调用方据此把 `password` 传成
   * `undefined`（= 不打算提交凭据），而不是传空串。
   */
  async function loadCredentialForTest(key: string | undefined): Promise<string | null> {
    if (!key) {
      return null;
    }

    return invoke<string | null>('remote_load_credential', { key });
  }

  /**
   * 真去连一次，把结论报回来。**不写任何盘上的状态。**
   *
   * `password` 传 `undefined` 表示「这次不提交凭据」，与空串是两件事：
   * 匿名 FTP 会回 `verified` + `passwordChecked: false`，
   * 传空串则会让后端把空口令真的发出去。
   */
  async function testConnection(
    form: RemoteConnectionForm,
  ): Promise<RemoteConnectionTestReport> {
    let password = form.password.length > 0 ? form.password : undefined;

    if (password === undefined && form.id) {
      // 编辑既有连接且密码框留空：空串的语义是「不碰已存的密码」，
      // 所以要把存过的那条取出来用，否则测的其实是「空密码」。
      password = (await loadCredentialForTest(form.id)) ?? undefined;
    }

    return invoke<RemoteConnectionTestReport>('remote_test_connection', {
      request: {
        protocol: form.protocol,
        host: form.host.trim(),
        port: form.port,
        username: form.username,
        password,
        proxy: form.proxy,
      },
    });
  }

  return {
    storage,
    connections,
    isInitialized,

    init,
    loadStorageData,
    saveStorageData,
    getConnection,
    saveConnection,
    deleteConnection,
    saveProxySecret,
    loadCredentialForTest,
    testConnection,
  };
});
