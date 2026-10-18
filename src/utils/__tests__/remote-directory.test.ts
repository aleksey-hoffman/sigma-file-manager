// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-18：远程 invoke 封装与错误解包（阶段 2 需求 1）。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  REMOTE_READ_DIR_COMMAND,
  REMOTE_STAT_COMMAND,
  describeRemoteError,
  isRemoteErrorPayload,
  readRemoteDirectory,
  statRemoteEntry,
} from '@/utils/remote-directory';

const { invokeMock } = vi.hoisted(() => {
  return {
    invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('remote-directory', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  describe('describeRemoteError', () => {
    it('从 { kind, message } 里取 message，而不是变成 [object Object]', () => {
      // 这是这一层存在的全部理由：导航器原本写的是 String(caughtError)，
      // 远程 RemoteError 是普通对象，用户在认证失败时看到的是字面量
      // 「[object Object]」—— 正是规格 §6.3 明令禁止的笼统错误。
      expect(describeRemoteError({
        kind: 'auth',
        message: '密码错误',
      })).toBe('密码错误');
    });

    it('本地的 Error 仍取 message（行为不变）', () => {
      expect(describeRemoteError(new Error('本地读目录失败'))).toBe('本地读目录失败');
    });

    it('本地的字符串错误原样返回（行为不变）', () => {
      expect(describeRemoteError('read_dir failed')).toBe('read_dir failed');
    });

    it('空载荷不被误认成远程错误', () => {
      // `{}` 与 `{ message: 1 }` 都必须落到 String() 分支：
      // isRemoteErrorPayload 放宽成「有 message 就算」的话，
      // 任何带 message 字段的第三方对象都会被当成 RemoteError 吞掉。
      expect(isRemoteErrorPayload({})).toBe(false);
      expect(isRemoteErrorPayload({ message: 'x' })).toBe(false);
      expect(isRemoteErrorPayload({ kind: 'auth' })).toBe(false);
      expect(isRemoteErrorPayload(null)).toBe(false);
      expect(isRemoteErrorPayload('auth')).toBe(false);

      expect(describeRemoteError({})).toBe('[object Object]');
      expect(describeRemoteError({ message: 1 })).toBe('[object Object]');
    });

    it('认得出真正的 RemoteError 载荷', () => {
      expect(isRemoteErrorPayload({
        kind: 'not_found',
        message: '没有那个目录',
      })).toBe(true);
    });
  });

  describe('command 契约', () => {
    it('列目录用 remote_read_dir，只传 path', async () => {
      invokeMock.mockResolvedValue({ path: 'sfm://remote/c' });

      await readRemoteDirectory('sfm://remote/c');

      expect(REMOTE_READ_DIR_COMMAND).toBe('remote_read_dir');
      expect(invokeMock).toHaveBeenCalledWith('remote_read_dir', {
        path: 'sfm://remote/c',
      });
    });

    it('取条目用 remote_stat_dir_entry', async () => {
      invokeMock.mockResolvedValue({ name: 'a.txt' });

      await statRemoteEntry('sfm://remote/c/a.txt');

      expect(REMOTE_STAT_COMMAND).toBe('remote_stat_dir_entry');
      expect(invokeMock).toHaveBeenCalledWith('remote_stat_dir_entry', {
        path: 'sfm://remote/c/a.txt',
      });
    });

    it('stat 失败吞掉错误给 null，read_dir 失败原样抛出', async () => {
      // 两者方向相反是有意的：地址栏自动补全要「false 就当不存在」，
      // 而导航器要把「密码错 / 网络不通」如实显示出来，静默兜底才是需求 1 的病根。
      invokeMock.mockRejectedValue({
        kind: 'not_found',
        message: '没有那个条目',
      });

      await expect(statRemoteEntry('sfm://remote/c/nope')).resolves.toBeNull();
      await expect(readRemoteDirectory('sfm://remote/c')).rejects.toEqual({
        kind: 'not_found',
        message: '没有那个条目',
      });
    });
  });
});
