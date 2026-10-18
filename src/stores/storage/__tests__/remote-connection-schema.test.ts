// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-18：连接表 schema 的跨语言护栏。
//
// 阶段 2 起 Rust 侧也要读 `user-remote-connections.json`（2026-10-18 用户拍板的方案 C），
// 于是这份文件有了**两个读者**：前端的 pinia store 与 Rust 的 `registry.rs`。
// 两个读者 = 两份 schema = 会漂移。AGENTS 已经记过一次「读写两侧不同步导致重启丢数据」，
// 那里治好的病不该在这里复发。
//
// 护栏：`src-shared/remote-connection.sample.json` 被**两侧各有一份测试读**。
// 任何一侧改了字段名而另一侧没跟上，两边的测试会同时转红 —— 这比注释里写
// 「两边要同步」可靠得多，注释提醒不住任何人。

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RemoteConnection } from '@/types/remote';
import { hasRemoteLocalPath } from '@/types/remote';

interface ConnectionsFile {
  connections: RemoteConnection[];
}

/**
 * **刻意用 fs 读而不是 `import`。** `src-shared/` 在 Vite 的 `root` 之外，
 * 写成静态 import 会直接 `Failed to resolve import`。
 * Rust 侧读同一个文件用的是 `include_str!`，路径是手写不动的。
 *
 * 路径以 `process.cwd()`（vitest 的项目根）为准 —— `import.meta.url` 在本仓的
 * 测试环境里不是 file URL，`fileURLToPath` 会抛 "The URL must be of scheme file"。
 */
const sharedFixturePath = resolve(process.cwd(), 'src-shared/remote-connection.sample.json');

const sharedFixture = JSON.parse(readFileSync(sharedFixturePath, 'utf8')) as ConnectionsFile;

describe('远程连接表的跨语言契约', () => {
  it('共享 fixture 与 Rust 侧读的是同一个文件', () => {
    // 这条是护栏本身的存在证明：文件被挪走或改名时，这里先红，
    // 而不是等到 Rust 那边编译失败才发现两侧已经不一致。
    expect(sharedFixture.connections).toHaveLength(3);
  });

  it('共享 fixture 的形状就是 store 读出来的形状', () => {
    expect(Array.isArray(sharedFixture.connections)).toBe(true);

    // store 的 `applyRecord` 就是这么读的：直接当数组用，不做形状修复。
    const connections: RemoteConnection[] = sharedFixture.connections;

    for (const connection of connections) {
      expect(typeof connection.id).toBe('string');
      expect(typeof connection.name).toBe('string');
      expect(typeof connection.host).toBe('string');
      expect(Number.isInteger(connection.port)).toBe(true);
      expect(typeof connection.username).toBe('string');
      expect(connection.initialPath.startsWith('/')).toBe(true);
    }
  });

  it('SFTP 那条覆盖了双屏与凭据键', () => {
    const sftp = sharedFixture.connections[0];

    expect(sftp.protocol).toBe('sftp');
    expect(sftp.port).toBe(22);
    // 凭据键恒等于连接 id —— 一条连接一份凭据，不另起一套编号。
    expect(sftp.credentialKey).toBe(sftp.id);
    expect(hasRemoteLocalPath(sftp)).toBe(true);
  });

  it('SOCKS5 那条覆盖了带代理的连接，且没有 localPath 字段', () => {
    const ftp = sharedFixture.connections[1];

    expect(ftp.protocol).toBe('ftp');
    expect(ftp.proxy).toEqual({
      kind: 'socks5',
      host: '127.0.0.1',
      port: 1080,
    });
    // Rust 的 `Option<String>` 缺省就是「不摆双屏」，前端侧同样按缺失判定。
    expect('localPath' in ftp).toBe(false);
    expect(hasRemoteLocalPath(ftp)).toBe(false);
  });

  it('匿名 FTP 那条覆盖了无凭据键与空用户名', () => {
    const anonymous = sharedFixture.connections[2];

    expect(anonymous.username).toBe('');
    expect('credentialKey' in anonymous).toBe(false);
    // 没有凭据键的连接，Rust 侧会按「不提交密码」处理，而不是去解一个不存在的密文。
    expect(anonymous.proxy).toEqual({ kind: 'direct' });
  });
});
