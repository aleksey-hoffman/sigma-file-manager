// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：远程写操作（新建目录 / 重命名）的前端编排。

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  buildRemoteChildPath,
  canCreateFileIn,
  canCreateItemIn,
  createRemoteDirectory,
  hasRemoteTarget,
  remotePathAfterRename,
  renameRemoteEntry,
} from '../remote-write';

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

describe('远程「新建空文件」是永久非目标', () => {
  it('远程目录不能新建文件，本地目录可以', () => {
    // 规格 §1：SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件。
    expect(canCreateFileIn('sfm://remote/conn-1/docs')).toBe(false);
    expect(canCreateFileIn('sfm://remote/conn-1')).toBe(false);
    // 阳性对照：本地目录不能被误伤。
    expect(canCreateFileIn('C:/Users/Duanyi')).toBe(true);
  });

  it('目标里只要有一个远程，就整体不算「可新建文件」', () => {
    expect(hasRemoteTarget(['sfm://remote/conn-1/docs'])).toBe(true);
    expect(hasRemoteTarget(['C:/Users', 'sfm://remote/conn-1/docs'])).toBe(true);
    // 阳性对照：纯本地不算。
    expect(hasRemoteTarget(['C:/Users', 'D:/data'])).toBe(false);
    expect(hasRemoteTarget([])).toBe(false);
  });
});

describe('canCreateItemIn', () => {
  it('远程目录下「新建文件」不行，「新建目录」行', () => {
    // 规格 §1：远程「新建空文件」是**永久非目标**。
    expect(canCreateItemIn('file', ['sfm://remote/conn-1/docs'])).toBe(false);
    // 阶段 3：远程「新建目录」已实现。
    expect(canCreateItemIn('directory', ['sfm://remote/conn-1/docs'])).toBe(true);
  });

  it('本地目录下两种都行（阳性对照）', () => {
    expect(canCreateItemIn('file', ['C:/Users/Duanyi'])).toBe(true);
    expect(canCreateItemIn('directory', ['C:/Users/Duanyi'])).toBe(true);
  });

  it('混选时只要有一个远程，「新建文件」就整体不可用', () => {
    // 混选建一半比压根不给入口糟糕得多。
    expect(canCreateItemIn('file', ['C:/Users', 'sfm://remote/conn-1/docs'])).toBe(false);
    // 但「新建目录」在本地那部分仍然可以建 —— 远程那部分会被单独处理。
    expect(canCreateItemIn('directory', ['C:/Users', 'sfm://remote/conn-1/docs'])).toBe(true);
  });
});

describe('buildRemoteChildPath', () => {
  it('拼出远程目录下某个条目的完整路径', () => {
    expect(buildRemoteChildPath('sfm://remote/conn-1/docs', '新建目录')).toBe(
      'sfm://remote/conn-1/docs/新建目录',
    );
  });

  it('远程根也要能拼，且不出现双斜杠', () => {
    expect(buildRemoteChildPath('sfm://remote/conn-1', '新建目录')).toBe(
      'sfm://remote/conn-1/新建目录',
    );
  });

  it('不是远程路径就返回 null', () => {
    expect(buildRemoteChildPath('C:/Users', 'x')).toBeNull();
    expect(buildRemoteChildPath('sfm://locations', 'x')).toBeNull();
  });
});

describe('remotePathAfterRename', () => {
  it('改名后路径的父目录不变', () => {
    expect(remotePathAfterRename('sfm://remote/conn-1/docs/readme.md', '说明.md')).toBe(
      'sfm://remote/conn-1/docs/说明.md',
    );
  });

  it('顶层条目的父目录是连接根', () => {
    expect(remotePathAfterRename('sfm://remote/conn-1/readme.md', '说明.md')).toBe(
      'sfm://remote/conn-1/说明.md',
    );
  });

  it('不是远程路径就返回 null', () => {
    expect(remotePathAfterRename('C:/Users/a.txt', 'b.txt')).toBeNull();
  });
});

describe('createRemoteDirectory', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('命令名与参数名都按 Rust 侧的 camelCase 形式', async () => {
    // Rust 侧是 `remote_path`，Tauri 按「Rust 参数名的 camelCase 形式」
    // 匹配 JS 传进来的键 —— 传 `path` 会报「unknown field」。
    // 这条断言是本项目**反复咬人**的地方，所以单独钉死。
    await createRemoteDirectory('新建目录', 'sfm://remote/conn-1/docs');

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('remote_make_dir', {
      remotePath: 'sfm://remote/conn-1/docs/新建目录',
    });
  });

  it('成功时返回 ok', async () => {
    const result = await createRemoteDirectory('新建目录', 'sfm://remote/conn-1/docs');

    expect(result.ok).toBe(true);
    expect(result.message).toBe('');
  });

  it('失败时**不抛错**，把后端的错误带回来', async () => {
    // 后端的 `RemoteError` 是**普通对象**（`{ kind, message }`），
    // 不是 `Error` 实例 —— 用 `String(error)` 会得到 "[object Object]"，
    // 用户在权限不足时看到的就是这个。
    invokeMock.mockRejectedValue({
      kind: 'permission',
      message: '权限不足，无法创建目录',
    });

    const result = await createRemoteDirectory('新建目录', 'sfm://remote/conn-1/docs');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('权限不足，无法创建目录');
    expect(result.kind).toBe('permission');
  });

  it('目标不是远程路径时连命令都不发', async () => {
    const result = await createRemoteDirectory('x', 'C:/Users');

    expect(result.ok).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe('renameRemoteEntry', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('命令名与参数名都按 Rust 侧的 camelCase 形式', async () => {
    // Rust 侧是 `from_path` / `new_name`。
    // 注意第二个参数是**新名字**而不是完整路径 ——
    // 改名就是「在原目录内换个名字」，不是移动。
    await renameRemoteEntry(REMOTE_FILE, '说明.md');

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith('remote_rename_path', {
      fromPath: 'sfm://remote/conn-1/docs/readme.md',
      newName: '说明.md',
    });
  });

  it('成功时返回 ok', async () => {
    const result = await renameRemoteEntry(REMOTE_FILE, '说明.md');

    expect(result.ok).toBe(true);
    expect(result.message).toBe('');
  });

  it('失败时**不抛错**，把后端的错误带回来', async () => {
    invokeMock.mockRejectedValue({
      kind: 'not_found',
      message: '远端已有一个同名条目',
    });

    const result = await renameRemoteEntry(REMOTE_FILE, '说明.md');

    expect(result.ok).toBe(false);
    expect(result.message).toBe('远端已有一个同名条目');
    expect(result.kind).toBe('not_found');
  });
});
