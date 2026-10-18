// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 用户 2026-10-18 的三条要求，全在这个文件里钉住：
//
// 1. 在别的页面点远程连接，**也要切到导航器界面**；
// 2. 没有保存或录入密码时，**照样切页、照样开两格**；
// 3. 每条连接右侧的设置按钮，**直接进那条连接的编辑界面**。
//
// 顺序也是被测对象：切页必须在开标签组**之前**。反过来的话 FileBrowser 还没
// 挂载，`init()` 读不到新建的 tab，那一格停在空路径上 —— 界面上看着像
// 「双屏开出来是空的」，而没有任何报错。

import { describe, expect, it, vi } from 'vitest';
import type { RemoteConnection } from '@/types/remote';
import {
  editRemoteConnection,
  openRemoteConnection,
  type RemoteOpenActions,
} from '@/modules/remote/utils/open-remote-connection';

function makeConnection(overrides: Partial<RemoteConnection> = {}): RemoteConnection {
  return {
    id: 'c1',
    name: '速豹堂',
    protocol: 'sftp',
    host: '192.168.1.9',
    port: 22,
    username: 'duanyi',
    initialPath: '/',
    proxy: { kind: 'direct' },
    ...overrides,
  };
}

/** 记下两个动作的先后顺序，而不只是「都调用过」。 */
function createRecorder() {
  const calls: string[] = [];

  const actions: RemoteOpenActions = {
    navigateToNavigator: vi.fn(async () => {
      calls.push('navigate');
    }),
    openPanes: vi.fn(async (paths: string[]) => {
      calls.push(`openPanes:${paths.join('|')}`);
    }),
  };

  return {
    calls,
    actions,
  };
}

describe('从导航栏连一个远程连接', () => {
  it('先切到导航器页，再开标签组', async () => {
    const { calls, actions } = createRecorder();

    await openRemoteConnection(makeConnection({ localPath: 'E:/website_sbt' }), actions);

    expect(calls).toEqual(['navigate', 'openPanes:E:/website_sbt|sfm://remote/c1']);
  });

  it('没有本地目录时只开远端一格，但照样先切页', async () => {
    const { calls, actions } = createRecorder();

    await openRemoteConnection(makeConnection(), actions);

    // 单格不是「不切页的理由」：用户点了就是要看到东西。
    expect(calls).toEqual(['navigate', 'openPanes:sfm://remote/c1']);
  });

  it('本地目录在左、远端在右，顺序不能反', async () => {
    const { actions } = createRecorder();
    const received: string[][] = [];
    // 直接收下参数，而不是声明一个用不上的 `_paths` ——
    // 后者会被 @typescript-eslint/no-unused-vars 判掉，
    // 而 mock 不带参数声明时 `mock.calls[0]` 又会被 vue-tsc 判成 TS2493。
    const openPanes = vi.fn(async (paths: string[]) => {
      received.push(paths);
    });

    await openRemoteConnection(makeConnection({ localPath: 'C:/work' }), {
      ...actions,
      openPanes,
    });

    // 双屏在本项目的表示是「一组标签页多于一个」，数组顺序即左右。
    // 写成两个独立断言，反了的时候两条都会给出可读的名字。
    expect(received).toHaveLength(1);
    expect(received[0][0]).toBe('C:/work');
    expect(received[0][1]).toBe('sfm://remote/c1');
  });

  it.each([
    ['没有任何密码信息', {}],
    ['存了密码', { credentialKey: 'c1' }],
  ])('%s 都不影响是否切页与开几格', async (_label, credentialFields) => {
    const withoutPassword = createRecorder();
    const withPassword = createRecorder();

    await openRemoteConnection(
      makeConnection({ localPath: 'E:/website_sbt' }),
      withoutPassword.actions,
    );
    await openRemoteConnection(
      makeConnection({
        localPath: 'E:/website_sbt',
        ...credentialFields,
      }),
      withPassword.actions,
    );

    // 用户要求 2：有没有密码**不是**开不开的前置条件。
    // 真缺凭据时该由远端那一格自己去要，而不是在这里静默不开。
    expect(withoutPassword.calls).toEqual(withPassword.calls);
  });

  it('连接 id 非法时什么都不做', async () => {
    const { calls, actions } = createRecorder();

    await openRemoteConnection(makeConnection({ id: '' }), actions);
    await openRemoteConnection(makeConnection({ id: 'a/b' }), actions);
    await openRemoteConnection(makeConnection({ id: 'a\\b' }), actions);

    // 硬开只会得到一格打不开的远程路径，连切页都不该发生。
    expect(calls).toEqual([]);
  });

  it('路由跳转会抛错时，不吞掉错误', async () => {
    const openPanes = vi.fn(async () => {});
    const actions: RemoteOpenActions = {
      navigateToNavigator: async () => {
        throw new Error('route failed');
      },
      openPanes,
    };

    await expect(openRemoteConnection(makeConnection(), actions)).rejects.toThrow('route failed');
    expect(openPanes).not.toHaveBeenCalled();
  });
});

describe('从导航栏直接编辑某条连接', () => {
  it('先记下编辑请求，再跳到远程分类', async () => {
    const calls: string[] = [];
    const requestEdit = vi.fn((id: string) => {
      calls.push(`request:${id}`);
    });
    const openSettingsTab = vi.fn(async (tab: string) => {
      calls.push(`settings:${tab}`);
    });

    await editRemoteConnection(makeConnection(), {
      requestEdit,
      openSettingsTab,
    });

    // 顺序反了就是「点设置只是跳到了远程分类，表单不打开」——
    // 设置页的分类靠挂载/变化时消费这个请求，跳过去时请求还没到就没人接。
    expect(calls).toEqual(['request:c1', 'settings:remote']);
  });
});
