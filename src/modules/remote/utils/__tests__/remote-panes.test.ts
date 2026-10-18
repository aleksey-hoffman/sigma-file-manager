// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { resolveRemoteOpenPanes, shouldOpenRemoteAsSplit } from '@/modules/remote/utils/remote-panes';
import type { RemoteConnection } from '@/types/remote';

function connection(overrides: Partial<RemoteConnection> = {}): RemoteConnection {
  return {
    id: 'c1',
    name: 'backup',
    protocol: 'sftp',
    host: 'sftp.example.com',
    port: 22,
    username: 'me',
    initialPath: '/',
    proxy: {
      kind: 'direct',
    },
    ...overrides,
  };
}

const WITH_LOCAL = connection({ localPath: 'C:/Users/test/Downloads' });
const WITHOUT_LOCAL = connection();

describe('resolveRemoteOpenPanes', () => {
  it('有本地目录时左本地右远端，顺序不能反', () => {
    const panes = resolveRemoteOpenPanes('sfm://remote/c1/pub', [WITH_LOCAL]);

    expect(panes).toEqual([
      {
        path: 'C:/Users/test/Downloads',
        role: 'local',
      },
      {
        path: 'sfm://remote/c1/pub',
        role: 'remote',
      },
    ]);
  });

  it('没有本地目录时只摆一格远端', () => {
    expect(resolveRemoteOpenPanes('sfm://remote/c1/pub', [WITHOUT_LOCAL])).toEqual([
      {
        path: 'sfm://remote/c1/pub',
        role: 'remote',
      },
    ]);
  });

  it.each([
    ['undefined', undefined],
    ['空串', ''],
    ['纯空白', '   '],
  ])('本地目录是%s时视为不摆双屏', (_label, localPath) => {
    const panes = resolveRemoteOpenPanes('sfm://remote/c1/pub', [
      connection({ localPath: localPath as string | undefined }),
    ]);

    expect(panes).toHaveLength(1);
  });

  it('本地目录前后空白会被裁掉', () => {
    const panes = resolveRemoteOpenPanes('sfm://remote/c1/pub', [
      connection({ localPath: '  C:/data  ' }),
    ]);

    expect(panes[0].path).toBe('C:/data');
  });

  /// 连接查不到时退化成空数组的话，标签页会开不出来 ——
  /// 用户看到的是「点了没反应」，而不是「这条连接没了」。
  it('连接不存在时仍然返回一格，让调用方去报错', () => {
    expect(resolveRemoteOpenPanes('sfm://remote/missing/pub', [WITH_LOCAL])).toEqual([
      {
        path: 'sfm://remote/missing/pub',
        role: 'remote',
      },
    ]);
  });

  it('不是远程路径时原样返回单格，不改变调用方的既有行为', () => {
    expect(resolveRemoteOpenPanes('C:/Users/test', [WITH_LOCAL])).toEqual([
      {
        path: 'C:/Users/test',
        role: 'remote',
      },
    ]);
  });

  it('远端根路径也照常摆双屏', () => {
    expect(resolveRemoteOpenPanes('sfm://remote/c1', [WITH_LOCAL])).toHaveLength(2);
  });

  it('只认 id 匹配的那条连接', () => {
    const panes = resolveRemoteOpenPanes('sfm://remote/c2/pub', [
      WITH_LOCAL,
      connection({
        id: 'c2',
        localPath: 'D:/other',
      }),
    ]);

    expect(panes).toHaveLength(2);
    expect(panes[0].path).toBe('D:/other');
  });

  /// 填了两遍同一个路径时合并掉，用户会以为双屏功能坏了。
  it('本地目录与远端路径相同时仍然摆两格', () => {
    const panes = resolveRemoteOpenPanes('C:/same', [connection({ localPath: 'C:/same' })]);
    // C:/same 不是远程路径，走单格分支；用一条真正的远程路径再验一次
    expect(panes).toHaveLength(1);

    const remotePanes = resolveRemoteOpenPanes('sfm://remote/c1', [
      connection({ localPath: 'sfm://remote/c1' }),
    ]);
    expect(remotePanes).toHaveLength(2);
  });
});

describe('shouldOpenRemoteAsSplit', () => {
  it('与 resolveRemoteOpenPanes 的格数一致', () => {
    expect(shouldOpenRemoteAsSplit('sfm://remote/c1/pub', [WITH_LOCAL])).toBe(true);
    expect(shouldOpenRemoteAsSplit('sfm://remote/c1/pub', [WITHOUT_LOCAL])).toBe(false);
  });
});
