// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：远程删除的前端编排（用户反馈：远程文件没有删除菜单）。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  REMOTE_PERMISSION_DENIED_KIND,
  deleteRemoteEntries,
  hasPermissionDeniedFailure,
} from '../remote-delete';
import { removeRemotePath } from '../remote-transfer';

const { invokeMock } = vi.hoisted(() => {
  return {
    invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

function makeEntry(path: string, isDir = false): DirEntry {
  return {
    name: path.split('/').pop() ?? path,
    ext: null,
    path,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: !isDir,
    is_dir: isDir,
    is_symlink: false,
    is_hidden: false,
  };
}

const REMOTE_FILE = makeEntry('sfm://remote/conn-1/docs/readme.md');
const REMOTE_DIR = makeEntry('sfm://remote/conn-1/docs', true);

describe('removeRemotePath', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('命令名与参数名都按 Rust 侧的 camelCase 形式', async () => {
    // Rust 侧是 `remote_path` / `is_dir`，Tauri 按「Rust 参数名的 camelCase 形式」
    // 匹配 JS 传进来的键。传 `path` / `is_dir` 会直接报「unknown field」。
    await removeRemotePath('sfm://remote/conn-1/docs/readme.md', false);

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('remote_remove_path', {
      remotePath: 'sfm://remote/conn-1/docs/readme.md',
      isDir: false,
    });
  });

  it('目录走 isDir = true', async () => {
    await removeRemotePath('sfm://remote/conn-1/docs', true);

    expect(invokeMock).toHaveBeenCalledWith('remote_remove_path', {
      remotePath: 'sfm://remote/conn-1/docs',
      isDir: true,
    });
  });
});

describe('deleteRemoteEntries', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('删成功时逐条上报删除的路径', async () => {
    const report = await deleteRemoteEntries([REMOTE_FILE, REMOTE_DIR]);

    expect(report.deleted).toEqual([REMOTE_FILE.path, REMOTE_DIR.path]);
    expect(report.failures).toEqual([]);
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });

  it('一个失败不影响其余条目', async () => {
    invokeMock
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({
        kind: 'permission',
        message: '服务器拒绝了删除操作',
      });

    const report = await deleteRemoteEntries([REMOTE_FILE, REMOTE_DIR]);

    expect(report.deleted).toEqual([REMOTE_FILE.path]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].path).toBe(REMOTE_DIR.path);
  });

  it('失败原因取后端的 message，而不是 [object Object]', async () => {
    // Tauri 把 RemoteError 原样 reject 过来（普通对象，不是 Error 实例）。
    // 用 String(error) 会得到 "[object Object]"，用户看到的是一句废话。
    invokeMock.mockRejectedValue({
      kind: 'not_found',
      message: '这个远端目录不是空的，SFTP 不支持递归删除：/docs',
    });

    const report = await deleteRemoteEntries([REMOTE_DIR]);

    expect(report.failures[0].message).toBe('这个远端目录不是空的，SFTP 不支持递归删除：/docs');
    expect(report.failures[0].message).not.toContain('[object Object]');
  });

  it('失败带上后端的分类，前端据此换一句更具体的提示', async () => {
    invokeMock.mockRejectedValue({
      kind: 'permission',
      message: '服务器拒绝了删除操作',
    });

    const report = await deleteRemoteEntries([REMOTE_FILE]);

    expect(report.failures[0].kind).toBe('permission');
    expect(hasPermissionDeniedFailure(report)).toBe(true);
  });

  it('没有权限不足的失败时不算权限问题', async () => {
    invokeMock.mockRejectedValue({
      kind: 'not_found',
      message: '路径不存在',
    });

    const report = await deleteRemoteEntries([REMOTE_FILE]);

    expect(hasPermissionDeniedFailure(report)).toBe(false);
  });

  it('空选区不调后端', async () => {
    const report = await deleteRemoteEntries([]);

    expect(invokeMock).not.toHaveBeenCalled();
    expect(report.deleted).toEqual([]);
    expect(report.failures).toEqual([]);
  });

  it('后端抛的不是 RemoteError 时也不崩', async () => {
    invokeMock.mockRejectedValue(new Error('连接断了'));

    const report = await deleteRemoteEntries([REMOTE_FILE]);

    expect(report.deleted).toEqual([]);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0].message).toBe('连接断了');
    // 拿不到分类时必须是 undefined，不能瞎填一个。
    expect(report.failures[0].kind).toBeUndefined();
    expect(hasPermissionDeniedFailure(report)).toBe(false);
  });

  it('权限不足的分类常量与后端一致', () => {
    expect(REMOTE_PERMISSION_DENIED_KIND).toBe('permission');
  });
});
